'use strict';

async function grantAuthenticatedPermissions(strapi, uid, actions) {
  // 1) Get the Authenticated role
  const authenticatedRole = await strapi.db
    .query('plugin::users-permissions.role')
    .findOne({ where: { type: 'authenticated' }, populate: ['permissions'] });

  if (!authenticatedRole) {
    strapi.log.warn('Authenticated role not found. Skipping permission bootstrap.');
    return;
  }

  // 2) Upsert the permissions
  for (const action of actions) {
    const actionKey = `${uid}.${action}`;

    const existing = await strapi.db
      .query('plugin::users-permissions.permission')
      .findOne({
        where: { action: actionKey, role: authenticatedRole.id },
      });

    if (existing) {
      if (!existing.enabled) {
        await strapi.db
          .query('plugin::users-permissions.permission')
          .update({
            where: { id: existing.id },
            data: { enabled: true },
          });
        strapi.log.info(`[permissions] Enabled ${actionKey} for Authenticated`);
      }
    } else {
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
  bootstrap(/*{ strapi }*/) {
    // Grant Find and Update permissions to the Authenticated role
    const ACTIONS = ['find', 'update'];
    grantAuthenticatedPermissions(strapi, 'api::user-general-info.user-general-info', ACTIONS);
    grantAuthenticatedPermissions(strapi, 'api::emergency-contact.emergency-contact', ACTIONS);
  },
};
