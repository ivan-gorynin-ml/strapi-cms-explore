// /src/utils/authHelpers.js
'use strict';

/**
 * Shared authentication and authorization helper functions
 * for Strapi controllers with owner-based access control.
 */

/**
 * Extracts the authenticated user's ID from the Koa context.
 * Returns the user ID or throws unauthorized error if not authenticated.
 * 
 * @param {Object} ctx - Koa context object
 * @returns {number} - The authenticated user's ID
 */
const ensureAgentId = (ctx) => {
  if (ctx.state?.agentId) return ctx.state.agentId;
  const user = ctx.state?.user || ctx.user;
  if (!user?.id) return ctx.unauthorized('Unauthorized');
  return user.id;
};

/**
 * Adds an owner filter to a sanitized query to restrict results
 * to records owned by the specified agent/user.
 * 
 * Supports nested owner fields like "profile.user".
 * 
 * @param {Object} sanitizedQuery - The sanitized query object
 * @param {number} agentId - The owner's user ID
 * @param {string} ownerField - The field name pointing to the owner (default: 'user')
 * @returns {Object} - Updated query with owner filter applied
 */
const maybeOwnerFilter = (sanitizedQuery, agentId, ownerField = 'user') => {
  // Merge filters: {..., [ownerField]: { id: agentId }}
  const current = sanitizedQuery.filters || {};
  const ownerFilter = {};
  
  // Support nested ownerField like "owner.user" or "profile.user"
  const pathParts = ownerField.split('.');
  let cursor = ownerFilter;
  for (let i = 0; i < pathParts.length - 1; i++) {
    cursor[pathParts[i]] = {};
    cursor = cursor[pathParts[i]];
  }
  cursor[pathParts[pathParts.length - 1]] = { id: agentId };

  return {
    ...sanitizedQuery,
    filters: { ...current, ...ownerFilter },
  };
};

module.exports = {
  ensureAgentId,
  maybeOwnerFilter,
};

