import "server-only";
import { type ExamBlueprint } from "@zoonk/db";
import { loadOftenTestedSkillIds } from "../../exams/map/load-often-tested";
import { readSavedPlan } from "../../learner/facts/saved-plan";
import { loadBlockedTestOutChapters } from "../../learner/test-out/_utils/offer-eligibility";
import { readBlockPayload } from "../block-payload";
import { loadBlockSubjects } from "./block-subjects";
import { isCurrentSession } from "./current-session";
import { withLessonDisplayMinutes } from "./lesson-display-minutes";
import { readLessonScreens } from "./lesson-screens";
import { type SessionAnswer, loadSessionAnswers } from "./session-answers";
import { toStudyBlockView } from "./session-view";
import { type StudySessionRow } from "./study-session-access";

export async function loadSessionBlockViews({
  answers: knownAnswers,
  blueprint,
  session,
  timeZone,
  userId,
}: {
  answers?: readonly SessionAnswer[];
  blueprint?: ExamBlueprint | null;
  session: StudySessionRow;
  timeZone: string;
  userId: string;
}) {
  const now = new Date();

  const [answers, subjects, blockedChapters, displayBlocks, oftenTestedSkillIds] =
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
            known: { source: readSavedPlan(userId, session.goalId) },
            now,
            timeZone,
            userId,
          })
        : new Set<string>(),
      withLessonDisplayMinutes({ blocks: session.blocks }),
      loadOftenTestedSkillIds(session.goal),
    ]);

  const answeredItemIds = new Set(answers.flatMap((answer) => answer.itemId ?? []));
  const current = isCurrentSession({ now, session, timeZone });

  const { blocks } = await readLessonScreens({
    blocks: displayBlocks.map((block) =>
      toStudyBlockView({
        answeredItemIds,
        block,
        blockedTestOutChapters: blockedChapters,
        blocks: session.blocks,
        oftenTestedSkillIds,
        subject: subjects.get(block.position) ?? null,
      }),
    ),
    current,
    status: session.status,
  });

  return { answers, blocks, current, displayBlocks };
}
