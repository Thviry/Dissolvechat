import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "dissolve-core/crypto/e2ee": path.resolve(__dirname, "packages/dissolve-core/src/crypto/e2ee.js"),
      "dissolve-core/crypto/group": path.resolve(__dirname, "packages/dissolve-core/src/crypto/group.js"),
      "dissolve-core/crypto/keyfile": path.resolve(__dirname, "packages/dissolve-core/src/crypto/keyfile.js"),
      "dissolve-core/crypto/signing": path.resolve(__dirname, "packages/dissolve-core/src/crypto/signing.js"),
      "dissolve-core/crypto/encoding": path.resolve(__dirname, "packages/dissolve-core/src/crypto/encoding.js"),
      "dissolve-core/crypto": path.resolve(__dirname, "packages/dissolve-core/src/crypto/index.js"),
      "@components": path.resolve(__dirname, "client/src/components"),
      "@hooks": path.resolve(__dirname, "client/src/hooks"),
      "@protocol": path.resolve(__dirname, "client/src/protocol"),
      "@utils": path.resolve(__dirname, "client/src/utils"),
      "@config": path.resolve(__dirname, "client/src/config.js"),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.{js,mjs}"],
    globals: true,
  },
});
