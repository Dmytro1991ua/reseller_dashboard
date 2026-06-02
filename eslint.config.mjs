import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts", "prisma/migrations/**"]),
  {
    rules: {
      // correctness
      "no-debugger": "error",
      eqeqeq: ["error", "smart"],
      "no-var": "error",
      "prefer-const": "error",

      // react / hooks
      "react/jsx-key": "error",
      "react-hooks/exhaustive-deps": "warn",
      "react-hooks/rules-of-hooks": "error",

      // console — warn so you notice strays, but they don't block builds
      "no-console": "warn",

      // typescript
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
  // Must be last — disables all ESLint rules that Prettier owns
  prettier,
]);

export default eslintConfig;
