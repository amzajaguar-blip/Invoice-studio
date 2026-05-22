const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;

const config = getDefaultConfig(projectRoot);

// Resolve @ alias to project root (matches tsconfig.json paths: "@/*": ["./*"])
config.resolver.alias = {
  ...config.resolver.alias,
  "@": path.resolve(projectRoot),
};

module.exports = config;
