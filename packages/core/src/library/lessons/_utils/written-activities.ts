import "server-only";
import { chooseServiceTier } from "@zoonk/ai/provider-options";
import { type PublishedLessonScreen } from "@zoonk/ai/tasks/lesson-spec/activity-plan";
import { writeLessonActivities } from "@zoonk/ai/tasks/lesson-writer/activities";
import { checkLessonPrograms } from "../../quality/lesson-program-checks";
import { type ConvertedScreen, toStepContent } from "../../steps/written-screens";
import { type toWritingContext } from "./lesson-writing-inputs";

type Analytics = Parameters<typeof writeLessonActivities>[0]["analytics"];

export const ACTIVITY_SERVICE_TIER = chooseServiceTier({ wait: "soon" });

type Written = { index: number; converted: ConvertedScreen };

/** Each written activity through core's validator, then its programs run as a learner's would be. */
export async function checkWrittenActivities({
  indexes,
  language,
  written,
}: {
  indexes: readonly number[];
  language: string;
  written: Awaited<ReturnType<typeof writeLessonActivities>>["data"];
}) {
  const screens: Written[] = indexes.map((index) => {
    const screen = written.find((entry) => entry.index === index)?.screen;

    return {
      converted: screen
        ? toStepContent(screen, { allowImage: true, language })
        : { ok: false, problems: ["The writer didn't write this screen."] },
      index,
    };
  });

  const programs = await checkLessonPrograms(screens.map(({ converted }) => converted));

  return screens.map(({ converted, index }, position) => ({
    converted,
    index,
    problems: [
      ...(converted.ok ? [] : converted.problems),
      ...programs.filter((problem) => problem.screen === position).map(({ problem }) => problem),
    ],
  }));
}

type CheckedActivity = Awaited<ReturnType<typeof checkWrittenActivities>>[number];

/**
 * Writes the activities, and once more those whose content or programs fail, with what failed.
 * Returns each planned screen with its stored content, or the problems that held it back, and the
 * model that wrote it, so a reviewer from another family reads it.
 */
export async function writeCheckedActivities({
  context,
  indexes,
  screens,
  analytics,
}: {
  context: ReturnType<typeof toWritingContext>;
  indexes: readonly number[];
  screens: readonly PublishedLessonScreen[];
  analytics?: Analytics;
}) {
  const write = (planned: readonly number[], earlier: readonly CheckedActivity[]) =>
    writeLessonActivities({
      ...context,
      analytics,
      indexes: planned,
      problems: earlier.flatMap(({ index, problems }) =>
        problems.map((problem) => ({ problem, screen: index, source: "check" as const })),
      ),
      screens,
      serviceTier: ACTIVITY_SERVICE_TIER,
    });

  const first = await write(indexes, []);

  const checked = await checkWrittenActivities({
    indexes,
    language: context.language,
    written: first.data,
  });

  const firstTry = checked.map((activity) => ({ ...activity, model: first.provenance.model }));
  const failed = checked.filter(({ problems }) => problems.length > 0);

  if (failed.length === 0) {
    return firstTry;
  }

  const second = await write(
    failed.map(({ index }) => index),
    failed,
  );

  const rechecked = await checkWrittenActivities({
    indexes: failed.map(({ index }) => index),
    language: context.language,
    written: second.data,
  });

  return firstTry.map((activity) => {
    const again = rechecked.find(({ index }) => index === activity.index);
    return again ? { ...again, model: second.provenance.model } : activity;
  });
}
