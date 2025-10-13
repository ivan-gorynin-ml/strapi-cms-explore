'use strict';

/**
 * profile controller
 */

const { createCoreController } = require('@strapi/strapi').factories;
const { ensureAgentId, maybeOwnerFilter } = require('../../../utils/authHelpers');
const { 
  extractOwnerId, 
  parseEmailParam, 
  ensureProfile,
  USERS_UID 
} = require('../../../utils/profileHelpers');

const UID = 'api::profile.profile';

module.exports = createCoreController(UID, ({ strapi }) => ({
  // Override find method with owner-based access control
  async find(ctx) {
    await this.validateQuery(ctx);
    const sanitizedQuery = await this.sanitizeQuery(ctx);

    const agentId = ensureAgentId(ctx);

    // Push an owner filter (fast path) then post-filter via hasReadAccess for extra safety
    const userFilteredQuery = maybeOwnerFilter(sanitizedQuery, agentId, 'user');

    const { results, pagination } = await strapi.service(UID).find(userFilteredQuery);

    const sanitizedResults = await this.sanitizeOutput(results, ctx);
    return this.transformResponse(sanitizedResults, { pagination });
  },

  // Override findOne method with owner-based access control
  async findOne(ctx) {
    const { id } = ctx.params;
    const agentId = ensureAgentId(ctx);

    await this.validateQuery(ctx);
    const sanitizedQuery = await this.sanitizeQuery(ctx);

    const emailFromParam = parseEmailParam(id, 'user');

    // ---- Branch A: Normal numeric/uuid :id
    if (!emailFromParam) {
      // Fetch profile and populate user to check ownership
      const existing = await strapi.entityService.findOne(UID, id, {
        ...sanitizedQuery,
        populate: { user: true },
      });

      if (!existing) return this.transformResponse(null);

      // Check if the authenticated user owns this profile
      const ownerId = extractOwnerId(existing, 'user');
      if (agentId !== ownerId) {
        return ctx.forbidden('You do not have permission to access this resource.');
      }

      const sanitized = await this.sanitizeOutput(existing, ctx);
      return this.transformResponse(sanitized);
    }

    // ---- Branch B: id is "user=<email>"
    const email = emailFromParam.toLowerCase();

    // Find user by email
    const users = await strapi.entityService.findMany(USERS_UID, {
      filters: { email },
      limit: 1,
    });

    if (!users?.length) {
      ctx.throw(404, `User with email "${email}" was not found.`);
    }

    const ownerUser = users[0];

    // Check if the authenticated user matches the requested user
    if (agentId !== ownerUser.id) {
      return ctx.forbidden('You do not have permission to access this resource.');
    }

    // Ensure the user has a profile (get existing or create new)
    const profile = await ensureProfile(strapi, ownerUser, false);

    if (!profile) {
      return this.transformResponse(null);
    }

    const sanitized = await this.sanitizeOutput(profile, ctx);
    return this.transformResponse(sanitized);
  },
}));
