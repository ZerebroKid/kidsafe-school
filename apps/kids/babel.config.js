module.exports = {
  presets: [['module:@react-native/babel-preset']],
  // Required by react-native-reanimated (Zumi's interactive touch layer).
  // MUST be the last plugin. Changing this needs a Metro cache reset
  // (`react-native start --reset-cache`) + an app rebuild.
  plugins: ['react-native-reanimated/plugin'],
};
