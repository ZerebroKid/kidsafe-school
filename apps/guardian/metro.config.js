const path = require('path');
const {getDefaultConfig, mergeConfig} = require('@react-native/metro-config');

/**
 * Monorepo-aware Metro configuration for ZConnect. Mirrors ZKid's shape.
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

module.exports = mergeConfig(baseConfig, {
  // Use port 8082 so guardian Metro runs in parallel with zkid (port 8081).
  server: {
    port: 8082,
  },

  // Exclude all Gradle build-output directories from the file watcher.
  // On Windows, Metro's FallbackWatcher throws ENOENT if these directories
  // don't exist yet (created on first Gradle build). Blocking them is safe —
  // Metro only needs to watch JS/TS source files.
  resolver: {
    blockList: [
      /.*[/\\]android[/\\]build[/\\].*/,
      /.*[/\\]node_modules[/\\].*[/\\]android[/\\]build[/\\].*/,
    ],
  },
});
