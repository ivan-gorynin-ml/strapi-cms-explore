'use strict';

const WRAPPED = Symbol.for('my-upload-wrap-v1');

/**
 * Generate a short request ID for log correlation.
 */
function makeReqId() {
  return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
}

/**
 * Safely extract keys from an object, excluding large/sensitive values.
 */
function safeKeys(obj) {
  if (!obj || typeof obj !== 'object') return [];
  return Object.keys(obj);
}

/**
 * Safely summarise a single file object for logging.
 */
function fileMeta(f) {
  if (!f || typeof f !== 'object') return f;
  const meta = {};
  if (f.name != null) meta.name = f.name;
  if (f.size != null) meta.size = f.size;
  if (f.type != null) meta.type = f.type;
  if (f.mime != null) meta.mime = f.mime;
  if (f.path != null) meta.path = f.path;
  if (f.hash != null) meta.hash = f.hash;
  if (f.ext != null) meta.ext = f.ext;
  return meta;
}

/**
 * Safely summarise an uploaded result item.
 */
function resultMeta(r) {
  if (!r || typeof r !== 'object') return r;
  const meta = {};
  if (r.id != null) meta.id = r.id;
  if (r.name != null) meta.name = r.name;
  if (r.url != null) meta.url = r.url;
  if (r.provider != null) meta.provider = r.provider;
  if (r.mime != null) meta.mime = r.mime;
  if (r.size != null) meta.size = r.size;
  if (r.hash != null) meta.hash = r.hash;
  return meta;
}

/**
 * Redact sensitive keys from an object for safe logging.
 */
function redactSecrets(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  const safe = { ...obj };
  const sensitiveKeys = ['secret', 'token', 'password', 'api_key', 'api_secret', 'apiSecret', 'apiKey'];
  sensitiveKeys.forEach((key) => {
    Object.keys(safe).forEach((k) => {
      if (k.toLowerCase().includes(key.toLowerCase())) {
        safe[k] = '***REDACTED***';
      }
    });
  });
  return safe;
}

/**
 * Extract file list from Koa request (handles multiple shapes).
 */
function extractFiles(ctx) {
  const files = [];
  if (!ctx || !ctx.request) return files;
  
  const reqFiles = ctx.request.files;
  if (!reqFiles) return files;
  
  // Handle files.files (multipart field named "files")
  if (reqFiles.files) {
    if (Array.isArray(reqFiles.files)) {
      files.push(...reqFiles.files);
    } else {
      files.push(reqFiles.files);
    }
  }
  
  // Handle other top-level file fields
  Object.keys(reqFiles).forEach((key) => {
    if (key !== 'files') {
      const val = reqFiles[key];
      if (Array.isArray(val)) {
        files.push(...val);
      } else if (val && typeof val === 'object') {
        files.push(val);
      }
    }
  });
  
  return files;
}

/**
 * Create a controller wrapper with full HTTP context logging.
 */
function wrapControllerUploadFn(obj, fnName, label) {
  if (!obj || typeof obj[fnName] !== 'function') return false;
  if (obj[fnName][WRAPPED]) return false;

  const original = obj[fnName].bind(obj);

  obj[fnName] = async (ctx) => {
    const reqId = makeReqId();
    const start = Date.now();

    // ── BEGIN: Log incoming request details ──
    const method = ctx.request?.method || 'UNKNOWN';
    const url = ctx.request?.url || 'UNKNOWN';
    const ip = ctx.request?.ip || 'UNKNOWN';
    const userId = ctx.state?.user?.id || 'anonymous';

    strapi.log.info(
      `[upload-ctrl] BEGIN ${label}.${fnName} reqId=${reqId} method=${method} url=${url} ip=${ip} userId=${userId}`
    );

    // Log request payload structure
    const hasFiles = !!ctx.request?.files;
    const bodyKeys = safeKeys(ctx.request?.body);
    strapi.log.debug(
      `[upload-ctrl] reqId=${reqId} hasFiles=${hasFiles} bodyKeys=${bodyKeys.join(', ')}`
    );

    // Log file metadata safely
    const files = extractFiles(ctx);
    strapi.log.debug(`[upload-ctrl] reqId=${reqId} fileCount=${files.length}`);
    files.forEach((f, i) => {
      strapi.log.debug(`[upload-ctrl] reqId=${reqId} file[${i}] ${JSON.stringify(fileMeta(f))}`);
    });

    try {
      const result = await original(ctx);

      const elapsed = Date.now() - start;
      strapi.log.info(`[upload-ctrl] END OK ${label}.${fnName} reqId=${reqId} elapsed=${elapsed}ms`);

      // Log response summary
      if (ctx.body) {
        if (Array.isArray(ctx.body)) {
          strapi.log.debug(`[upload-ctrl] reqId=${reqId} response: array length=${ctx.body.length}`);
          ctx.body.forEach((item, i) => {
            strapi.log.debug(
              `[upload-ctrl] reqId=${reqId} response[${i}] ${JSON.stringify(resultMeta(item))}`
            );
          });
        } else if (typeof ctx.body === 'object') {
          strapi.log.debug(
            `[upload-ctrl] reqId=${reqId} response: ${JSON.stringify(resultMeta(ctx.body))}`
          );
        }
      }

      return result;
    } catch (e) {
      const elapsed = Date.now() - start;
      strapi.log.error(
        `[upload-ctrl] END FAIL ${label}.${fnName} reqId=${reqId} elapsed=${elapsed}ms name=${e.name} error=${e.message}`
      );
      strapi.log.error(`[upload-ctrl] reqId=${reqId} stack: ${e.stack}`);
      throw e;
    }
  };

  obj[fnName][WRAPPED] = true;
  strapi.log.info(`[upload-ext] ✓ Wrapped ${label}.${fnName}`);
  return true;
}

/**
 * Create a service wrapper with detailed argument/result logging.
 */
function wrapServiceUploadFn(obj, fnName, label) {
  if (!obj || typeof obj[fnName] !== 'function') return false;
  if (obj[fnName][WRAPPED]) return false;

  const original = obj[fnName].bind(obj);

  obj[fnName] = async function (...args) {
    const svcReqId = makeReqId();
    const start = Date.now();

    strapi.log.debug(
      `[upload-svc] BEGIN ${label}.${fnName} svcReqId=${svcReqId} argsCount=${args.length}`
    );

    // Safely inspect arguments
    args.forEach((arg, i) => {
      if (Array.isArray(arg)) {
        strapi.log.debug(`[upload-svc] svcReqId=${svcReqId} arg[${i}] array length=${arg.length}`);
        arg.forEach((item, j) => {
          if (item && typeof item === 'object' && (item.name || item.size || item.type)) {
            strapi.log.debug(
              `[upload-svc] svcReqId=${svcReqId} arg[${i}][${j}] ${JSON.stringify(fileMeta(item))}`
            );
          }
        });
      } else if (arg && typeof arg === 'object') {
        const keys = safeKeys(arg);
        strapi.log.debug(
          `[upload-svc] svcReqId=${svcReqId} arg[${i}] object keys=${keys.join(', ')}`
        );
      } else {
        strapi.log.debug(`[upload-svc] svcReqId=${svcReqId} arg[${i}] type=${typeof arg}`);
      }
    });

    try {
      const result = await original.apply(this, args);

      const elapsed = Date.now() - start;
      strapi.log.info(`[upload-svc] END OK ${label}.${fnName} svcReqId=${svcReqId} elapsed=${elapsed}ms`);

      // Log result summary
      if (result) {
        if (Array.isArray(result)) {
          strapi.log.debug(
            `[upload-svc] svcReqId=${svcReqId} result: array length=${result.length}`
          );
          result.forEach((item, i) => {
            strapi.log.debug(
              `[upload-svc] svcReqId=${svcReqId} result[${i}] ${JSON.stringify(resultMeta(item))}`
            );
          });
        } else if (typeof result === 'object') {
          strapi.log.debug(
            `[upload-svc] svcReqId=${svcReqId} result: ${JSON.stringify(resultMeta(result))}`
          );
        }
      }

      return result;
    } catch (e) {
      const elapsed = Date.now() - start;
      strapi.log.error(
        `[upload-svc] END FAIL ${label}.${fnName} svcReqId=${svcReqId} elapsed=${elapsed}ms name=${e.name} error=${e.message}`
      );
      strapi.log.error(`[upload-svc] svcReqId=${svcReqId} stack: ${e.stack}`);
      throw e;
    }
  };

  obj[fnName][WRAPPED] = true;
  strapi.log.info(`[upload-ext] ✓ Wrapped ${label}.${fnName}`);
  return true;
}

module.exports = (plugin) => {
  // ─── STARTUP LOGS: Confirm extension is loaded ───────────────────────────────
  console.log('[upload-ext] LOADED src/extensions/upload/strapi-server.js');
  strapi.log.warn('[upload-ext] LOADED src/extensions/upload/strapi-server.js');

  // ─── 1. Wrap all controller methods named upload/uploadFiles ─────────────────
  for (const [name, ctrl] of Object.entries(plugin.controllers || {})) {
    wrapControllerUploadFn(ctrl, 'upload', `controllers.${name}`);
    wrapControllerUploadFn(ctrl, 'uploadFiles', `controllers.${name}`);
  }

  // ─── 2. Wrap all service methods named upload/uploadFiles/uploadFileAndPersist ─
  for (const [name, svc] of Object.entries(plugin.services || {})) {
    wrapServiceUploadFn(svc, 'uploadFiles', `services.${name}`);
    wrapServiceUploadFn(svc, 'upload', `services.${name}`);
    wrapServiceUploadFn(svc, 'uploadFileAndPersist', `services.${name}`);
  }

  strapi.log.warn('[upload-ext] Upload extension initialization complete');
  return plugin;
};
