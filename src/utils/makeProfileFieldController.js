// /src/utils/makeSecuredCrudController.js
'use strict';

/**
 * Factory that returns { find, update } controller actions
 * with owner-based access control via user-provided functors.
 *
 * Works with Strapi v5 + (optionally) the Documents API.
 */

const { ensureAgentId, maybeOwnerFilter } = require('./authHelpers');
const { 
  extractOwnerId, 
  parseEmailParam, 
  ensureProfileId,
  USERS_UID 
} = require('./profileHelpers');

const deleteByPath = (obj, path) => {
  const parts = path.split('.');
  const last = parts.pop();
  const parent = parts.reduce((o, k) => (o && o[k] != null ? o[k] : undefined), obj);
  if (parent && Object.prototype.hasOwnProperty.call(parent, last)) delete parent[last];
};

const isObject = (v) => typeof v === 'object' && v !== null;

module.exports = function makeProfileFieldController(
  {
    strapi,                                 // strapi instance
    UID,
    typeField,                              // pointing to type
    ownerField = 'profile',                    // pointing to user
    ownerHasMany = false,                    // true if ownerField is a collection
  }
) {
  if (!UID) throw new Error('makeSecuredCrudController: UID is required');

  return {
    // ---------- FIND ----------
    async find(ctx) {
      await this.validateQuery(ctx);
      const sanitizedQuery = await this.sanitizeQuery(ctx);

      const agentId = ensureAgentId(ctx);

      // Push an owner filter (fast path) then post-filter via hasReadAccess for extra safety
      const userFilteredQuery = maybeOwnerFilter(sanitizedQuery, agentId, ownerField);

      const { results, pagination } = await strapi.service(UID).find(userFilteredQuery);

      const sanitizedResults = await this.sanitizeOutput(results, ctx);
      return this.transformResponse(sanitizedResults, { pagination });
    },

    // ---------- FIND ONE ----------
    async findOne(ctx) {
      if (ownerHasMany) {
        return ctx.badRequest('Invalid request.');
      }
      
      const { id } = ctx.params;

      const agentId = ensureAgentId(ctx);

      await this.validateQuery(ctx);
      const sanitizedQuery = await this.sanitizeQuery(ctx);

      const emailFromParam = parseEmailParam(id, 'user');

      // ---- Branch A: Normal numeric/uuid :id
      if (!emailFromParam) {
        // Fetch to check ownership - populate profile and user within profile
        const existing = await strapi.entityService.findOne(UID, id, { 
          ...sanitizedQuery,
          populate: { 
            [ownerField]: { 
              populate: { user: true } 
            } 
          } 
        });

        if (!existing) return this.transformResponse(null);

        const ownerId = extractOwnerId(existing, ownerField);
        if (agentId !== ownerId) {
          return ctx.forbidden('You do not have permission to access this resource.');
        }

        const sanitized = await this.sanitizeOutput(existing, ctx);
        return this.transformResponse(sanitized);
      }

      // ---- Branch B: id is "user=<email>"
      const email = emailFromParam.toLowerCase();

      const users = await strapi.entityService.findMany(USERS_UID, {
        filters: { email },
        limit: 1,
        populate: { 
          profile: { 
            populate: { [typeField]: true } 
          } 
        },
      });

      if (!users?.length) {
        ctx.throw(404, `Owner with email "${email}" was not found.`);
      }

      const ownerUser = users[0];

      if (agentId !== ownerUser.id) {
        return ctx.forbidden('You do not have permission to access this resource.');
      }

      // Ensure the user has a profile (get existing or create new)
      const profileId = await ensureProfileId(strapi, ownerUser);

      // Single record case: find the one record for this profile
      const { results } = await strapi.service(UID).find({
        ...sanitizedQuery,
        filters: { [ownerField]: { id: profileId } },
        limit: 1,
      });

      if (!results?.length) {
        return this.transformResponse(null);
      }

      const sanitized = await this.sanitizeOutput(results[0], ctx);
      return this.transformResponse(sanitized);
    },

    // ---------- UPDATE ----------
    async update(ctx) {
      const { id } = ctx.params;

      const agentId = ensureAgentId(ctx);

      await this.validateQuery(ctx);
      const sanitizedQuery = await this.sanitizeQuery(ctx);

      const { body = {} } = ctx.request;
      if (!isObject(body.data)) {
        return ctx.badRequest('Missing "data" payload in the request body');
      }

      // Extract ids if ownerHasMany and data is an array
      let extractedIds = [];
      if (ownerHasMany && Array.isArray(body.data)) {
        extractedIds = body.data.map(item => item?.id || null);
        // Remove id from each element before validation
        body.data = body.data.map(item => {
          if (item && typeof item === 'object' && 'id' in item) {
            const { id, ...rest } = item;
            return rest;
          }
          return item;
        });
      }

      await this.validateInput(body.data, ctx);
      const sanitizedInputData = await this.sanitizeInput(body.data, ctx);

      // Never allow changing owner via payload
      if (ownerHasMany && Array.isArray(sanitizedInputData)) {
        // Remove owner field from each element in the array
        sanitizedInputData.forEach(item => deleteByPath(item, ownerField));
      } else {
        deleteByPath(sanitizedInputData, ownerField);
      }

      const emailFromParam = parseEmailParam(id, 'user');

      // ---- Branch A: Normal numeric/uuid :id
      if (!emailFromParam) {
        // Fetch to check ownership - populate profile and user within profile
        const existing = await strapi.entityService.findOne(UID, id, { 
          populate: { 
            [ownerField]: { 
              populate: { user: true } 
            } 
          } 
        });
        if (!existing) return this.transformResponse(null);

        const ownerId = extractOwnerId(existing, ownerField);
        if (agentId !== ownerId) {
          return ctx.forbidden('You do not have permission to modify this resource.');
        }

        // Prefer Documents API if available and we have documentId
        const documentId = existing.documentId;
        let updated;

        if (documentId) {
          updated = await strapi.documents(UID).update({
            ...sanitizedQuery,
            documentId,
            data: sanitizedInputData,
          });
        } else {
          updated = await strapi.service(UID).update(id, {
            ...sanitizedQuery,
            data: sanitizedInputData,
          });
        }

        const sanitized = await this.sanitizeOutput(updated, ctx);
        return this.transformResponse(sanitized);
      }

      // ---- Branch B: id is "ownerField=<email>"
      const email = emailFromParam.toLowerCase();

      const users = await strapi.entityService.findMany(USERS_UID, {
        filters: { email },
        limit: 1,
        populate: { 
          profile: { 
            populate: { [typeField]: true } 
          } 
        },
      });

      if (!users?.length) {
        ctx.throw(404, `Owner with email "${email}" was not found.`);
      }

      const ownerUser = users[0];

      if (agentId !== ownerUser.id) {
        return ctx.forbidden('You do not have permission to modify this resource.');
      }

      // Ensure the user has a profile (get existing or create new)
      const profileId = await ensureProfileId(strapi, ownerUser);

      // Handle ownerHasMany case: expect array of partial updates
      if (ownerHasMany) {
        if (!Array.isArray(sanitizedInputData)) {
          return ctx.badRequest('Data must be an array of updates');
        }

        const processedResults = [];

        for (let i = 0; i < sanitizedInputData.length; i++) {
          const item = sanitizedInputData[i];
          const itemId = extractedIds[i];

          if (itemId) {
            // Update existing record: find by id and verify ownership
            const existing = await strapi.entityService.findOne(UID, itemId, {
              populate: { 
                [ownerField]: { 
                  populate: { user: true } 
                } 
              },
            });

            if (!existing) {
              ctx.throw(404, `Record with id ${itemId} not found`);
            }

            // Verify ownership (check against user via profile)
            const itemOwnerId = extractOwnerId(existing, ownerField);
            if (itemOwnerId !== ownerUser.id) {
              return ctx.forbidden(`You do not own the record with id ${itemId}`);
            }

            // Update the record (id already removed during extraction)
            const documentId = existing.documentId;
            let updated;
            if (documentId) {
              updated = await strapi.documents(UID).update({
                ...sanitizedQuery,
                documentId,
                data: item,
              });
            } else {
              updated = await strapi.service(UID).update(itemId, {
                ...sanitizedQuery,
                data: item,
              });
            }
            processedResults.push(updated);
          } else {
            // Create new record: no id means this is a new element
            const created = await strapi.documents(UID).create({
              data: { ...item, [ownerField]: profileId },
              status: 'published',
            });
            processedResults.push(created);
          }
        }

        const sanitized = await this.sanitizeOutput(processedResults, ctx);
        return this.transformResponse(sanitized);
      }

      // Original single-record logic for ownerHasMany=false
      // Find an existing record for this profile
      const { results } = await strapi.service(UID).find({
        filters: { [ownerField]: { id: profileId } },
        limit: 1,
      });

      let targetDocumentId = results?.[0]?.documentId;

      // Create missing record if configured
      if (!results?.length) {
        const created = await strapi.documents(UID).create({
            data: { [ownerField]: profileId },
            status: 'published',
          });
          targetDocumentId = created?.documentId;
      }

      if (!targetDocumentId) {
        ctx.throw(500, 'Unable to resolve target document for the specified owner.');
      }

      // Perform the update
      let updated;
      if (targetDocumentId) {
        updated = await strapi.documents(UID).update({
          ...sanitizedQuery,
          documentId: targetDocumentId,
          data: sanitizedInputData,
        });
      } else if (results?.[0]?.id) {
        updated = await strapi.service(UID).update(results[0].id, {
          ...sanitizedQuery,
          data: sanitizedInputData,
        });
      } else {
        ctx.throw(404, 'Target resource for the specified owner was not found.');
      }

      const sanitized = await this.sanitizeOutput(updated, ctx);
      return this.transformResponse(sanitized);
    },
  };
}
