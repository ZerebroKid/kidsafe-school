const path = require('path');
const {getDefaultConfig, mergeConfig} = require('@react-native/metro-config');

/**
 * Monorepo-aware Metro configuration for ZConnect.
 *
 * Same shape as apps/kids/metro.config.js. NativeWind wrapping is added in P1.2.3.
 *
 * @type {import('metro-config').MetroConfig}
 */

const workspaceRoot = path.resolve(__dirname, '../..');
const projectRoot = __dirname;

const baseConfig = getDefaultConfig(projectRoot);

baseConfig.watchFolders = [workspaceRoot];
baseConfig.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];
baseConfig.resolver.disableHierarchicalLookup = true;

module.exports = mergeConfig(baseConfig, {});
