// /src/utils/profileHelpers.js
'use strict';

/**
 * Shared helper functions for Profile-related operations
 * including ownership extraction, email parsing, and profile management.
 */

const USERS_UID = 'plugin::users-permissions.user';
const PROFILES_UID = 'api::profile.profile';

/**
 * Gets a nested property value from an object using dot notation.
 * @param {Object} obj - The object to traverse
 * @param {string} path - The dot-separated path (e.g., "profile.user.id")
 * @returns {*} - The value at the path or undefined
 */
const getByPath = (obj, path) =>
  path.split('.').reduce((o, k) => (o && o[k] != null ? o[k] : undefined), obj);

/**
 * Extracts the owner (user) ID from an entity.
 * Supports both direct user relations and nested relations via profile.
 * 
 * @param {Object} entity - The entity to extract owner from
 * @param {string} ownerField - The field path pointing to the owner (default: 'user')
 * @returns {number|undefined} - The owner's user ID or undefined
 */
const extractOwnerId = (entity, ownerField = 'user') => {
  const rel = getByPath(entity, ownerField);
  if (!rel) return undefined;
  
  // For direct user relations (e.g., profile.user)
  if (ownerField === 'user' || !ownerField.includes('.')) {
    return typeof rel === 'object' ? rel.id : rel;
  }
  
  // For nested relations via profile (e.g., ownerField = 'profile')
  // Get the profile (could be id or populated object)
  const profile = typeof rel === 'object' ? rel : { id: rel };
  
  // If profile is populated and has a user field, return the user's id
  if (profile.user !== undefined) {
    return typeof profile.user === 'object' ? profile.user.id : profile.user;
  }
  
  // If profile is not populated with user, we can't extract user id
  return undefined;
};

/**
 * Parses email parameter from ID string.
 * Supports patterns like "user=email@example.com".
 * 
 * @param {string} id - The ID parameter from the request
 * @param {string} paramKey - The key to look for (default: 'user')
 * @returns {string|null} - The extracted email or null
 */
const parseEmailParam = (id, paramKey = 'user') => {
  if (!id || typeof id !== 'string') return null;
  const re = new RegExp(`^${paramKey}=(.+)$`, 'i');
  const match = re.exec(id);
  if (!match) return null;
  try {
    return decodeURIComponent(match[1]).trim();
  } catch {
    return match[1].trim();
  }
};

/**
 * Ensures a profile exists for the given user.
 * If the user already has a profile, returns it.
 * Otherwise, creates a new profile and returns it.
 * 
 * @param {Object} strapi - The Strapi instance
 * @param {Object} user - The user object with id
 * @param {boolean} returnIdOnly - If true, returns only the profile ID instead of the full object
 * @returns {Promise<Object|number>} - The profile object or ID
 */
const ensureProfile = async (strapi, user, returnIdOnly = false) => {
  if (!user?.id) {
    throw new Error('ensureProfile: user with id is required');
  }

  // Fetch user with profile populated
  const populatedUser = await strapi.entityService.findOne(USERS_UID, user.id, {
    populate: { profile: true },
  });

  // If profile exists, return it
  if (populatedUser?.profile) {
    if (typeof populatedUser.profile === 'object') {
      // Profile is already populated
      return returnIdOnly ? populatedUser.profile.id : populatedUser.profile;
    }
    // Profile is just an ID, fetch it if we need the full object
    if (returnIdOnly) {
      return populatedUser.profile;
    }
    return await strapi.entityService.findOne(PROFILES_UID, populatedUser.profile);
  }

  // Create new profile and associate it to the user
  const newProfile = await strapi.documents(PROFILES_UID).create({
    data: { user: user.id },
    status: 'published',
  });

  return returnIdOnly ? newProfile.id : newProfile;
};

/**
 * Ensures a profile exists for the given user and returns its ID.
 * Convenience wrapper around ensureProfile.
 * 
 * @param {Object} strapi - The Strapi instance
 * @param {Object} user - The user object with id
 * @returns {Promise<number>} - The profile ID
 */
const ensureProfileId = async (strapi, user) => {
  return await ensureProfile(strapi, user, true);
};

module.exports = {
  getByPath,
  extractOwnerId,
  parseEmailParam,
  ensureProfile,
  ensureProfileId,
  USERS_UID,
  PROFILES_UID,
};

