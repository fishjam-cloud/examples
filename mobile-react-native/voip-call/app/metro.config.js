const path = require('path');

const { getDefaultConfig } = require('expo/metro-config');

// The Fishjam VoIP packages are consumed from a local `web-client-sdk` checkout
// through `link:` (see ../README.md#local-sdk-checkout). Metro needs to be told
// about that tree explicitly: the symlinked sources live outside this app
// directory, and they resolve their own dependencies from the checkout's
// node_modules.
const projectRoot = __dirname;
const sdkRoot = path.resolve(projectRoot, '../../../../web-client-sdk');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [sdkRoot];

config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(sdkRoot, 'node_modules'),
];

// Keep a single copy of React and React Native. Without this the symlinked
// packages can pull the checkout's copies instead, which surfaces as
// "Invalid hook call" at runtime.
config.resolver.extraNodeModules = {
  'react': path.resolve(projectRoot, 'node_modules/react'),
  'react-native': path.resolve(projectRoot, 'node_modules/react-native'),
};

module.exports = config;
