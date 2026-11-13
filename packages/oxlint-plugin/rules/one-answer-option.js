import { defineRule } from "@oxlint/plugins";

const PIECE = new Set(["ANSWER_OPTION_CLASS", "AnswerOptionContent"]);

function declaredNames(declaration) {
  if (!declaration) {
    return [];
  }

  if (declaration.type === "VariableDeclaration") {
    return declaration.declarations.map((declarator) => declarator.id);
  }

  return declaration.id ? [declaration.id] : [];
}

export default defineRule({
  createOnce(context) {
    return {
      ExportNamedDeclaration(node) {
        for (const id of declaredNames(node.declaration)) {
          if (id.type === "Identifier" && PIECE.has(id.name)) {
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
