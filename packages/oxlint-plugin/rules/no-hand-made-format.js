import { defineRule } from "@oxlint/plugins";

const DATE_METHODS = new Set([
  "dateTime",
  "dateTimeRange",
  "relativeTime",
  "toLocaleDateString",
  "toLocaleTimeString",
]);

const DATE_OPTIONS = new Set([
  "dateStyle",
  "day",
  "hour",
  "minute",
  "month",
  "timeStyle",
  "weekday",
  "year",
]);

const DURATION = /(?<![\w.#/-])\d+(?:[.,]\d+)?[ \u00A0]?(?:h|hr|hrs|min|mins)(?![\w-]|\.\d)/u;

function isTest(context) {
  return /\.(?:test|spec)\.[cm]?[jt]sx?$/u.test(context.filename);
}

function hasDateOptions(call) {
  return call.arguments.some(
    (argument) =>
      argument.type === "ObjectExpression" &&
      argument.properties.some((property) => DATE_OPTIONS.has(property.key?.name)),
  );
}

function isDateCall(node) {
  const { callee } = node;

  if (callee.type !== "MemberExpression" || callee.computed) {
    return false;
  }

  const method = callee.property.name;
  return DATE_METHODS.has(method) || (method === "toLocaleString" && hasDateOptions(node));
}

/** A translator's note quotes an example ("such as “15 min”"); nobody reads it on a screen. */
function isTranslatorNote(node) {
  const { parent } = node;
  return parent?.type === "Property" && parent.key?.name === "description";
}

export default defineRule({
  createOnce(context) {
    function checkText(node, text) {
      if (typeof text === "string" && DURATION.test(text) && !isTest(context)) {
        context.report({ messageId: "duration", node });
      }
    }

    return {
      CallExpression(node) {
        if (isDateCall(node) && !isTest(context)) {
          context.report({ messageId: "date", node: node.callee.property });
        }
      },
      JSXText(node) {
        checkText(node, node.value);
      },
      Literal(node) {
        if (!isTranslatorNote(node)) {
          checkText(node, node.value);
        }
      },
      NewExpression(node) {
        const { callee } = node;

        if (
          callee.type === "MemberExpression" &&
          callee.object.name === "Intl" &&
          callee.property.name === "DateTimeFormat" &&
          !isTest(context)
        ) {
          context.report({ messageId: "date", node: callee });
        }
      },
      TemplateElement(node) {
        if (!isTranslatorNote(node.parent)) {
          checkText(node, node.value.cooked);
        }
      },
    };
  },

  meta: {
    docs: { description: "A screen's dates, times and durations come from the shared formatters." },
    messages: {
      date: "Format a date or a time with the shared formatters, by the role it has on the screen (`useFormatIsoDate` and `useFormatMomentDate` from `@zoonk/learn/dates`, `formatIsoDate` from `@zoonk/utils/date-format`), so every screen writes it one way.",
      duration:
        "Build a duration with `formatDuration` (`@zoonk/utils/duration`) instead of writing its number and unit by hand.",
    },
    schema: [],
    type: "problem",
  },
});
