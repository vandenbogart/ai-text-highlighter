import { defineConfig } from "eslint/config";
import tseslint from "typescript-eslint";

const noComments = {
  meta: {
    type: "problem",
    schema: [],
    messages: { forbidden: "Comments are forbidden." },
  },
  create(context) {
    return {
      Program() {
        for (const comment of context.sourceCode.getAllComments()) {
          context.report({ loc: comment.loc, messageId: "forbidden" });
        }
      },
    };
  },
};

export default defineConfig(
  { ignores: ["node_modules/", "dist/", "models/", ".scratch/"] },
  { linterOptions: { noInlineConfig: true } },
  tseslint.configs.recommended,
  {
    plugins: { local: { rules: { "no-comments": noComments } } },
    rules: { "local/no-comments": "error" },
  },
);
