import { type StepKind } from "@zoonk/db";
import { isJsonObject } from "@zoonk/utils/json";
import { isExploreTemplate } from "../../library/activities/activity-templates";
import { safeParseStepContent } from "../../library/steps/contract/step-contract";

/** Stored screens can name an explore widget a release removed; the explanation's text still plays. */
export function safeParsePlayableContent<TKind extends StepKind>({
  content,
  kind,
}: {
  content: unknown;
  kind: TKind;
}) {
  const retiredWidget =
    kind === "explanation" &&
    isJsonObject(content) &&
    isJsonObject(content.explore) &&
    typeof content.explore.template === "string" &&
    !isExploreTemplate(content.explore.template);

  return safeParseStepContent(kind, retiredWidget ? { ...content, explore: undefined } : content);
}
