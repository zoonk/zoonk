import {
  Stop,
  StopBody,
  StopEyebrow,
  StopHeader,
  StopLead,
  StopMark,
  StopTitle,
} from "@/components/public/stop";
import { Variant } from "@/components/public/variant-switch";
import { KindDot, type LearnKind } from "@zoonk/learn/kind-tile";
import { getExtracted } from "next-intl/server";
import { type ReactNode } from "react";
import { getExamplePlans } from "./example-plans";
import {
  EXAMPLE_GOALS,
  type ExampleGoal,
  GOAL_SWITCH,
  daysBetween,
  getExampleCalendar,
} from "./landing-examples";
import { ExamPractice } from "./practice-exam";
import { JobPractice } from "./practice-job";
import { MovePractice } from "./practice-move";

const STOP_TITLE_ID = "stop-practice";

const DAYS_PER_WEEK = 7;

/** The kind of practice each example goal leads to, whose dot marks the stop. */
const PRACTICE_KIND: Record<ExampleGoal, LearnKind> = {
  exam: "mock",
  job: "practice",
  move: "conversation",
};

/** The week of the example plan the examples' `today` falls in, counted from its first day. */
function getPlanWeek({ start, today }: { start: Date | undefined; today: Date }): number {
  return start ? Math.floor(daysBetween({ from: start, to: today }) / DAYS_PER_WEEK) + 1 : 1;
}

/**
 * Practice, as the example goal the visitor picked needs it: an exam's format and its mocks, a
 * move's conversations out loud, a new job's real work. The heading says which, and the pair
 * under it shows it; the stop's mark is that practice's own dot.
 */
export async function StopPractice() {
  const t = await getExtracted();
  const plans = await getExamplePlans();
  const { today } = await getExampleCalendar();

  const weeks: Record<ExampleGoal, number> = {
    exam: getPlanWeek({ start: plans.exam.phases[0]?.start, today }),
    job: getPlanWeek({ start: plans.job.phases[0]?.start, today }),
    move: getPlanWeek({ start: plans.move.phases[0]?.start, today }),
  };

  const heads: Record<ExampleGoal, { eyebrow: string; lead: string; title: string }> = {
    exam: {
      eyebrow: t("Week {week, number} · mock exam", { week: weeks.exam }),
      lead: t(
        "Questions in your exam's format, and mock exams timed like the real one, with an estimated score.",
      ),
      title: t("Practice like the real exam."),
    },
    job: {
      eyebrow: t("Week {week, number} · real work", { week: weeks.job }),
      lead: t(
        "Problems from the job you want, checked as you go, and every mistake kept for later.",
      ),
      title: t("Practice on real work."),
    },
    move: {
      eyebrow: t("Week {week, number} · speaking", { week: weeks.move }),
      lead: t(
        "Say real sentences out loud, get tips on how you sound, and practice calls for the moments that matter.",
      ),
      title: t("Practice the conversations you'll have."),
    },
  };

  const bodies: Record<ExampleGoal, ReactNode> = {
    exam: <ExamPractice />,
    job: <JobPractice />,
    move: <MovePractice />,
  };

  return (
    <Stop aria-labelledby={STOP_TITLE_ID} rail>
      <StopHeader>
        <StopEyebrow>
          <StopMark>
            {EXAMPLE_GOALS.map((goal) => (
              <Variant as="span" className="flex" key={goal} name={GOAL_SWITCH} value={goal}>
                <KindDot className="size-2.5" kind={PRACTICE_KIND[goal]} />
              </Variant>
            ))}
          </StopMark>
          {EXAMPLE_GOALS.map((goal) => (
            <Variant as="span" key={goal} name={GOAL_SWITCH} value={goal}>
              {heads[goal].eyebrow}
            </Variant>
          ))}
        </StopEyebrow>

        <StopTitle id={STOP_TITLE_ID}>
          {EXAMPLE_GOALS.map((goal) => (
            <Variant as="span" key={goal} name={GOAL_SWITCH} value={goal}>
              {heads[goal].title}
            </Variant>
          ))}
        </StopTitle>

        <StopLead>
          {EXAMPLE_GOALS.map((goal) => (
            <Variant as="span" key={goal} name={GOAL_SWITCH} value={goal}>
              {heads[goal].lead}
            </Variant>
          ))}
        </StopLead>
      </StopHeader>

      <StopBody>
        {EXAMPLE_GOALS.map((goal) => (
          <Variant key={goal} name={GOAL_SWITCH} value={goal}>
            {bodies[goal]}
          </Variant>
        ))}
      </StopBody>
    </Stop>
  );
}
