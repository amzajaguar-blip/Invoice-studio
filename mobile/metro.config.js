const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");
const fs = require("fs");

const projectRoot = __dirname;
const config = getDefaultConfig(projectRoot);

// Resolve @/ alias → project root with extension detection
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName.startsWith("@/")) {
    const basePath = path.resolve(projectRoot, moduleName.slice(2));
    const extensions = ["ts", "tsx", "js", "jsx", "json", "mjs", "cjs"];

    // Try exact path first
    if (fs.existsSync(basePath) && fs.statSync(basePath).isFile()) {
      return { filePath: basePath, type: "sourceFile" };
    }

    // Try with extensions
    for (const ext of extensions) {
      const candidate = `${basePath}.${ext}`;
      if (fs.existsSync(candidate)) {
        return { filePath: candidate, type: "sourceFile" };
      }
    }

    // Try index file inside directory
    for (const ext of extensions) {
      const candidate = path.join(basePath, `index.${ext}`);
      if (fs.existsSync(candidate)) {
        return { filePath: candidate, type: "sourceFile" };
      }
    }
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
