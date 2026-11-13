import { defineRule } from "@oxlint/plugins";
import { isImportedName } from "../utils/jsx.js";

export default defineRule({
  createOnce(context) {
    return {
      Identifier(node) {
        if (node.name === "QUESTION_TEXT_CLASS" && !isImportedName(node)) {
          context.report({ messageId: "title", node });
        }
      },
    };
  },

  meta: {
    docs: { description: "A question's title is drawn by `QuestionTitle`." },
    messages: {
      title:
        "Draw a question's title with `QuestionTitle` (`@zoonk/learn/question-title`), which sets its size on every screen.",
    },
    schema: [],
    type: "problem",
  },
});
