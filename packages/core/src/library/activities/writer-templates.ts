import { z } from "zod";
import { activityTemplates, getActivityTemplate, isExploreTemplate } from "./activity-templates";
import { type ActivityTemplate } from "./define-activity-template";

function describeRules(template: ActivityTemplate): string {
  return [
    template.description,
    `Check kinds this template supports: ${template.checks.join(", ")}.`,
    template.choicesNeedValues(null) && "Every choice option needs the `value` it stands for.",
    template.mayShowData &&
      'When it shows data, set `data` to `{ "source": { ... } }` for real data or `{ "isExample": true }` for an example.',
  ]
    .filter(Boolean)
    .join(" ");
}

export type WriterActivityTemplate = { description: string; id: string; schema: string };

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

export function listPlannerTemplates(): { description: string; explore: boolean; id: string }[] {
  return activityTemplates.map((template) => ({
    description: template.description,
    explore: isExploreTemplate(template.id),
    id: template.id,
  }));
}
