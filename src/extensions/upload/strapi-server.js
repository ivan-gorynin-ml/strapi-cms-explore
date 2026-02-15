'use strict';

const WRAPPED = Symbol.for('strapi-upload-wrapper');

/**
 * Generate a short request ID for log correlation.
 */
function makeReqId() {
  return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
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

module.exports = (plugin) => {
  // ─── 1. Wrap the Upload service's upload function ────────────────────────────
  const svc = plugin.services && plugin.services.upload;
  if (svc && typeof svc.upload === 'function' && !svc.upload[WRAPPED]) {
    const originalUpload = svc.upload;

    const wrappedUpload = async function wrappedUpload(files, data) {
      const reqId = makeReqId();
      const start = Date.now();

      // --- incoming request log ---
      strapi.log.debug(`[upload] ====== Incoming upload request ======`);
      strapi.log.debug(`[upload] reqId=${reqId}  startTime=${new Date(start).toISOString()}`);

      if (data && typeof data === 'object') {
        strapi.log.debug(`[upload] data keys: ${Object.keys(data).join(', ')}`);
      }

      // Log per-file metadata (handle array or single)
      const fileList = Array.isArray(files) ? files : [files];
      fileList.forEach((f, i) => {
        strapi.log.debug(`[upload] file[${i}] ${JSON.stringify(fileMeta(f))}`);
      });

      try {
        const result = await originalUpload.call(this, files, data);

        const elapsed = Date.now() - start;
        strapi.log.info(`[upload] Upload successful  reqId=${reqId}  elapsed=${elapsed}ms`);

        // Summarise output
        if (result != null) {
          const results = Array.isArray(result) ? result : [result];
          strapi.log.debug(`[upload] ${results.length} item(s) uploaded`);
          results.forEach((r, i) => {
            strapi.log.debug(`[upload] result[${i}] ${JSON.stringify(resultMeta(r))}`);
          });
        }

        return result;
      } catch (err) {
        const elapsed = Date.now() - start;
        strapi.log.error(`[upload] Upload FAILED  reqId=${reqId}  elapsed=${elapsed}ms  error=${err.message}  name=${err.name}`);
        strapi.log.error(`[upload] Stack: ${err.stack}`);
        throw err;
      }
    };

    wrappedUpload[WRAPPED] = true;
    svc.upload = wrappedUpload;
  }

  // ─── 2. Wrap the provider-level upload function ──────────────────────────────
  let provider;

  // Try several known locations for the provider object
  if (svc && typeof svc.getProvider === 'function') {
    try {
      provider = svc.getProvider();
    } catch (_) {
      /* getProvider may not be available at extension-time */
    }
  }
  if (!provider && plugin.provider && typeof plugin.provider === 'object') {
    provider = plugin.provider;
  }

  if (provider && typeof provider.upload === 'function' && !provider.upload[WRAPPED]) {
    const originalProviderUpload = provider.upload;

    const wrappedProviderUpload = async function wrappedProviderUpload(file, options) {
      const providerReqId = makeReqId();
      const start = Date.now();

      strapi.log.debug(`[cloudinary] ====== Cloudinary uploading ======`);
      strapi.log.debug(`[cloudinary] providerReqId=${providerReqId}`);
      strapi.log.debug(`[cloudinary] file: ${JSON.stringify(fileMeta(file))}`);

      if (options && typeof options === 'object') {
        // Log options but strip any secret-looking keys
        const safeOpts = { ...options };
        ['api_secret', 'apiSecret', 'secret', 'password', 'token'].forEach((k) => {
          if (k in safeOpts) safeOpts[k] = '***';
        });
        strapi.log.debug(`[cloudinary] options: ${JSON.stringify(safeOpts)}`);
      }

      try {
        const result = await originalProviderUpload.call(this, file, options);

        const elapsed = Date.now() - start;
        strapi.log.info(`[cloudinary] Upload successful  providerReqId=${providerReqId}  elapsed=${elapsed}ms`);

        // Log Cloudinary-specific fields from the file object (mutated in-place by the provider)
        const info = {};
        if (file.url != null) info.url = file.url;
        if (file.provider != null) info.provider = file.provider;
        if (file.provider_metadata != null) info.provider_metadata = file.provider_metadata;
        const pm = file.provider_metadata || {};
        if (pm.public_id != null) info.public_id = pm.public_id;
        if (pm.resource_type != null) info.resource_type = pm.resource_type;
        if (file.ext != null) info.format = file.ext;
        strapi.log.debug(`[cloudinary] result: ${JSON.stringify(info)}`);

        return result;
      } catch (err) {
        const elapsed = Date.now() - start;
        const httpCode = err.http_code || err.status || 'N/A';
        strapi.log.error(
          `[cloudinary] Upload FAILED  providerReqId=${providerReqId}  elapsed=${elapsed}ms  http_code=${httpCode}  error=${err.message}`
        );
        strapi.log.error(`[cloudinary] Stack: ${err.stack}`);
        throw err;
      }
    };

    wrappedProviderUpload[WRAPPED] = true;
    provider.upload = wrappedProviderUpload;
  }

  return plugin;
};
