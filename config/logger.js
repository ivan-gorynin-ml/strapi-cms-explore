'use strict';

module.exports = ({ env }) => {
  const isDev = env('NODE_ENV', 'development') === 'development';

  return {
    level: env('LOG_LEVEL', isDev ? 'debug' : 'info'),
  };
};
