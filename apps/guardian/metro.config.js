const path = require('path');
const {getDefaultConfig, mergeConfig} = require('@react-native/metro-config');
const {withNativeWind} = require('nativewind/metro');

/**
 * Monorepo-aware Metro configuration for ZConnect, with NativeWind.
 *
 * Mirrors apps/kids/metro.config.js shape so both RN apps share identical
 * resolution behaviour.
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

const merged = mergeConfig(baseConfig, {});

module.exports = withNativeWind(merged, {input: './global.css'});
