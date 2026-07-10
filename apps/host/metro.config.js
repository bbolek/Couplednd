// Metro config for a pnpm monorepo: watch the workspace root and resolve
// dependencies from both the app's and the root node_modules.
const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];

// Workspace packages use NodeNext-style relative imports ("./rules.js" for
// rules.ts). Metro doesn't map .js specifiers back to .ts sources, so retry
// without the extension when the literal path doesn't resolve.
const defaultResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const resolve = defaultResolveRequest ?? context.resolveRequest;
  try {
    return resolve(context, moduleName, platform);
  } catch (error) {
    if (moduleName.startsWith(".") && moduleName.endsWith(".js")) {
      return resolve(context, moduleName.slice(0, -3), platform);
    }
    throw error;
  }
};

module.exports = config;
