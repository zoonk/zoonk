import { type AiCourseEstimateInputs } from "@/data/stats/ai/get-ai-cost-estimates";
import { Button, buttonVariants } from "@zoonk/ui/components/button";
import { Input } from "@zoonk/ui/components/input";
import { Label } from "@zoonk/ui/components/label";
import Link from "next/link";

/**
 * Course estimates need both the reporting window and the planned course shape.
 * A single GET form keeps those assumptions shareable in the URL and avoids any
 * client-side state for what is purely server-rendered analytics.
 */
export function AiEstimateFilters({
  actionHref,
  courseInputs,
  defaultCourseInputs,
  endDate,
  startDate,
}: {
  actionHref: string;
  courseInputs: AiCourseEstimateInputs;
  defaultCourseInputs: AiCourseEstimateInputs;
  endDate: string;
  startDate: string;
}) {
  return (
    <section className="flex flex-col gap-4">
      <header className="flex flex-col gap-1">
        <h2 className="text-base font-semibold tracking-tight">Estimate Inputs</h2>
        <p className="text-muted-foreground text-sm">
          Defaults come from the selected period when we have enough data. Override them to model a
          planned course before it exists end to end.
        </p>
      </header>

      <form action={actionHref} className="flex flex-col gap-6">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <FilterField htmlFor="from" label="From">
            <Input defaultValue={startDate} id="from" name="from" type="date" />
          </FilterField>

          <FilterField htmlFor="to" label="To">
            <Input defaultValue={endDate} id="to" name="to" type="date" />
          </FilterField>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <RegularCourseFieldset
            courseInputs={courseInputs}
            defaultCourseInputs={defaultCourseInputs}
          />
          <LanguageCourseFieldset
            courseInputs={courseInputs}
            defaultCourseInputs={defaultCourseInputs}
          />
        </div>

        <div className="flex items-center gap-2">
          <Button type="submit" variant="outline">
            Apply
          </Button>

          <Link className={buttonVariants({ variant: "ghost" })} href={actionHref}>
            Reset
          </Link>
        </div>
      </form>
    </section>
  );
}

/**
 * The estimate form repeats the same label-plus-input structure across both
 * course types. This wrapper keeps the layout readable and ensures each field
 * stays properly labeled for semantic queries and keyboard users.
 */
function FilterField({
  children,
  htmlFor,
  label,
}: {
  children: React.ReactNode;
  htmlFor: string;
  label: string;
}) {
  return (
    <div className="flex min-w-32 flex-col gap-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  );
}

/**
 * Regular-course defaults include both core and custom lesson counts, so the
 * helper copy should surface all three assumptions in one compact sentence.
 */
function describeRegularDefaults(courseInputs: AiCourseEstimateInputs) {
  return `${courseInputs.regularChapterCount.toLocaleString()} chapters, ${courseInputs.regularCoreLessonsPerChapter.toLocaleString()} core per chapter, ${courseInputs.regularCustomLessonsPerChapter.toLocaleString()} custom per chapter.`;
}

/**
 * Language-course defaults only need one lesson count per chapter, so the copy
 * can stay shorter while still making the assumption explicit.
 */
function describeLanguageDefaults(courseInputs: AiCourseEstimateInputs) {
  return `${courseInputs.languageChapterCount.toLocaleString()} chapters, ${courseInputs.languageLessonsPerChapter.toLocaleString()} language lessons per chapter.`;
}

/**
 * Regular-course planning needs three numeric inputs, so this fieldset keeps
 * that group isolated from the rest of the form and avoids excessive JSX
 * nesting in the parent component.
 */
function RegularCourseFieldset({
  courseInputs,
  defaultCourseInputs,
}: {
  courseInputs: AiCourseEstimateInputs;
  defaultCourseInputs: AiCourseEstimateInputs;
}) {
  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="text-sm font-medium">Regular Course Shape</legend>
      <p className="text-muted-foreground text-sm">
        Default: {describeRegularDefaults(defaultCourseInputs)}
      </p>

      <div className="grid gap-3 sm:grid-cols-3">
        <EstimateNumberField
          htmlFor="regularChapterCount"
          label="Chapters"
          min={1}
          name="regularChapterCount"
          value={courseInputs.regularChapterCount}
        />
        <EstimateNumberField
          htmlFor="regularCoreLessonsPerChapter"
          label="Core / Chapter"
          min={1}
          name="regularCoreLessonsPerChapter"
          value={courseInputs.regularCoreLessonsPerChapter}
        />
        <EstimateNumberField
          htmlFor="regularCustomLessonsPerChapter"
          label="Custom / Chapter"
          min={0}
          name="regularCustomLessonsPerChapter"
          value={courseInputs.regularCustomLessonsPerChapter}
        />
      </div>
    </fieldset>
  );
}

/**
 * Language-course planning only needs the chapter count and the number of
 * language lessons per chapter, so its fieldset can stay compact.
 */
function LanguageCourseFieldset({
  courseInputs,
  defaultCourseInputs,
}: {
  courseInputs: AiCourseEstimateInputs;
  defaultCourseInputs: AiCourseEstimateInputs;
}) {
  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="text-sm font-medium">Language Course Shape</legend>
      <p className="text-muted-foreground text-sm">
        Default: {describeLanguageDefaults(defaultCourseInputs)}
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        <EstimateNumberField
          htmlFor="languageChapterCount"
          label="Chapters"
          min={1}
          name="languageChapterCount"
          value={courseInputs.languageChapterCount}
        />
        <EstimateNumberField
          htmlFor="languageLessonsPerChapter"
          label="Language / Chapter"
          min={1}
          name="languageLessonsPerChapter"
          value={courseInputs.languageLessonsPerChapter}
        />
      </div>
    </fieldset>
  );
}

/**
 * Every course-shape input is the same labeled number field. This helper keeps
 * the estimate form consistent and removes repeated JSX from the fieldsets.
 */
function EstimateNumberField({
  htmlFor,
  label,
  min,
  name,
  value,
}: {
  htmlFor: string;
  label: string;
  min: number;
  name: string;
  value: number;
}) {
  return (
    <FilterField htmlFor={htmlFor} label={label}>
      <Input defaultValue={String(value)} id={htmlFor} min={min} name={name} type="number" />
    </FilterField>
  );
}
