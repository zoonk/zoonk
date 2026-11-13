import { countLessonsForRegeneration } from "@/data/lessons/count-lessons-for-regeneration";
import {
  type StepProvenanceOption,
  listStepProvenanceOptions,
} from "@/data/lessons/list-step-provenance-options";
import { formatCount } from "@/lib/format";
import { MAX_LESSONS_PER_REGENERATION } from "@zoonk/core/library/lessons/regeneration-filter";
import { sumOf } from "@zoonk/utils/number";
import { RewriteLessonsDialog } from "./rewrite-lessons-dialog";

function toModelOptions(options: StepProvenanceOption[]) {
  const byModel = Map.groupBy(options, (option) => option.model);

  return [...byModel].map(([model, rows]) => ({
    label: `${model} (${formatCount(sumOf(rows.map((row) => row.screens)), "screen")})`,
    value: model,
  }));
}

/** Prompt versions are hashes, so each option names the models that used it. */
function toPromptVersionOptions(options: StepProvenanceOption[], model?: string) {
  const byVersion = Map.groupBy(
    options.filter((option) => !model || option.model === model),
    (option) => option.promptVersion,
  );

  return [...byVersion].map(([promptVersion, rows]) => ({
    label: `${promptVersion} · ${rows.map((row) => row.model).join(", ")} (${formatCount(sumOf(rows.map((row) => row.screens)), "screen")})`,
    value: promptVersion,
  }));
}

/**
 * Rewrites the lessons a model or a prompt version wrote. Picking one narrows the list behind the
 * dialog to what would be rewritten, and the dialog says how many that is.
 */
export async function RewriteLessons({
  model,
  promptVersion,
}: {
  model?: string;
  promptVersion?: string;
}) {
  "use cache: private";

  const [options, matching] = await Promise.all([
    listStepProvenanceOptions(),
    model || promptVersion ? countLessonsForRegeneration({ model, promptVersion }) : null,
  ]);

  return (
    <RewriteLessonsDialog
      batchSize={MAX_LESSONS_PER_REGENERATION}
      matching={matching}
      model={model}
      modelOptions={toModelOptions(options)}
      promptVersion={promptVersion}
      promptVersionOptions={toPromptVersionOptions(options, model)}
    />
  );
}
