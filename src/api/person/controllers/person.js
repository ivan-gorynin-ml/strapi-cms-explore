'use strict';

/**
 * person controller
 */

const { createCoreController } = require('@strapi/strapi').factories;

const UID = 'api::person.person';

const makeProfileFieldController = require('../../../utils/makeProfileFieldController');
module.exports = createCoreController(UID, ({ strapi }) => {
  const securedCrudController = makeProfileFieldController({ strapi, UID, typeField: "person" });
  return {
    ...securedCrudController,
  };
});


