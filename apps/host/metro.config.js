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

// Workspace packages use NodeNext-style relative imports ("./rules.js") that
// point at .ts sources; retry without the extension so Metro finds them.
config.resolver.resolveRequest = (context, moduleName, platform) => {
  // Node builtins (node:fs etc.) surface via @anthropic-ai/sdk's credential
  // helpers; they never execute on device, so stub them out.
  if (moduleName.startsWith("node:")) {
    return { type: "sourceFile", filePath: path.resolve(projectRoot, "shims/empty.js") };
  }
  if (moduleName.startsWith(".") && moduleName.endsWith(".js")) {
    try {
      return context.resolveRequest(context, moduleName, platform);
    } catch {
      return context.resolveRequest(context, moduleName.slice(0, -3), platform);
    }
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
