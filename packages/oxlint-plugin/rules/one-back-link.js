import { defineRule } from "@oxlint/plugins";

const BACK = new Set(["ArrowLeftIcon", "ChevronLeftIcon"]);

export default defineRule({
  createOnce(context) {
    return {
      ImportDeclaration(node) {
        if (node.source.value !== "lucide-react") {
          return;
        }

        for (const specifier of node.specifiers) {
          if (specifier.type === "ImportSpecifier" && BACK.has(specifier.imported.name)) {
            context.report({ messageId: "back", node: specifier });
          }
        }
      },
    };
  },
  meta: {
    docs: { description: "A page's back glyph and label are drawn by BackLink." },
    messages: {
      back: "Back is BackLink (`@zoonk/ui/components/page-top`): a chevron and the destination page's name. A task keeps its ✕.",
    },
    schema: [],
    type: "problem",
  },
});
