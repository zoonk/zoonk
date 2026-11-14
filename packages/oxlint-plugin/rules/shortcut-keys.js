import { defineRule } from "@oxlint/plugins";
import { elementName } from "../utils/jsx.js";

const MAIN_ACTIONS = /^(?:EnterButton|OnboardingPrimaryButton|QuestionMainAction|TaskMainButton)$/u;

const BUSY = /^(?:is)?(?:pending|saving|submitting)$/iu;

const OWN_LISTENERS = [
  "/packages/learn/src/feedback/use-screen-keys-pause.ts",
  "/packages/learn/src/mind-maps/use-pan-zoom.ts",
];

function outsideKit(context) {
  return !context.filename.replaceAll("\\", "/").includes("/packages/ui/src/");
}

export default defineRule({
  createOnce(context) {
    return {
      Program(node) {
        if (!/\.tsx?$/u.test(context.filename) || /\.test\.tsx?$/u.test(context.filename)) {
          return;
        }

        const source = context.sourceCode.text;

        if (
          (outsideKit(context) && /\buseKeyboardCallback\(/u.test(source)) ||
          /export function useKeyboardCallback\b/u.test(source)
        ) {
          context.report({ messageId: "rawHook", node });
        }

        if (/\bcloseOnEscape\b/u.test(source)) {
          context.report({ messageId: "escape", node });
        }

        if (
          outsideKit(context) &&
          /addEventListener\(\s*["']key(?:down|up|press)["']/u.test(source) &&
          /\.(?:key|code)\b/u.test(source) &&
          !OWN_LISTENERS.some((file) => context.filename.replaceAll("\\", "/").endsWith(file))
        ) {
          context.report({ messageId: "listener", node });
        }
      },
      JSXOpeningElement(node) {
        const props = node.attributes.filter((attr) => attr.type === "JSXAttribute");
        const prop = (name) => props.find((attr) => attr.name.name === name);
        const announced = prop("aria-keyshortcuts")?.value;

        const value =
          announced?.type === "JSXExpressionContainer" ? announced.expression : announced;

        const name = elementName(node);

        if (outsideKit(context) && value?.type === "Literal" && typeof value.value === "string") {
          context.report({ messageId: "announced", node });
        }

        if (
          outsideKit(context) &&
          name === "ShortcutKbd" &&
          (!node.selfClosing || !prop("shortcut"))
        ) {
          context.report({ messageId: "keycap", node });
        }

        if (
          MAIN_ACTIONS.test(name) &&
          BUSY.test(prop("disabled")?.value?.expression?.name ?? "") &&
          !prop("busy")
        ) {
          context.report({ messageId: "busy", node });
        }
      },
    };
  },
  meta: {
    docs: {
      description:
        "Shortcut listeners, announcements and hints belong to the shared keyboard pieces.",
    },
    messages: {
      announced: "Announce this key with shortcutKeys(), from the shared shortcut list.",
      busy: "Pass this action's pending state as busy, so its hint becomes a spinner while it works.",
      escape: "The shared overlay handles Esc; don't add a per-screen closeOnEscape switch.",
      keycap:
        "Use a self-closing ShortcutKbd with its shortcut prop, so its hint comes from the shared list.",
      listener: "Bind global shortcut keys in the shared keyboard pieces.",
      rawHook: "Use the shared shortcut pieces instead of a raw useKeyboardCallback hook.",
    },
    schema: [],
    type: "problem",
  },
});
