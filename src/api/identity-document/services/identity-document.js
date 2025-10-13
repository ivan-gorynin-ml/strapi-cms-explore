'use strict';

/**
 * identity-document service
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::identity-document.identity-document');
