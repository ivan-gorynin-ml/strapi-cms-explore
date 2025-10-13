'use strict';

/**
 * person controller
 */

const { createCoreController } = require('@strapi/strapi').factories;
const makeProfileFieldController = require('../../../utils/makeProfileFieldController');

const UID = 'api::person.person';

module.exports = createCoreController(UID, ({ strapi }) => {
  const securedCrudController = makeProfileFieldController({ strapi, UID, typeField: "person" });
  return {
    ...securedCrudController,
  };
});


