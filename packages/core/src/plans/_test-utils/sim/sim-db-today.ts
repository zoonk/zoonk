import { prisma } from "@zoonk/db";
import { runDeferredWork } from "../../../_test-utils/deferred-work";
import { replanGoalsWaitingOnSkills } from "../../../library/curriculum/replan-waiting-goals";
import { getTodayStudySession } from "../../../sessions/_test-utils/open-today";
import { decidePlanChange } from "../../decide-plan-change";
import { PHASE_DATES_SOURCE } from "../../plan-change-contract";
import { addDays, toIsoDate } from "../../planner/plan-calendar";
import { type RuleEvent } from "../rules/rule-context";
import { writeSimLessons } from "./sim-db-lessons";
import { type DbRunner, recordDb } from "./sim-db-runner";
import { landSimSkills } from "./sim-landing";
import { listStandInSkills, shortHash } from "./sim-session";

/**
 * The database tier's Today: the day's first look, what lands for it, and the learner's answers
 * there, through the real capabilities.
 */

/**
 * What a system run is to the checks: the first planning run of a day settles the days before it
 * (a `newDay`, studied when the learner finished or tested out something of the plan on the last
 * day Today gave them a session: a day of reviews alone, or one they opened and left, is missed),
 * whatever started it, a landing included; a later run that day is `later`.
 */
async function toRunEvent(runner: DbRunner, later: RuleEvent): Promise<RuleEvent> {
  const day = toIsoDate(runner.today);

  if (runner.ranDays.has(day)) {
    return later;
  }

  runner.ranDays.add(day);

  const last = await prisma.studySession.findFirst({
    orderBy: { localDate: "desc" },
    select: { localDate: true },
    where: { goalId: runner.goal.id, localDate: { lt: runner.today } },
  });

  const progress = last
    ? await prisma.planItem.count({
        where: {
          completedAt: { gte: last.localDate, lt: addDays(last.localDate, 1) },
          planId: runner.plan.id,
        },
      })
    : 0;

  return { kind: "newDay", studied: progress > 0 };
}

/** The Library outlines skills (short ids) and the goals waiting on them re-plan, as a workflow does. */
export async function landDb(
  runner: DbRunner,
  { shortIds, step }: { shortIds: string[]; step: number },
) {
  const landed = await landSimSkills({
    goal: runner.goal,
    library: runner.library,
    skills: shortIds,
  });

  if (runner.questions) {
    await writeSimLessons({ lessons: landed, library: runner.library });
  }

  await replanGoalsWaitingOnSkills({ skillIds: shortIds.map((id) => runner.library.toId(id)) });

  await recordDb(runner, {
    event: await toRunEvent(runner, { kind: "outlinesLanded" }),
    label: "land",
    step,
  });
}

/** The skills the plan holds stand-ins for (due by `until`), by short id. */
export function listWaitingDb(runner: DbRunner, until: Date | null): string[] {
  return listStandInSkills({ items: runner.last?.items ?? [], until }).map((id) =>
    runner.library.short(id),
  );
}

/**
 * The day's first look at Today: what was outlined ahead lands, then the day's session is built
 * (which settles the plan first). Later looks the same day read the session as built.
 */
export async function openTodayDb(runner: DbRunner, step: number) {
  const day = toIsoDate(runner.today);
  const first = !runner.opened.has(day);

  // The Library outlines what the plan needs soon ahead of time; now and then it's late.
  const soon = first
    ? listWaitingDb(runner, addDays(runner.today, 2)).filter(
        (shortId) => shortHash(`${runner.life.seed}:${shortId}`) % 10 !== 0,
      )
    : [];

  if (soon.length > 0) {
    await landDb(runner, { shortIds: soon, step });
  }

  const finish = runDeferredWork();
  const result = await getTodayStudySession({ goalId: runner.goal.id, timeZone: "UTC" });
  await finish();

  if (first) {
    await recordDb(runner, {
      event: await toRunEvent(runner, { kind: "refresh" }),
      label: "open",
      step,
    });
  }

  runner.opened.add(day);

  // Today's session follows a proposal the learner applied: read it again.
  const answered = first && (await answerProposalDb(runner, step));

  const shown = answered
    ? await getTodayStudySession({ goalId: runner.goal.id, timeZone: "UTC" })
    : result;

  return shown.status === "ready" ? shown.session : null;
}

/**
 * The learner answers Today's proposal to move the phase dates as their life says: applying it is
 * a change of theirs, a step; keeping their dates changes nothing, so the next step doesn't read
 * it as new. Whether they applied it.
 */
async function answerProposalDb(runner: DbRunner, step: number): Promise<boolean> {
  const answer = runner.life.proposals;

  const waiting = answer
    ? await prisma.planChange.findFirst({
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        where: {
          payload: { equals: PHASE_DATES_SOURCE, path: ["source"] },
          planId: runner.plan.id,
          status: "proposed",
        },
      })
    : null;

  if (!waiting) {
    return false;
  }

  const decided = await decidePlanChange({
    changeId: waiting.id,
    goalId: runner.goal.id,
    input: { status: answer === "apply" ? "applied" : "declined", timeZone: "UTC" },
  });

  if (decided.status !== "updated") {
    return false;
  }

  if (answer === "decline") {
    runner.seen.set(waiting.id, "declined");
    return false;
  }

  await recordDb(runner, {
    event: { kind: "learnerChange", operations: [{ kind: "fitPhaseDates" }] },
    label: "answer",
    step,
  });

  return true;
}
