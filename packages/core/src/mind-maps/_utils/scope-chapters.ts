import "server-only";
import { type Sql, sql } from "@zoonk/db";
import { planChapters } from "./plan-chapters";

/**
 * The one place that decides which chapters a goal's mind maps cover: its plan's, in plan order,
 * and for a course goal every other chapter of its course after them, in course order. An exam
 * keeps its plan's: chapters outside it often have no id yet, and its Plus lock follows the plan.
 */
export function mindMapScopeChapters(goalId: string): Sql {
  return sql`
    WITH planned AS (
      SELECT chapter_id, plan_position FROM (${planChapters(sql`g.id = ${goalId}::uuid`)}) pc
    )
    SELECT chapter_id, plan_position AS position FROM planned
    UNION ALL
    SELECT
      cc.chapter_id,
      ((SELECT count(*) FROM planned) + row_number() OVER (ORDER BY cc.level, cc.position))::int
    FROM goals g
    JOIN course_chapters cc ON cc.course_id = g.primary_course_id
    WHERE g.id = ${goalId}::uuid AND g.kind = 'learn'
      AND cc.chapter_id NOT IN (SELECT chapter_id FROM planned)`;
}
