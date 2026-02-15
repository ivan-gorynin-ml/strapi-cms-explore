'use strict';

/**
 * Cloudinary health-check ping — runs once on bootstrap.
 */
async function cloudinaryPing(strapi) {
  const cloudName = process.env.CLOUDINARY_NAME;
  const apiKey = process.env.CLOUDINARY_KEY;
  const apiSecret = process.env.CLOUDINARY_SECRET;

  const missing = [];
  if (!cloudName) missing.push('CLOUDINARY_NAME');
  if (!apiKey) missing.push('CLOUDINARY_KEY');
  if (!apiSecret) missing.push('CLOUDINARY_SECRET');

  if (missing.length > 0) {
    strapi.log.warn(
      `[Cloudinary] Missing env vars: ${missing.join('/')}; skipping ping`
    );
    return;
  }

  try {
    const cloudinary = require('cloudinary').v2;
    cloudinary.config({
      cloud_name: cloudName,
      api_key: apiKey,
      api_secret: apiSecret,
    });

    const res = await cloudinary.api.ping();
    strapi.log.info(`[Cloudinary] Ping OK — status: ${res && res.status}`);
  } catch (err) {
    strapi.log.error(
      `[Cloudinary] Ping FAILED — ${err.message}. Uploads may fail!`
    );
    strapi.log.error(`[Cloudinary] Stack: ${err.stack}`);
  }
}

async function setAuthenticatedPermissions(strapi, uid, actions) {
  // 1) Get the Authenticated role
  const authenticatedRole = await strapi.db
    .query('plugin::users-permissions.role')
    .findOne({ where: { type: 'authenticated' }, populate: ['permissions'] });

  if (!authenticatedRole) {
    strapi.log.warn('Authenticated role not found. Skipping permission bootstrap.');
    return;
  }

  // 2) Upsert the permissions for the specified actions
  for (const action of actions) {
    const actionKey = `${uid}.${action}`;

    const existing = await strapi.db
      .query('plugin::users-permissions.permission')
      .findOne({
        where: { action: actionKey, role: authenticatedRole.id },
      });

    if (!existing) {
      await strapi.db
        .query('plugin::users-permissions.permission')
        .create({
          data: {
            action: actionKey,
            role: authenticatedRole.id,
            enabled: true,
          },
        });
      strapi.log.info(`[permissions] Created+enabled ${actionKey} for Authenticated`);
    }
  }

  // 3) Disable permissions that are enabled but not in the actions list
  const allPermissions = await strapi.db
    .query('plugin::users-permissions.permission')
    .findMany({
      where: { role: authenticatedRole.id },
    });

  const actionKeys = actions.map(action => `${uid}.${action}`);

  for (const permission of allPermissions) {
    // Check if this permission belongs to the current uid
    if (permission.action.startsWith(`${uid}.`)) {
      // If it's enabled but not in our actions list, disable it
      if (!actionKeys.includes(permission.action)) {
        await strapi.db
          .query('plugin::users-permissions.permission')
          .delete({
            where: { id: permission.id },
          });
        strapi.log.info(`[permissions] Disabled ${permission.action} for Authenticated (not in allowed actions)`);
      }
    }
  }
}

module.exports = {
  /**
   * An asynchronous register function that runs before
   * your application is initialized.
   *
   * This gives you an opportunity to extend code.
   */
  register(/*{ strapi }*/) {},

  /**
   * An asynchronous bootstrap function that runs before
   * your application gets started.
   *
   * This gives you an opportunity to set up your data model,
   * run jobs, or perform some special logic.
   */
  async bootstrap(/*{ strapi }*/) {
    // ── Cloudinary health check ──
    await cloudinaryPing(strapi);

    // Grant Find and Update permissions to the Authenticated role
    const FIND_NO_FINDONE_ACTIONS = ['find'];
    const FIND_ACTIONS = [...FIND_NO_FINDONE_ACTIONS, 'findOne'];
    const FIND_UPDATE_ACTIONS = [...FIND_ACTIONS, 'update'];
    const FIND_NO_FINDONE_UPDATE_ACTIONS = [...FIND_NO_FINDONE_ACTIONS, 'update'];

    setAuthenticatedPermissions(strapi, 'api::profile.profile', FIND_ACTIONS);
    setAuthenticatedPermissions(strapi, 'api::person.person', FIND_UPDATE_ACTIONS);
    setAuthenticatedPermissions(strapi, 'api::identity-document.identity-document', FIND_UPDATE_ACTIONS);
    setAuthenticatedPermissions(strapi, 'api::emergency-contact.emergency-contact', FIND_NO_FINDONE_UPDATE_ACTIONS);

    strapi.log.warn(`[upload-ext] provider=${strapi.config.get('plugin::upload.provider')}`);
  },
};
