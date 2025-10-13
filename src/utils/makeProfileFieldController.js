// /src/utils/makeSecuredCrudController.js
'use strict';

/**
 * Factory that returns { find, update } controller actions
 * with owner-based access control via user-provided functors.
 *
 * Works with Strapi v5 + (optionally) the Documents API.
 */

const USERS_UID = 'plugin::users-permissions.user';
const PROFILES_UID = 'api::profile.profile';

const getByPath = (obj, path) =>
  path.split('.').reduce((o, k) => (o && o[k] != null ? o[k] : undefined), obj);

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

  /**
   * Ensures a profile exists for the given user.
   * If the user already has a profile, returns its ID.
   * Otherwise, creates a new profile, associates it to the user, and returns the new profile ID.
   */
  const ensureProfileId = async (user) => {
    if (!user?.id) {
      throw new Error('ensureProfileId: user with id is required');
    }

    // Fetch user with profile populated
    const populatedUser = await strapi.entityService.findOne(USERS_UID, user.id, {
      populate: { profile: true },
    });

    // If profile exists, return its id
    if (populatedUser?.profile) {
      return typeof populatedUser.profile === 'object' 
        ? populatedUser.profile.id 
        : populatedUser.profile;
    }

    // Create new profile and associate it to the user
    const newProfile = await strapi.documents(PROFILES_UID).create({
      data: { user: user.id },
      status: 'published',
    });

    return newProfile.id;
  };

  const extractOwnerId = (entity) => {
    const rel = getByPath(entity, ownerField);
    if (!rel) return undefined;
    
    // Get the profile (could be id or populated object)
    const profile = typeof rel === 'object' ? rel : { id: rel };
    
    // If profile is populated and has a user field, return the user's id
    if (profile.user !== undefined) {
      return typeof profile.user === 'object' ? profile.user.id : profile.user;
    }
    
    // If profile is not populated with user, we can't extract user id
    // Return undefined to indicate we need to fetch with proper population
    return undefined;
  };

  const ensureAgentId = (ctx) => {
    if (ctx.state?.agentId) return ctx.state.agentId;
    const user = ctx.state?.user || ctx.user;
    if (!user?.id) return ctx.unauthorized('Unauthorized');
    return user.id;
  };

  const maybeOwnerFilter = (sanitizedQuery, agentId) => {
    // Merge filters: {..., [ownerField]: { id: agentId }}
    const current = sanitizedQuery.filters || {};
    const ownerFilter = {};
    // Support nested ownerField like "owner.user"
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

  const parseEmailParam = (id) => {
    if (!id || typeof id !== 'string') return null;
    const re = new RegExp(`^user=([^]+)$`, 'i'); // accept url-encoded
    const m = re.exec(id);
    if (!m) return null;
    try {
      return decodeURIComponent(m[1]).trim();
    } catch {
      return m[1].trim();
    }
  };

  return {
    // ---------- FIND ----------
    async find(ctx) {
      await this.validateQuery(ctx);
      const sanitizedQuery = await this.sanitizeQuery(ctx);

      const agentId = ensureAgentId(ctx);

      // Push an owner filter (fast path) then post-filter via hasReadAccess for extra safety
      const userFilteredQuery = maybeOwnerFilter(sanitizedQuery, agentId);

      const { results, pagination } = await strapi.service(UID).find(userFilteredQuery);

      const sanitizedResults = await this.sanitizeOutput(results, ctx);
      return this.transformResponse(sanitizedResults, { pagination });
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

      const emailFromParam = parseEmailParam(id);

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

        const ownerId = extractOwnerId(existing);
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
      const profileId = await ensureProfileId(ownerUser);

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
            const itemOwnerId = extractOwnerId(existing);
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
