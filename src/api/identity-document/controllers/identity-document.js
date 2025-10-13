'use strict';

/**
 * identity-document controller
 */

const { createCoreController } = require('@strapi/strapi').factories;

const UID = 'api::identity-document.identity-document';

const makeProfileFieldController = require('../../../utils/makeProfileFieldController');
module.exports = createCoreController(UID, ({ strapi }) => {
  const securedCrudController = makeProfileFieldController({ strapi, UID, typeField: "identity_document" });
  return {
    ...securedCrudController,
  };
});
