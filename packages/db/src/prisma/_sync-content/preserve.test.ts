import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Client } from "pg";
import { describe, it } from "vitest";
import { getTestEnvironment } from "../../test-environment";
import { restoreDestinationReferences, snapshotDestinationReferences } from "./preserve";

describe("content synchronization", () => {
  it.each([1, 2])(
    "preserves durable history and remaps learner references for revision %i",
    async (revision) => {
      const destination = new Client({ connectionString: getTestEnvironment("test").DATABASE_URL });
      await destination.connect();
      await destination.query("BEGIN");

      try {
        const organizationId = randomUUID();
        const userId = randomUUID();
        const trackId = randomUUID();
        const pendingPromptId = randomUUID();

        await destination.query(
          "INSERT INTO organizations (id, name, slug, created_at, kind) VALUES ($1::uuid,'Test',$1::text,now(),'brand')",
          [organizationId],
        );

        await destination.query(
          "INSERT INTO users (id,name,email,updated_at) VALUES ($1::uuid,'Test',$1::text,now())",
          [userId],
        );

        const makeTree = async (contentRevision: number) => {
          const ids = {
            chapter: randomUUID(),
            course: randomUUID(),
            lesson: randomUUID(),
            step: randomUUID(),
          };

          await destination.query(
            "INSERT INTO courses (id,organization_id,slug,title,normalized_title,language,content_revision) VALUES ($1,$2,'shared-subject','Subject','subject','en',$3)",
            [ids.course, organizationId, contentRevision],
          );

          await destination.query(
            "INSERT INTO chapters (id,course_id,slug,title,normalized_title,description,language,position) VALUES ($1,$2,'chapter','Chapter','chapter','A chapter','en',0)",
            [ids.chapter, ids.course],
          );

          await destination.query(
            "INSERT INTO lessons (id,chapter_id,slug,language,position) VALUES ($1,$2,'lesson','en',0)",
            [ids.lesson, ids.chapter],
          );

          await destination.query(
            "INSERT INTO steps (id,lesson_id,kind,position,content) VALUES ($1,$2,'static',0,'{}')",
            [ids.step, ids.lesson],
          );

          return ids;
        };

        const old = await makeTree(1);

        await destination.query(
          "INSERT INTO lesson_completion_receipts (id,user_id,original_lesson_id,started_at,result) VALUES ($1,$2,$3,now(),$4::jsonb)",
          [randomUUID(), userId, old.lesson, JSON.stringify({ newTotalBp: 93 })],
        );

        await destination.query("INSERT INTO course_users (course_id,user_id) VALUES ($1,$2)", [
          old.course,
          userId,
        ]);

        await destination.query(
          "INSERT INTO course_completions (course_id,user_id) VALUES ($1,$2)",
          [old.course, userId],
        );

        await destination.query(
          "INSERT INTO chapter_completions (chapter_id,user_id) VALUES ($1,$2)",
          [old.chapter, userId],
        );

        await destination.query(
          "INSERT INTO lesson_progress (lesson_id,user_id,completed_at,duration_seconds) VALUES ($1,$2,now(),93)",
          [old.lesson, userId],
        );

        await destination.query(
          "INSERT INTO step_attempts (step_id,user_id,is_correct,answer,duration_seconds,hour_of_day,day_of_week,correct_answers,incorrect_answers) VALUES ($1,$2,false,'{}',12,9,2,2,1), ($1,$2,false,'{}',12,9,2,0,3), ($1,$2,false,'{}',12,9,2,null,null)",
          [old.step, userId],
        );

        await destination.query(
          "INSERT INTO course_prompts (course_id,language,prompt,normalized_prompt,intent) VALUES ($1::uuid,'en',$1::text,$1::text,'learn')",
          [old.course],
        );

        await destination.query(
          "INSERT INTO course_learning_plans (course_id,user_id,depth,goal,chapter_ids,content_revision) VALUES ($1,$2,'focused','My specific goal',ARRAY[$3::uuid],1)",
          [old.course, userId, old.chapter],
        );

        await destination.query(
          "INSERT INTO course_prompts (id,language,prompt,normalized_prompt,intent) VALUES ($1::uuid,'en',$1::text,$1::text,'learn')",
          [pendingPromptId],
        );

        const trackRequest = {
          language: "en",
          prompt: "A private goal that requires two subjects",
          subjects: [
            { courseId: old.course, title: "Subject" },
            { coursePromptId: pendingPromptId, title: "Later subject" },
          ],
        };

        await destination.query(
          "INSERT INTO tracks (id,user_id,title,request) VALUES ($1,$2,'My track',$3::jsonb)",
          [trackId, userId, JSON.stringify(trackRequest)],
        );

        await destination.query(
          "INSERT INTO track_courses (track_id,course_id,position) VALUES ($1,$2,0)",
          [trackId, old.course],
        );

        await destination.query(
          "INSERT INTO chapter_generation_grants (chapter_id,user_id) VALUES ($1,$2)",
          [old.chapter, userId],
        );

        await destination.query(
          "INSERT INTO course_discoveries (course_id,user_id,language,prompt) VALUES ($1,$2,'en','Private detail')",
          [old.course, userId],
        );

        const expected = await snapshotDestinationReferences({ destination, organizationId });
        await destination.query("DELETE FROM courses WHERE id = $1", [old.course]);
        const replacement = await makeTree(revision);
        await restoreDestinationReferences({ destination, expected, organizationId });

        const receipts = await destination.query(
          "SELECT original_lesson_id,result FROM lesson_completion_receipts WHERE user_id=$1",
          [userId],
        );

        assert.deepEqual(receipts.rows, [
          { original_lesson_id: old.lesson, result: { newTotalBp: 93 } },
        ]);

        const attempts = await destination.query<{
          step_id: string | null;
          correct_answers: number | null;
          incorrect_answers: number | null;
          content_snapshot: { stepId: string };
        }>(
          "SELECT step_id, correct_answers, incorrect_answers, content_snapshot FROM step_attempts WHERE user_id = $1 ORDER BY correct_answers NULLS LAST",
          [userId],
        );

        assert.deepEqual(
          attempts.rows.map((row) => [row.correct_answers, row.incorrect_answers]),
          [
            [0, 3],
            [2, 1],
            [null, null],
          ],
        );

        assert.ok(
          attempts.rows.every(
            (row) =>
              row.step_id === (revision === 1 ? replacement.step : null) &&
              row.content_snapshot.stepId === old.step,
          ),
        );

        const history = await destination.query(
          "SELECT lesson_id,duration_seconds,content_snapshot FROM lesson_progress WHERE user_id=$1",
          [userId],
        );

        assert.equal(history.rows[0]?.duration_seconds, 93);
        assert.equal(history.rows[0]?.lesson_id, revision === 1 ? replacement.lesson : null);
        assert.equal(history.rows[0]?.content_snapshot.lessonId, old.lesson);
        assert.equal(history.rows[0]?.content_snapshot.lessonKind, "custom");

        const plans = await destination.query(
          "SELECT course_id,chapter_ids,content_revision,goal FROM course_learning_plans WHERE user_id=$1",
          [userId],
        );

        assert.deepEqual(plans.rows, [
          {
            chapter_ids: [replacement.chapter],
            content_revision: revision === 1 ? 1 : 0,
            course_id: replacement.course,
            goal: "My specific goal",
          },
        ]);

        const trackCourses = await destination.query(
          "SELECT course_id FROM track_courses WHERE track_id=$1",
          [trackId],
        );

        assert.equal(trackCourses.rows[0]?.course_id, replacement.course);

        const track = await destination.query("SELECT request FROM tracks WHERE id=$1", [trackId]);

        assert.deepEqual(track.rows[0]?.request, {
          ...trackRequest,
          subjects: [
            { courseId: replacement.course, title: "Subject" },
            { coursePromptId: pendingPromptId, title: "Later subject" },
          ],
        });

        const grants = await destination.query(
          "SELECT count(*)::int AS count FROM chapter_generation_grants WHERE user_id=$1",
          [userId],
        );

        assert.equal(grants.rows[0]?.count, revision === 1 ? 1 : 0);

        const discoveries = await destination.query(
          "SELECT course_id FROM course_discoveries WHERE user_id=$1",
          [userId],
        );

        assert.equal(discoveries.rows[0]?.course_id, replacement.course);
      } finally {
        await destination.query("ROLLBACK");
        await destination.end();
      }
    },
  );
});
