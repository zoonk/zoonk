import { defineRule } from "@oxlint/plugins";

export default defineRule({
  createOnce(context) {
    return {
      JSXOpeningElement(node) {
        const path = context.filename.replaceAll("\\", "/");

        if (path.includes("/packages/ui/") || /\.(?:test|spec)\.[cm]?[jt]sx?$/u.test(path)) {
          return;
        }

        const role = node.attributes.find(
          (attribute) => attribute.type === "JSXAttribute" && attribute.name.name === "role",
        )?.value;

        const value = role?.type === "JSXExpressionContainer" ? role.expression : role;

        if (value?.type === "Literal" && ["dialog", "alertdialog"].includes(value.value)) {
          context.report({ messageId: "panel", node });
        }
      },
    };
  },
  meta: {
    docs: { description: "Dialog roles belong to the shared overlay pieces." },
    messages: {
      panel:
        "Use the shared Drawer, Dialog, AlertDialog or SidePanel piece instead of assigning a dialog role here.",
    },
    schema: [],
    type: "problem",
  },
});
