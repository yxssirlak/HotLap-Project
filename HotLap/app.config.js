const appJson = require('./app.json').expo;

module.exports = ({ config }) => {
  const fallbackMapsApiKey = process.env.GOOGLE_MAPS_API_KEY;
  const iosGoogleMapsApiKey = process.env.GOOGLE_MAPS_IOS_API_KEY || fallbackMapsApiKey;
  const androidGoogleMapsApiKey = process.env.GOOGLE_MAPS_ANDROID_API_KEY || fallbackMapsApiKey;
  const plugins = [...(appJson.plugins ?? config.plugins ?? [])];
  const mapsPluginIndex = plugins.findIndex(
    (plugin) => Array.isArray(plugin) && plugin[0] === 'react-native-maps',
  );

  if (iosGoogleMapsApiKey || androidGoogleMapsApiKey) {
    const mapsPlugin = [
      'react-native-maps',
      {
        ...(iosGoogleMapsApiKey ? { iosGoogleMapsApiKey } : {}),
        ...(androidGoogleMapsApiKey ? { androidGoogleMapsApiKey } : {}),
      },
    ];
    if (mapsPluginIndex >= 0) {
      plugins[mapsPluginIndex] = mapsPlugin;
    } else {
      plugins.push(mapsPlugin);
    }
  }

  const androidConfig = {
    ...config.android?.config,
    ...appJson.android?.config,
  };

  if (androidGoogleMapsApiKey) {
    androidConfig.googleMaps = {
      ...config.android?.config?.googleMaps,
      ...appJson.android?.config?.googleMaps,
      apiKey: androidGoogleMapsApiKey,
    };
  }

  return {
    ...config,
    ...appJson,
    plugins,
    android: {
      ...config.android,
      ...appJson.android,
      config: androidConfig,
    },
    ios: {
      ...config.ios,
      ...appJson.ios,
    },
    extra: {
      ...config.extra,
      ...appJson.extra,
      googleMapsConfigured: Boolean(iosGoogleMapsApiKey),
    },
  };
};
