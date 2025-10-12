'use strict';

/**
 * emergency-contact controller
 */

const { createCoreController } = require('@strapi/strapi').factories;
const makeSecuredCrudController = require('../../../utils/makeSecuredCrudController');

const UID = 'api::emergency-contact.emergency-contact';

module.exports = createCoreController(UID, ({ strapi }) => {
  const securedCrudController = makeSecuredCrudController({ strapi, UID, typeField: "emergency_contacts", ownerHasMany: true });
  return {
    ...securedCrudController,
  };
});


