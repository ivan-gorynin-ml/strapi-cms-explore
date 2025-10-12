'use strict';

const { createCoreController } = require('@strapi/strapi').factories;

const UID = 'api::user-general-info.user-general-info';
const USERS_UID = "plugin::users-permissions.user";

module.exports = createCoreController(UID, ({ strapi }) => ({
  // Override update to forward clean opts into the service
  async update(ctx) {
    const { id } = ctx.params;
    strapi.log.info(`[UserGeneralInfo:update] incoming params=${JSON.stringify(ctx.params)}`);

    await this.validateQuery(ctx);
    const sanitizedQuery = await this.sanitizeQuery(ctx);

    const { body = {} } = ctx.request;
    if (typeof body.data !== "object" || body.data === null) {
      throw new strapi.errors.ValidationError('Missing "data" payload in the request body');
    }

    await this.validateInput(body.data, ctx);
    const sanitizedInputData = await this.sanitizeInput(body.data, ctx);

    // Helper: extract email from "user=<email>" pattern
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

    // If it's NOT the user=<email> form, do the regular update by id
    if (!emailFromParam) {
      const entity = await strapi.service(UID).update(id, {
        ...sanitizedQuery,
        data: sanitizedInputData,
      });

      const sanitizedEntity = await this.sanitizeOutput(entity, ctx);
      return this.transformResponse(sanitizedEntity);
    }

    // user=<email> flow
    const email = emailFromParam.toLowerCase();
    strapi.log.info(`[UserGeneralInfo:update] resolving by email=${email}`);

    // 1) Find the user by email and populate any existing user_general_info
    const users = await strapi.entityService.findMany(USERS_UID, {
      filters: { email },
      limit: 1,
      populate: { user_general_info: true }, // expects field name on user side if it exists
    });

    if (!users || users.length === 0) {
      ctx.throw(404, `User with email "${email}" was not found`);
    }

    const user = users[0];

    // 2) Determine or create the target UserGeneralInfo and obtain its documentId
    let targetDocId;

    if (user.user_general_info) {
      // Existing relation found — use its documentId
      targetDocId = user.user_general_info.documentId || null;
      if (!targetDocId) {
        // Fallback: fetch fresh to be safe (handles cases where populate didn’t include documentId)
        const gi = await strapi.entityService.findOne(UID, user.user_general_info.id);
        targetDocId = gi?.documentId || null;
      }
      strapi.log.info(
        `[UserGeneralInfo:update] existing UGI found for user ${user.id}; documentId=${targetDocId}`
      );
    } else {
      // Create a fresh UserGeneralInfo and link it to the user (one-to-one)
      // Important: link via the field on UserGeneralInfo side (assumed "user")
      const created = await strapi.documents(UID).create({
        data: {
          user: user.id,
        },
        status: "published", // publish immediately if your type uses D&P
      });

      targetDocId = created.documentId;
      strapi.log.info(
        `[UserGeneralInfo:update] created new UGI for user ${user.id}; documentId=${targetDocId}`
      );
    }

    if (!targetDocId) {
      ctx.throw(500, "Unable to resolve target documentId for UserGeneralInfo");
    }

    // 3) Perform the update via Documents API by documentId
    //    Pass through sanitized query params (fields, populate, etc.) if relevant.
    const updated = await strapi.documents(UID).update({
      ...sanitizedQuery,
      documentId: targetDocId,
      data: sanitizedInputData,
      // Optionally, keep current status; here we leave it to documents service defaults
    });

    const sanitizedEntity = await this.sanitizeOutput(updated, ctx);
    return this.transformResponse(sanitizedEntity);
  }

}));
