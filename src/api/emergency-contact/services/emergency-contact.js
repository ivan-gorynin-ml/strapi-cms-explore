'use strict';

/**
 * emergency-contact service
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::emergency-contact.emergency-contact');
