const path = require('path');
const {getDefaultConfig, mergeConfig} = require('@react-native/metro-config');

/**
 * Monorepo-aware Metro configuration for ZKid.
 *
 * Resolves shared workspace packages (@zerebro/shared-*) from the repo root.
 * Standard pnpm + Metro fix:
 *   - watchFolders includes the workspace root
 *   - nodeModulesPaths includes both project and workspace
 *   - disableHierarchicalLookup avoids hoist confusion
 *
 * NativeWind was wired in during P0 but never actually used (zero className=
 * usage anywhere). Its CSS-Interop runtime was rewriting <Pressable>'s
 * function-style style prop and stripping our explicit backgroundColor, which
 * made the Button component render with no visible background. Until we
 * actually adopt Tailwind classes, the cleanest path is to keep NativeWind
 * as a dev-time install (so the package + types stay) but remove it from
 * the Metro pipeline so the runtime is RN-only.
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
// Honor the `exports` field in package.json so subpath imports like
// `@zerebro/shared-firebase/auth` resolve through the conditional-exports
// map defined in packages/shared-firebase/package.json.
baseConfig.resolver.unstable_enablePackageExports = true;
baseConfig.resolver.unstable_conditionNames = ['react-native', 'require', 'default'];

module.exports = mergeConfig(baseConfig, {});
