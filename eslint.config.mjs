import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ["electron/**/*.cjs", "forge.config.cjs"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "renderer-out/**",
    "renderer-build/**",
    "build/**",
    "release/**",
    "dist-electron/**",
    "next-env.d.ts",
    /**
     * `next.config.ts` compila a `.next-dev` en desarrollo para no borrarle el
     * directorio al servidor durante un `build`. Sin esta entrada, `npm run
     * lint` analizaba los fragmentos minificados de esa carpeta y devolvía más
     * de diez mil incidencias de `node_modules` que enterraban las del código
     * propio: la orden era, en la práctica, inservible.
     */
    ".next-dev/**",
    // Fuentes, diccionarios y KaTeX se sirven tal cual desde el paquete original.
    "public/**",
  ]),
]);

export default eslintConfig;
