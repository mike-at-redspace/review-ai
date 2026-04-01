import js from "@eslint/js";
import tseslint from "typescript-eslint";
import eslintConfigPrettier from "eslint-config-prettier/flat";

export default tseslint.config(
  {
    ignores: ["dist/**", "node_modules/**", "claude-src/**", "pnpm-lock.yaml"],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        ecmaFeatures: { jsx: true },
      },
      globals: {
        console: "readonly",
        process: "readonly",
        Buffer: "readonly",
      },
    },
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-explicit-any": "warn",
      "no-duplicate-imports": "off",
      "sort-imports": "off",
      "no-restricted-imports": [
        "warn",
        {
          patterns: [
            {
              group: ["@ui/hooks/*", "!@ui/hooks/index", "!@ui/hooks/index.js"],
              message:
                "Import from @ui/hooks barrel instead of deep hook paths.",
            },
            {
              group: [
                "@ui/context/*",
                "!@ui/context/index",
                "!@ui/context/index.js",
              ],
              message:
                "Import from @ui/context barrel instead of deep context paths.",
            },
            {
              group: [
                "@ui/components/*",
                "!@ui/components/index",
                "!@ui/components/index.js",
              ],
              message:
                "Import from @ui/components barrel instead of deep component paths.",
            },
          ],
        },
      ],
    },
  },
  eslintConfigPrettier
);
