const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");
const fs = require("fs");

const projectRoot = __dirname;
const config = getDefaultConfig(projectRoot);

// Resolve @/ alias → project root with extension detection
//
// v43 fix: @supabase/supabase-js@2.106.1 ESM build (dist/index.mjs)
// contains a Hermes-incompatible dynamic import:
//   import(/* webpackIgnore: true */ /* turbopackIgnore: true */
//         /* @vite-ignore */ OTEL_PKG)
// Hermes' precompiler rejects this in release with
//   "Invalid expression encountered" at byte 118528:57.
// Forcing the package's CommonJS entrypoint (dist/index.cjs) replaces
// that expression with `Promise.resolve(OTEL_PKG).then(s => require(s))`,
// which Hermes accepts.
const supabaseCjsPath = path.join(
  projectRoot,
  "node_modules",
  "@supabase",
  "supabase-js",
  "dist",
  "index.cjs"
);

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === "@supabase/supabase-js" || moduleName === "@supabase/supabase-js/") {
    return { filePath: supabaseCjsPath, type: "sourceFile" };
  }
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
