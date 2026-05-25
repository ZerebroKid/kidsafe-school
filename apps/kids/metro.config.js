const path = require('path');
const {getDefaultConfig, mergeConfig} = require('@react-native/metro-config');

/**
 * Monorepo-aware Metro configuration for ZKid.
 *
 * Resolves shared workspace packages (@zerebro/shared-*) from the repo root
 * while keeping React Native and other native deps hoisted via pnpm's
 * shamefully-hoist=true layout (see .npmrc).
 *
 * Standard fix for the Metro + pnpm workspace symlink issue.
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
