import { defineRule } from "@oxlint/plugins";

export default defineRule({
  createOnce(context) {
    return {
      ExportNamedDeclaration(node) {
        if (node.declaration?.type !== "VariableDeclaration") {
          return;
        }

        for (const { id } of node.declaration.declarations) {
          if (id.type === "Identifier" && id.name === "ANSWER_OPTION_CLASS") {
            context.report({ data: { name: id.name }, messageId: "answerOption", node: id });
          }
        }
      },
    };
  },

  meta: {
    docs: { description: "An answer option is drawn by `AnswerOption`." },
    messages: {
      answerOption:
        'A second {{name}}: draw an answer option with `AnswerOption` (`@zoonk/learn/answer-option`); pass `type="submit"` for a form.',
    },
    schema: [],
    type: "problem",
  },
});
