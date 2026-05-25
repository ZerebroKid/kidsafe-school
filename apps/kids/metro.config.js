const path = require('path');
const {getDefaultConfig, mergeConfig} = require('@react-native/metro-config');
const {withNativeWind} = require('nativewind/metro');

/**
 * Monorepo-aware Metro configuration for ZKid, with NativeWind (Tailwind for RN).
 *
 * Resolves shared workspace packages (@zerebro/shared-*) from the repo root.
 * Standard pnpm + Metro fix:
 *   - watchFolders includes the workspace root
 *   - nodeModulesPaths includes both project and workspace
 *   - disableHierarchicalLookup avoids hoist confusion
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
