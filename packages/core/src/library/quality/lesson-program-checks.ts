import "server-only";
import { activityContentSchema } from "../activities/activity-templates";
import { verifyActivityPrograms } from "../activities/programs/verify-activity-programs";
import { type ConvertedScreen } from "../steps/written-screens";
import { type LessonCheckProblem } from "./lesson-code-checks";

export async function checkLessonPrograms(
  screens: readonly ConvertedScreen[],
): Promise<LessonCheckProblem[]> {
  const activities = screens.flatMap((screen, index) => {
    const parsed =
      screen.ok && screen.kind === "activity"
        ? activityContentSchema.safeParse(screen.content)
        : null;

    return parsed?.success ? [{ content: parsed.data, index }] : [];
  });

  const issues = await verifyActivityPrograms(activities.map(({ content }) => content));

  return activities.flatMap(({ index }, position) =>
    (issues[position] ?? []).map((issue): LessonCheckProblem => ({
      code: "activityProgram",
      problem: `${issue.path}: ${issue.message}`,
      screen: index,
    })),
  );
}
