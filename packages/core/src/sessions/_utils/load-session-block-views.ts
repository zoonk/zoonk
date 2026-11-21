import "server-only";
import { type ExamBlueprint } from "@zoonk/db";
import { loadOftenTestedSkillIds } from "../../exams/map/load-often-tested";
import { getAnswerTimeZone } from "../../learner/_utils/owned-goal";
import { getRequestInstant } from "../../learner/facts/request-instant";
import { type SavedPlan, readSavedPlan } from "../../learner/facts/saved-plan";
import { loadBlockedTestOutChapters } from "../../learner/test-out/_utils/offer-eligibility";
import { readBlockPayload } from "../block-payload";
import { loadBlockSubjects } from "./block-subjects";
import { isCurrentSession } from "./current-session";
import { loadExtraWritingAvailability } from "./extra-writing-availability";
import { type LessonStatesReader, readLessonScreens } from "./lesson-screens";
import { type SessionAnswer, loadSessionAnswers } from "./session-answers";
import { toStudyBlockView } from "./session-view";
import { type StudySessionRow } from "./study-session-access";
import { loadSessionWritingTasks } from "./writing-block-tasks";

export async function loadSessionBlockViews({
  answers: knownAnswers,
  blueprint: knownBlueprint,
  plan,
  readLessonStates,
  session: saved,
  timeZone,
  userId,
}: {
  answers?: readonly SessionAnswer[];
  blueprint?: ExamBlueprint | null;
  plan?: SavedPlan | null;
  readLessonStates?: LessonStatesReader;
  session: StudySessionRow;
  timeZone: string;
  userId: string;
}) {
  const [now, { blueprint, removed, writingTasks }] = await Promise.all([
    getRequestInstant(),
    loadSessionWritingTasks({ blueprint: knownBlueprint, session: saved }),
  ]);

  const session = { ...saved, blocks: saved.blocks.filter(({ id }) => !removed.has(id)) };

  const [answers, subjects, blockedChapters, oftenTestedSkillIds, withWritingAvailability] =
    await Promise.all([
      knownAnswers ?? loadSessionAnswers({ blocks: session.blocks, sessionId: session.id, userId }),
      loadBlockSubjects({ blocks: session.blocks, blueprint, goal: session.goal }),
      session.goalId
        ? loadBlockedTestOutChapters({
            chapterIds: [
              ...new Set(
                session.blocks.flatMap((block) => readBlockPayload(block).chapterId ?? []),
              ),
            ],
            goalId: session.goalId,
            known: {
              blueprint,
              goal: session.goal,
              source: plan === undefined ? readSavedPlan(userId, session.goalId) : plan,
            },
            now,
            timeZone,
            userId,
          })
        : new Set<string>(),
      loadOftenTestedSkillIds(session.goal),
      loadExtraWritingAvailability({
        blocks: session.blocks,
        now,
        timeZone: getAnswerTimeZone({ goal: session.goal, timeZone }),
        userId,
      }),
    ]);

  const answeredItemIds = new Set(answers.flatMap((answer) => answer.itemId ?? []));
  const current = isCurrentSession({ now, session, timeZone });

  const { blocks } = await readLessonScreens(
    {
      blocks: session.blocks.map((block) =>
        toStudyBlockView({
          answeredItemIds,
          block,
          blockedTestOutChapters: blockedChapters,
          blocks: session.blocks,
          oftenTestedSkillIds,
          subject: subjects.get(block.position) ?? null,
          writingTasks,
        }),
      ),
      current,
      status: session.status,
    },
    readLessonStates,
  );

  return {
    answers,
    blocks: blocks.map((block) => withWritingAvailability(block)),
    current,
    displayBlocks: session.blocks,
  };
}
