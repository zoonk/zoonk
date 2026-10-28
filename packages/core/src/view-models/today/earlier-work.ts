import "server-only";
import { prisma } from "@zoonk/db";
import { type ReadStudyDay } from "../../sessions/_utils/read-study-day";

/** Saved overdue teaching and the previous session's unfinished lessons, in plan order. */
export async function loadEarlierWork({ day, goalId }: { day: ReadStudyDay; goalId: string }) {
  return prisma.$queryRaw<{ id: string; title: string }[]>`
    SELECT item.id, item.title_snapshot AS title FROM plan_items AS item
    JOIN plans AS plan ON plan.id = item.plan_id
    WHERE plan.goal_id = ${goalId}::uuid
      AND item.kind IN ('lesson'::"PlanItemKind", 'chapter'::"PlanItemKind")
      AND item.status = 'todo'::"PlanItemStatus"
      AND (
        item.scheduled_for < ${day.session.localDate}
        OR item.lesson_id IN (
          SELECT block.lesson_id FROM study_session_blocks AS block
          WHERE block.session_id = (
            SELECT id FROM study_sessions WHERE goal_id = ${goalId}::uuid
              AND local_date < ${day.session.localDate}
            ORDER BY local_date DESC LIMIT 1
          ) AND block.kind = 'learn'::"StudyBlockKind"
            AND block.status IN ('pending'::"StudyBlockStatus", 'active'::"StudyBlockStatus")
        )
      )
    ORDER BY item.position ASC
  `;
}
