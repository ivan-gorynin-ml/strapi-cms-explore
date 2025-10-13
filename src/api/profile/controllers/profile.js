'use strict';

/**
 * profile controller
 */

const { createCoreController } = require('@strapi/strapi').factories;
const { ensureAgentId, maybeOwnerFilter } = require('../../../utils/authHelpers');

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
}));
