import { z } from "zod";
import { getActivityTemplate } from "./activity-templates";
import { type ActivityTemplate } from "./define-activity-template";

/**
 * The rules the JSON schema can't show: which check kinds the template
 * supports, whether choice options carry the value code compares, and whether
 * it shows data that must be cited or labeled as an example.
 */
function describeRules(template: ActivityTemplate): string {
  return [
    template.description,
    `Check kinds this template supports: ${template.checks.join(", ")}.`,
    template.choicesNeedValues && "Every choice option needs the `value` it stands for.",
    template.needsData &&
      'It shows data: set `data` to `{ "source": { ... } }` for real data or `{ "isExample": true }` for an example.',
  ]
    .filter(Boolean)
    .join(" ");
}

/** A template as the lesson writer reads it: what it teaches and the JSON schema of its content. */
export type WriterActivityTemplate = { description: string; id: string; schema: string };

/**
 * Describes the templates a lesson spec picked for the writer, with the JSON
 * schema of each one's content, so the writer fills exactly the fields the
 * activity validator checks. Unknown ids are left out.
 */
export function describeActivityTemplates(ids: readonly string[]): WriterActivityTemplate[] {
  return [...new Set(ids)].flatMap((id) => {
    const template = getActivityTemplate(id);

    if (!template) {
      return [];
    }

    const schema = z.toJSONSchema(template.content, { io: "input", unrepresentable: "any" });
    return [{ description: describeRules(template), id, schema: JSON.stringify(schema) }];
  });
}
