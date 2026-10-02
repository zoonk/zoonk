import { AdminFilterNav } from "@/components/admin-filter-nav";
import { AdminQuerySelect } from "@/components/admin-query-select";
import { AdminSearch } from "@/components/admin-search";
import { countLessonsForRegeneration } from "@/data/lessons/count-lessons-for-regeneration";
import {
  type StepProvenanceOption,
  listStepProvenanceOptions,
} from "@/data/lessons/list-step-provenance-options";
import { buildAdminHref } from "@/lib/admin-href";
import {
  type LibraryLessonStatus,
  libraryLessonStatusLabels,
  libraryLessonStatuses,
} from "@/lib/library-lesson-filters";
import { MAX_LESSONS_PER_REGENERATION } from "@zoonk/core/library/lessons/regeneration-filter";
import { RegenerateLessonsForm } from "./regenerate-lessons-form";

type LibraryLessonFilterValues = {
  model?: string;
  promptVersion?: string;
  search?: string;
  status: LibraryLessonStatus;
};

/** Distinct values with how many screens each wrote, most used first. */
function toModelOptions(options: StepProvenanceOption[]) {
  const screensByModel = Map.groupBy(options, (option) => option.model);

  return [...screensByModel].map(([model, rows]) => ({
    label: `${model} (${rows.reduce((total, row) => total + row.screens, 0)} screens)`,
    value: model,
  }));
}

/** Prompt versions are hashes, so each option names the model that used it. */
function toPromptVersionOptions(options: StepProvenanceOption[], model?: string) {
  return options
    .filter((option) => !model || option.model === model)
    .map((option) => ({
      label: `${option.promptVersion} · ${option.model} (${option.screens} screens)`,
      value: option.promptVersion,
    }));
}

/**
 * Library filters: search, writing status, and the model and prompt version that wrote the
 * screens. With a model or prompt version picked, the matching published lessons can be
 * rewritten from here.
 */
export async function LibraryLessonFilters({
  model,
  promptVersion,
  search,
  status,
}: LibraryLessonFilterValues) {
  "use cache: private";

  const hasProvenanceFilter = Boolean(model ?? promptVersion);

  const [options, matching] = await Promise.all([
    listStepProvenanceOptions(),
    hasProvenanceFilter ? countLessonsForRegeneration({ model, promptVersion }) : 0,
  ]);

  return (
    <div className="flex flex-col gap-3">
      <AdminSearch placeholder="Search by lesson, chapter, or course..." />

      <div className="flex flex-wrap items-center gap-2">
        <AdminFilterNav
          label="Writing status"
          options={libraryLessonStatuses.map((item) => ({
            href: buildAdminHref({
              params: { model, promptVersion, search, status: item === "all" ? undefined : item },
              path: "/lessons",
            }),
            isActive: item === status,
            label: libraryLessonStatusLabels[item],
          }))}
        />

        <AdminQuerySelect
          allLabel="All models"
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

      {hasProvenanceFilter ? (
        <RegenerateLessonsForm
          batchSize={MAX_LESSONS_PER_REGENERATION}
          matching={matching}
          model={model}
          promptVersion={promptVersion}
        />
      ) : null}
    </div>
  );
}
