'use strict';

const { createCoreController } = require('@strapi/strapi').factories;
const makeSecuredCrudController = require('../../../utils/makeSecuredCrudController');

const UID = 'api::user-general-info.user-general-info';

module.exports = createCoreController(UID, ({ strapi }) => {
  const securedCrudController = makeSecuredCrudController({ strapi, UID, typeField: "user_general_info" });
  return {
    ...securedCrudController,
  };
});
