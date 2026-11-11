import { readFileSync } from "node:fs";
import { prisma } from "@zoonk/db";
import { describe, expect, it } from "vitest";

describe("country migration", () => {
  it("backfills only unanimous foreign exam courses and exclusively scoped skills", async () => {
    const migration = readFileSync(
      new URL(
        "../../../../db/src/prisma/migrations/20261111183316_country_aware_content/migration.sql",
        import.meta.url,
      ),
      "utf8",
    );

    await prisma.$transaction(async (tx) => {
      const setup = [
        "CREATE TEMP TABLE courses (id text, language text) ON COMMIT DROP",
        "CREATE TEMP TABLE goals (id text) ON COMMIT DROP",
        "CREATE TEMP TABLE skills (id text) ON COMMIT DROP",
        "CREATE TEMP TABLE user_learning_profiles (id text) ON COMMIT DROP",
        "CREATE TEMP TABLE exam_blueprints (id text, country text, identity_key text) ON COMMIT DROP",
        "CREATE TEMP TABLE exam_skill_graphs (exam_blueprint_id text, primary_course_id text, graph jsonb) ON COMMIT DROP",
        "CREATE TEMP TABLE chapter_skills (chapter_id text, skill_id text) ON COMMIT DROP",
        "CREATE TEMP TABLE library_chapters (id text, home_course_id text) ON COMMIT DROP",
        "CREATE TEMP TABLE course_chapters (chapter_id text, course_id text) ON COMMIT DROP",
        `INSERT INTO courses VALUES ('pt', 'pt'), ('br', 'pt'), ('conflict', 'pt'), ('international', 'pt'), ('general', 'pt')`,
        `INSERT INTO skills VALUES ('exclusive'), ('shared')`,
        `INSERT INTO exam_blueprints VALUES ('pt', 'PT', 'private:owner:exam'), ('br', 'BR', 'exam'), ('zz', 'ZZ', 'exam')`,
        `INSERT INTO exam_skill_graphs VALUES
        ('pt', 'pt', '{"skills":[{"courseIds":["conflict"]}]}'),
        ('br', 'br', '{"skills":[{"courseIds":["conflict"]}]}'),
        ('zz', 'international', '{}')`,
        `INSERT INTO library_chapters VALUES ('pt', 'pt'), ('general', 'general')`,
        `INSERT INTO chapter_skills VALUES ('pt', 'exclusive'), ('pt', 'shared'), ('general', 'shared')`,
      ];

      /* oxlint-disable no-await-in-loop -- Statements create and then populate the same temporary tables. */
      for (const statement of setup) {
        await tx.$executeRawUnsafe(statement);
      }

      for (const statement of migration.split(";").filter((part) => part.trim())) {
        await tx.$executeRawUnsafe(statement);
      }

      /* oxlint-enable no-await-in-loop */

      await expect(
        tx.$queryRaw`SELECT id, country FROM courses ORDER BY id`,
      ).resolves.toStrictEqual([
        { country: null, id: "br" },
        { country: null, id: "conflict" },
        { country: null, id: "general" },
        { country: null, id: "international" },
        { country: "PT", id: "pt" },
      ]);

      await expect(tx.$queryRaw`SELECT id, country FROM skills ORDER BY id`).resolves.toStrictEqual(
        [
          { country: "PT", id: "exclusive" },
          { country: null, id: "shared" },
        ],
      );

      await expect(
        tx.$queryRaw`SELECT identity_key FROM exam_blueprints WHERE id = 'pt'`,
      ).resolves.toStrictEqual([{ identity_key: "private:owner:PT:exam" }]);
    });
  });
});
