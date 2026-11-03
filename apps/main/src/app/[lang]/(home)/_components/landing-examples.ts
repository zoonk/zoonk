import { getCourseExamDaysByRoute } from "@zoonk/core/catalog/course-exam-days-by-route";
import { getIsoDay } from "@zoonk/utils/calendar-day";
import { getSupportedLocaleFromLanguage } from "@zoonk/utils/locale";
import { logError } from "@zoonk/utils/logger";
import { unstable_rethrow } from "next/navigation";
import { lang } from "next/root-params";
import { type ExamExample, type ExampleSet } from "./example-set";
import { getLocaleExampleSet } from "./locale-example-sets";
import { getNextSitting } from "./next-sitting";

export async function getExampleSet(): Promise<ExampleSet> {
  return getLocaleExampleSet(getSupportedLocaleFromLanguage(await lang()));
}

/** Noon UTC is the same day in every time zone. */
function exampleDay(isoDate: string): Date {
  return new Date(`${isoDate}T12:00:00Z`);
}

type ExampleDays = { examDay: string | null; today: string };

/** Cached so the page stays prerendered; the default cache lifetime works it out again soon after the day changes. */
async function getCachedExampleDays({
  course,
  timeZone,
}: Pick<ExamExample, "course" | "timeZone">): Promise<ExampleDays> {
  "use cache";

  const found = course ? await getCourseExamDaysByRoute(course) : null;

  const today = getIsoDay({ now: new Date(), timeZone: found?.timeZone ?? timeZone });
  return { examDay: found?.days.find((day) => day > today) ?? null, today };
}

async function getExampleDays({ course, timeZone }: ExamExample): Promise<ExampleDays> {
  try {
    return await getCachedExampleDays({ course, timeZone });
  } catch (error) {
    // Next's own signals (a prerender's interrupted request) must keep propagating.
    unstable_rethrow(error);
    logError("Landing example days failed", { error });

    return getCachedExampleDays({ timeZone });
  }
}

/** The exam example's next sitting, so the goal box never suggests a date that's gone. */
export async function getExampleExamDay(): Promise<Date> {
  const { exam } = await getExampleSet();
  const { examDay, today } = await getExampleDays(exam);

  return exampleDay(examDay ?? getNextSitting({ sittings: exam.sittings, today }));
}
