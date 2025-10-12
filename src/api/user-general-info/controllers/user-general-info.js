'use strict';

const { createCoreController } = require('@strapi/strapi').factories;

const UID = 'api::user-general-info.user-general-info';
const USERS_UID = "plugin::users-permissions.user";

module.exports = createCoreController(UID, ({ strapi }) => ({
  async find(ctx) {
    await this.validateQuery(ctx);
    const sanitizedQuery = await this.sanitizeQuery(ctx);

    // Ensure the user is authenticated
    const user = ctx.state.user;
    if (!user) {
        return ctx.unauthorized("You must be logged in to access your data");
    }

    // Add filter: only entries where user.id = current user's id
    const userFilteredQuery = {
        ...sanitizedQuery,
        filters: {
        ...(sanitizedQuery.filters || {}),
        user: {
            id: user.id,
        },
        },
    };

    // Perform query with filter applied
    const { results, pagination } = await strapi.service(UID).find(userFilteredQuery);

    // Sanitize and return
    const sanitizedResults = await this.sanitizeOutput(results, ctx);
    return this.transformResponse(sanitizedResults, { pagination });
  },

  // Override update to forward clean opts into the service
  async update(ctx) {
  const { id } = ctx.params;
  strapi.log.info(`[UserGeneralInfo:update] incoming params=${JSON.stringify(ctx.params)}`);

  // ---- Auth guard
  const authUser = ctx.state?.user || ctx.user;
  if (!authUser?.id) {
    // keep consistent with Strapi errors
    throw new strapi.errors.UnauthorizedError('Unauthorized');
  }

  await this.validateQuery(ctx);
  const sanitizedQuery = await this.sanitizeQuery(ctx);

  const { body = {} } = ctx.request;
    if (typeof body.data !== "object" || body.data === null) {
    throw new strapi.errors.ValidationError('Missing "data" payload in the request body');
  }

  await this.validateInput(body.data, ctx);
  const sanitizedInputData = await this.sanitizeInput(body.data, ctx);

  // Never allow changing the ownership from the payload
  if ('user' in sanitizedInputData) {
    delete sanitizedInputData.user;
  }

  // Helper: extract email from "user=<email>" form
  const emailFromParam = (() => {
      if (!id || typeof id !== "string") return null;
      // Accept both "user=<email>" and "USER=<email>", and allow URL-encoded emails
    const m = /^user=(.+)$/i.exec(id);
    if (!m) return null;
      try {
        return decodeURIComponent(m[1]).trim();
      } catch {
        return m[1].trim();
      }
  })();

  // ---------- Branch A: normal `:id` update
  if (!emailFromParam) {
    // Fetch the target record first (need the owner to check)
    const existing = await strapi.entityService.findOne(UID, id, {
      populate: { user: true },
    });

    strapi.log.info(`[UserGeneralInfo:update] resolved existing id=${id} to ${JSON.stringify(existing)}`);
    
    if (!existing) {
      return this.transformResponse(null);
    }

    const ownerId = existing?.user?.id;
    if (!ownerId || ownerId !== authUser.id) {
      throw new strapi.errors.ForbiddenError('You can only update your own general info.');
    }

    // If you use Documents, prefer updating by documentId to avoid locale/versioning pitfalls
    const documentId = existing.documentId;
    let updated;

    if (documentId) {
      updated = await strapi.documents(UID).update({
        ...sanitizedQuery,
        documentId,
        data: sanitizedInputData,
      });
    } else {
      // Fallback to classic update if not using Documents
      updated = await strapi.service(UID).update(id, {
        ...sanitizedQuery,
        data: sanitizedInputData,
      });
    }

    const sanitizedEntity = await this.sanitizeOutput(updated, ctx);
    return this.transformResponse(sanitizedEntity);
  }

  // ---------- Branch B: `id` is `user=<email>`
  const email = emailFromParam.toLowerCase();
  strapi.log.info(`[UserGeneralInfo:update] resolving by email=${email}`);

  const users = await strapi.entityService.findMany(USERS_UID, {
    filters: { email },
    limit: 1,
    populate: { user_general_info: true },
  });

  if (!users || users.length === 0) {
    ctx.throw(404, `User with email "${email}" was not found`);
  }

  const user = users[0];

  // Ownership check: the resolved user must be the authenticated user
  if (user.id !== authUser.id) {
    throw new strapi.errors.ForbiddenError('You can only update your own general info.');
  }

  // Determine/create target UserGeneralInfo
  let targetDocId;

  if (user.user_general_info) {
    // Ensure we have documentId (re-fetch if needed)
    targetDocId = user.user_general_info.documentId || null;
    if (!targetDocId) {
      const gi = await strapi.entityService.findOne(UID, user.user_general_info.id);
      targetDocId = gi?.documentId || null;
    }
    strapi.log.info(`[UserGeneralInfo:update] existing UGI for user ${user.id}; documentId=${targetDocId}`);
  } else {
    // Create and link to the authenticated user
    const created = await strapi.documents(UID).create({
      data: { user: user.id },
      status: 'published',
    });
    targetDocId = created.documentId;
    strapi.log.info(`[UserGeneralInfo:update] created new UGI for user ${user.id}; documentId=${targetDocId}`);
  }

  if (!targetDocId) {
    ctx.throw(500, 'Unable to resolve target documentId for UserGeneralInfo');
  }

  // Update via Documents API
  const updated = await strapi.documents(UID).update({
    ...sanitizedQuery,
    documentId: targetDocId,
    data: sanitizedInputData,
  });

  const sanitizedEntity = await this.sanitizeOutput(updated, ctx);
  return this.transformResponse(sanitizedEntity);
}

}));
