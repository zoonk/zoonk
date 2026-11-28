import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { prisma } from "@zoonk/db";
import {
  buildChapterIdentityKey,
  buildImageReuseKey,
  buildLessonIdentityKey,
  buildSkillIdentityKey,
  scopeIdentityKey,
} from "@zoonk/utils/identity-key";
import { describe, expect, it } from "vitest";
import { countryIdentityKey } from "../content-country";
import { buildExamIdentityKey } from "../exams/exam-identity";

const migration = readFileSync(
  new URL(
    "../../../../db/src/prisma/migrations/20261128094714_spell_out_symbols_in_identity_keys/migration.sql",
    import.meta.url,
  ),
  "utf8",
);

function skillKey(name: string): string {
  return buildSkillIdentityKey({ name, targetLanguage: null });
}

const longJapanese = `${"語".repeat(66)} C++`;
const tooLong = `${"a ".repeat(96)}C++`;
const cppPicture = "A diagram of C++ inheritance";
const oldPictureHash = createHash("sha256").update("a-diagram-of-c-inheritance").digest("hex");

describe("symbol identity keys migration", () => {
  it("moves rows named with + or # off the keys a plain name builds, and leaves the rest", async () => {
    await prisma.$transaction(async (tx) => {
      const setup = [
        "CREATE TEMP TABLE skills (id text, language text, name text, identity_key text) ON COMMIT DROP",
        "CREATE TEMP TABLE library_chapters (id text, language text, title text, identity_key text) ON COMMIT DROP",
        "CREATE TEMP TABLE library_lessons (id text, language text, title text, identity_key text) ON COMMIT DROP",
        "CREATE TEMP TABLE exam_blueprints (id text, language text, name text, role text, identity_key text) ON COMMIT DROP",
        "CREATE TEMP TABLE media_assets (id text, kind text, prompt text, reuse_key text) ON COMMIT DROP",
        "CREATE TEMP TABLE warm_ups (id text, identity_key text) ON COMMIT DROP",
        "CREATE TEMP TABLE goals (warm_up_id text, title text, display_name text) ON COMMIT DROP",
        `INSERT INTO skills VALUES
          ('cpp', 'en', 'Write simple C++ programs', ':write-simple-c-programs'),
          ('private', 'en', 'Compile and run C++ programs', 'private:owner:PT::compile-and-run-c-programs'),
          ('accents', 'pt', 'Escrever programas simples em C++ (introdução)', ':escrever-programas-simples-em-c-introducao'),
          ('japanese', 'ja', 'C#プログラミング入門', ':c-プログラミング入門'),
          ('long-japanese', 'ja', '${longJapanese}', ':${"語".repeat(66)}-c'),
          ('too-long', 'en', '${tooLong}', ':${"a-".repeat(96)}c'),
          ('taken', 'es', 'Write simple C++ programs', ':write-simple-c-programs'),
          ('holder', 'es', 'Write simple C plus plus programs', ':write-simple-c-plus-plus-programs'),
          ('renamed', 'en', 'Use C# delegates', ':use-events'),
          ('plain', 'en', 'Use fundamental types', ':use-fundamental-types'),
          ('setup', 'en', 'Set up g++ on Windows', ':setup:g:windows')`,
        `INSERT INTO library_chapters VALUES
          ('cpp', 'en', 'Simple C++ programs', 'beginner::course:simple-c-programs')`,
        `INSERT INTO library_lessons VALUES
          ('split', 'en', 'Pointers in C++', 'beginner::course:skill:pointers-in-c'),
          ('whole', 'en', 'C++ program structure', 'beginner::course:skill')`,
        `INSERT INTO exam_blueprints VALUES
          ('exam', 'en', 'CompTIA A+', 'Core 1', 'US:comptia-a-core-1')`,
        `INSERT INTO media_assets VALUES
          ('picture', 'image', '${cppPicture}', 'image:any:${oldPictureHash.slice(0, 40)}')`,
        `INSERT INTO warm_ups VALUES
          ('cpp', 'learn::learn-c-programming-language'),
          ('physics', 'learn::learn-physics')`,
        `INSERT INTO goals VALUES ('cpp', 'Learn C++', 'C++'), ('physics', 'Learn physics', 'Physics')`,
      ];

      // Its new key is long enough to be hashed, which this migration can't rebuild.
      expect(skillKey(tooLong)).toMatch(/^sha256:/u);

      /* oxlint-disable no-await-in-loop -- Statements create and then populate the same temporary tables. */
      for (const statement of setup) {
        await tx.$executeRawUnsafe(statement);
      }

      for (const statement of migration.split(";").filter((part) => part.trim())) {
        await tx.$executeRawUnsafe(statement);
      }
      /* oxlint-enable no-await-in-loop */

      await expect(
        tx.$queryRaw`SELECT id, identity_key FROM skills ORDER BY id`,
      ).resolves.toStrictEqual([
        { id: "accents", identity_key: skillKey("Escrever programas simples em C++ (introdução)") },
        { id: "cpp", identity_key: skillKey("Write simple C++ programs") },
        { id: "holder", identity_key: ":write-simple-c-plus-plus-programs" },
        { id: "japanese", identity_key: skillKey("C#プログラミング入門") },
        { id: "long-japanese", identity_key: skillKey(longJapanese) },
        { id: "plain", identity_key: ":use-fundamental-types" },
        {
          id: "private",
          identity_key: scopeIdentityKey({
            key: countryIdentityKey({
              country: "PT",
              key: skillKey("Compile and run C++ programs"),
            }),
            ownerId: "owner",
          }),
        },
        { id: "renamed", identity_key: ":use-events" },
        { id: "setup", identity_key: ":setup:g:windows" },
        { id: "taken", identity_key: ":write-simple-c-programs#retired" },
        { id: "too-long", identity_key: `:${"a-".repeat(96)}c#retired` },
      ]);

      await expect(tx.$queryRaw`SELECT identity_key FROM library_chapters`).resolves.toStrictEqual([
        {
          identity_key: buildChapterIdentityKey({
            courseId: "course",
            level: "beginner",
            targetLanguage: null,
            title: "Simple C++ programs",
          }),
        },
      ]);

      await expect(
        tx.$queryRaw`SELECT id, identity_key FROM library_lessons ORDER BY id`,
      ).resolves.toStrictEqual([
        {
          id: "split",
          identity_key: buildLessonIdentityKey({
            courseId: "course",
            level: "beginner",
            skillIds: ["skill"],
            targetLanguage: null,
            title: "Pointers in C++",
          }),
        },
        { id: "whole", identity_key: "beginner::course:skill" },
      ]);

      await expect(tx.$queryRaw`SELECT identity_key FROM exam_blueprints`).resolves.toStrictEqual([
        {
          identity_key: buildExamIdentityKey({
            country: "US",
            name: "CompTIA A+",
            ownerId: null,
            role: "Core 1",
          }),
        },
      ]);

      await expect(tx.$queryRaw`SELECT reuse_key FROM media_assets`).resolves.toStrictEqual([
        {
          reuse_key: buildImageReuseKey({
            canvas: "landscape",
            language: null,
            prompt: cppPicture,
          }),
        },
      ]);

      await expect(
        tx.$queryRaw`SELECT id, identity_key FROM warm_ups ORDER BY id`,
      ).resolves.toStrictEqual([
        { id: "cpp", identity_key: "learn::learn-c-programming-language#retired" },
        { id: "physics", identity_key: "learn::learn-physics" },
      ]);
    });
  });
});
