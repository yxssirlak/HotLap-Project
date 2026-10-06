const appJson = require('./app.json').expo;

module.exports = ({ config }) => {
  const mapsApiKey = process.env.GOOGLE_MAPS_API_KEY;
  const androidConfig = {
    ...config.android?.config,
    ...appJson.android?.config,
  };

  if (mapsApiKey) {
    androidConfig.googleMaps = {
      ...config.android?.config?.googleMaps,
      ...appJson.android?.config?.googleMaps,
      apiKey: mapsApiKey,
    };
  }

  return {
    ...config,
    ...appJson,
    android: {
      ...config.android,
      ...appJson.android,
      config: androidConfig,
    },
  };
};
