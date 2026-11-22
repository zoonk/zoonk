import "server-only";
import { type Goal, type Plan } from "@zoonk/db";
import { MS_PER_DAY } from "@zoonk/utils/date";
import { toIsoDate } from "../../../plans/planner/plan-calendar";
import { parsePlanSettings } from "../../../plans/planner/plan-state";
import { listMissingMockWriting } from "../written-test-plan";
import { type AnytimeMockSetup } from "./anytime-mock-setup";
import { readScheduledStructure } from "./read-mock-structure";

const WRITTEN_TESTS_AHEAD = 2;
const URGENT_DAYS = 3;

/** The plan's written tests have no plan item: their paper is their date, as a session start asks for it. */
export function planWrittenTestSupply({
  goal,
  setup,
}: {
  goal: Goal & { plan: Pick<Plan, "settings"> | null };
  setup: AnytimeMockSetup;
}) {
  const settings = parsePlanSettings(goal.plan?.settings);
  const since = toIsoDate(new Date(Date.now() - MS_PER_DAY));

  return (settings.writingSchedule ?? [])
    .filter((day) => day.test && day.date >= since)
    .slice(0, WRITTEN_TESTS_AHEAD)
    .flatMap((day) => {
      const date = new Date(day.date);

      const writing = listMissingMockWriting({
        essays: setup.essays,
        shape: { day: day.test?.day ?? null, kind: "written" },
        structure: readScheduledStructure({
          blueprint: setup.blueprint,
          date,
          goal,
          settings: goal.plan?.settings,
        }),
      });

      return writing.length > 0
        ? [
            {
              key: date.toISOString(),
              urgent: date.getTime() <= Date.now() + URGENT_DAYS * MS_PER_DAY,
              writing,
            },
          ]
        : [];
    });
}
