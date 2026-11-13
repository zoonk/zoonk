import { defineRule } from "@oxlint/plugins";

const CENTERED = new Set(["DialogContent", "DialogHeader", "DialogFooter"]);

export default defineRule({
  createOnce(context) {
    return {
      ImportDeclaration(node) {
        if (!/(?:^|\/)dialog$/u.test(node.source.value)) {
          return;
        }

        for (const specifier of node.specifiers) {
          if (specifier.type === "ImportSpecifier" && CENTERED.has(specifier.imported.name)) {
            context.report({ messageId: "drawer", node: specifier });
          }
        }
      },
    };
  },
  meta: {
    docs: { description: "Drawer owns a phone's sheet and a computer's centered dialog." },
    messages: {
      drawer:
        "Use Drawer (`@zoonk/ui/components/drawer`) for a sheet on a phone and a centered dialog on a computer. DialogPopup, AlertDialog and SidePanel keep their own roles.",
    },
    schema: [],
    type: "problem",
  },
});
