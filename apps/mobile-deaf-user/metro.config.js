const { getDefaultConfig } = require("expo/metro-config");

/** Dev-build asset extensions: TFLite + Nitro modules (react-native-nitro-modules). */
const assetExts = ["tflite", "ntro"];

/** Merge a custom config with Expo's defaults. */
const createConfig = (source, ...rest) => {
  const config = getDefaultConfig(source, ...rest);
  // Append assets so Metro can resolve .tflite bundles.
  config.resolver.assetExts = [...assetExts, ...(config.resolver.assetExts ?? [])];
  return config;
};

module.exports = createConfig(__dirname);
