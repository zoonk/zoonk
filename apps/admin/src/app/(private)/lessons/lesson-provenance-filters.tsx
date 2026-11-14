import { AdminQuerySelect } from "@/components/admin-query-select";
import {
  type StepProvenanceOption,
  listStepProvenanceOptions,
} from "@/data/lessons/list-step-provenance-options";
import { formatCount } from "@/lib/format";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { sumOf } from "@zoonk/utils/number";

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

/** The two selects wrap as a pair, so one never sits alone on the toolbar's next line. */
const PAIR_CLASS = "flex min-h-11 flex-wrap items-center gap-x-6 gap-y-2";

/**
 * Who wrote a lesson: the model and the prompt version. A model's versions are its own, so picking
 * a model drops the version picked before it.
 */
export async function LessonProvenanceFilters({ model }: { model?: string }) {
  "use cache: private";

  const options = await listStepProvenanceOptions();

  return (
    <div className={PAIR_CLASS}>
      <AdminQuerySelect
        allLabel="All models"
        clears="promptVersion"
        label="Model"
        name="model"
        options={toModelOptions(options)}
      />
      <AdminQuerySelect
        allLabel="All prompt versions"
        label="Prompt version"
        name="promptVersion"
        options={toPromptVersionOptions(options, model)}
      />
    </div>
  );
}

export function LessonProvenanceFiltersSkeleton() {
  return (
    <div className={PAIR_CLASS}>
      <Skeleton className="h-7.5 w-32 rounded-md" />
      <Skeleton className="h-7.5 w-44 rounded-md" />
    </div>
  );
}
