import "server-only";
import { type Sql, sql } from "@zoonk/db";

/**
 * The chapters of the plans `goals` selects (it filters the goals `g` alias), as the map lists
 * them: each with its plan position, the chapter and lesson items that count toward it, and whether
 * every one of those is done or tested out. Finishing a chapter reads the same rule.
 */
export function planChapters(goals: Sql): Sql {
  return sql`
    WITH items AS (
      SELECT p.goal_id, i.id, i.position, i.kind, i.status, i.chapter_id, i.lesson_id, i.skill_id
      FROM plans p
      JOIN goals g ON g.id = p.goal_id
      JOIN plan_items i ON i.plan_id = p.id
      WHERE ${goals}
    ),
    own AS (
      SELECT goal_id, chapter_id, min(position) AS first_position
      FROM items
      WHERE chapter_id IS NOT NULL
      GROUP BY goal_id, chapter_id
    ),
    -- Only a plan with a lesson item saved without its chapter or skill can file a skill under
    -- a chapter none of its items names: the lesson's home. The rest skip the projection.
    filing AS (
      SELECT it.* FROM items it
      WHERE EXISTS (
        SELECT 1 FROM items h
        WHERE h.goal_id = it.goal_id AND h.chapter_id IS NULL AND h.skill_id IS NULL
          AND h.lesson_id IS NOT NULL
      )
    ),
    -- What each item teaches, in teaching order, where expandItems files it (null: a phase).
    entries AS (
      SELECT
        f.goal_id, f.id AS item_id, f.position, 0::bigint AS ord, s.id AS skill_id,
        s.merged_into_id, f.chapter_id AS area
      FROM filing f
      JOIN skills s ON s.id = f.skill_id
      UNION ALL
      SELECT
        f.goal_id, f.id, f.position, row_number() OVER (PARTITION BY f.id ORDER BY ls.created_at),
        s.id, s.merged_into_id, coalesce(f.chapter_id, l.home_chapter_id)
      FROM filing f
      JOIN library_lessons l ON l.id = f.lesson_id
      JOIN lesson_skills ls ON ls.lesson_id = f.lesson_id
      JOIN skills s ON s.id = ls.skill_id
      WHERE f.skill_id IS NULL
      UNION ALL
      SELECT
        f.goal_id, f.id, f.position,
        row_number() OVER (PARTITION BY f.id ORDER BY cl.position, ls.created_at),
        s.id, s.merged_into_id, f.chapter_id
      FROM filing f
      JOIN chapter_lessons cl ON cl.chapter_id = f.chapter_id
      JOIN lesson_skills ls ON ls.lesson_id = cl.lesson_id
      JOIN skills s ON s.id = ls.skill_id
      WHERE f.skill_id IS NULL AND f.lesson_id IS NULL
    ),
    -- Each skill, a merged duplicate as its survivor, filed where the plan first teaches it
    -- (firstPerSkill).
    first_areas AS (
      SELECT DISTINCT ON (goal_id, coalesce(merged_into_id, skill_id))
        goal_id, coalesce(merged_into_id, skill_id) AS skill_id, area, position, ord
      FROM entries
      ORDER BY goal_id, coalesce(merged_into_id, skill_id), position, ord
    ),
    -- Each lesson's area: its first skill's (getItemArea), else its chapter.
    item_areas AS (
      SELECT
        f.goal_id, f.id, f.position, f.status, f.chapter_id,
        coalesce(taught.area, f.chapter_id) AS area
      FROM filing f
      LEFT JOIN LATERAL (
        SELECT fa.area FROM entries e
        JOIN first_areas fa ON fa.goal_id = e.goal_id
          AND fa.skill_id = coalesce(e.merged_into_id, e.skill_id)
        WHERE e.item_id = f.id
        ORDER BY e.ord
        LIMIT 1
      ) taught ON true
      WHERE f.kind IN ('chapter', 'lesson')
    ),
    -- A chapter the map files skills under without an item of its own (findChapterArea).
    filed AS (
      SELECT fa.goal_id, fa.area AS chapter_id, min(fa.position) AS first_taught
      FROM first_areas fa
      WHERE fa.area IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM own o WHERE o.goal_id = fa.goal_id AND o.chapter_id = fa.area)
      GROUP BY fa.goal_id, fa.area
    ),
    -- The chapter and lesson items that count toward each chapter: those that name it, and those
    -- saved without a chapter that the map files there. A filed chapter takes every item filed there.
    members AS (
      SELECT goal_id, chapter_id, id, position, status
      FROM items
      WHERE chapter_id IS NOT NULL AND kind IN ('chapter', 'lesson')
      UNION
      SELECT ia.goal_id, ia.area, ia.id, ia.position, ia.status
      FROM item_areas ia
      WHERE ia.area IS NOT NULL
        AND (
          ia.chapter_id IS NULL
          OR NOT EXISTS (SELECT 1 FROM own o WHERE o.goal_id = ia.goal_id AND o.chapter_id = ia.area)
        )
    ),
    chapters AS (
      SELECT goal_id, chapter_id, false AS is_filed, first_position, 0 AS first_taught FROM own
      UNION ALL
      SELECT goal_id, chapter_id, true, NULL, first_taught FROM filed
    )
    SELECT
      c.goal_id,
      c.chapter_id,
      coalesce(bool_and(m.status IN ('done', 'tested_out')), false) AS finished,
      coalesce(array_agg(m.id) FILTER (WHERE m.id IS NOT NULL), '{}') AS item_ids,
      (row_number() OVER (
        PARTITION BY c.goal_id
        ORDER BY c.is_filed, coalesce(c.first_position, min(m.position)) NULLS LAST, c.first_taught
      ))::int AS plan_position
    FROM chapters c
    LEFT JOIN members m ON m.goal_id = c.goal_id AND m.chapter_id = c.chapter_id
    GROUP BY c.goal_id, c.chapter_id, c.is_filed, c.first_position, c.first_taught`;
}
