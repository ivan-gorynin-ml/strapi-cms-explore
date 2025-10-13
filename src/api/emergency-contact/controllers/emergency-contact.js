'use strict';

/**
 * emergency-contact controller
 */

const { createCoreController } = require('@strapi/strapi').factories;

const UID = 'api::emergency-contact.emergency-contact';

const makeProfileFieldController = require('../../../utils/makeProfileFieldController');
module.exports = createCoreController(UID, ({ strapi }) => {
  const securedCrudController = makeProfileFieldController({ strapi, UID, typeField: "emergency_contacts", ownerHasMany: true });
  return {
    ...securedCrudController,
  };
});



