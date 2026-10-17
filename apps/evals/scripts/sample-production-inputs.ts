/**
 * Samples anonymized inputs from a local database (the `zoonk` dev database or
 * `zoonk_prod_copy`, the local copy of production) into a JSON dataset, so new
 * test cases start from what learners and the pipeline actually produce
 * instead of invented examples: typed goals, what onboarding understood from
 * them, tutor questions, typed answers and the evaluation-model log (Jev's
 * verdicts with their inputs).
 *
 *   pnpm sample:production --limit 50 --database-url postgresql://localhost:5432/zoonk_prod_copy
 *
 * It only reads from a local host. Emails, links, phone numbers and the names
 * of every user in the database are replaced before anything is written. Each
 * row keeps what production recorded with its provenance (model and prompt
 * version), which is not ground truth: label cases by hand before using them as
 * expected values, and mark them `origin: "production"`.
 */
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseArgs, promisify } from "node:util";
import z from "zod";

const DEFAULT_DATABASE_URL = "postgresql://localhost:5432/zoonk";
const DEFAULT_OUTPUT = "datasets/production-inputs.json";
const DEFAULT_LIMIT = 50;
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);
const MIN_PHONE_DIGITS = 9;
const MIN_NAME_PART_LENGTH = 3;
const ID_LENGTH = 12;

const EMAIL_PATTERN = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/gu;
const URL_PATTERN = /\bhttps?:\/\/\S+/giu;
const PHONE_PATTERN = /\+?\d[\d\s().-]{7,}\d/gu;

const runFile = promisify(execFile);

const rowsSchema = z.array(z.record(z.string(), z.string().nullable()));

type Row = z.infer<typeof rowsSchema>[number];

function parseCliArgs() {
  const { values } = parseArgs({
    options: {
      "database-url": { type: "string" },
      limit: { type: "string" },
      out: { type: "string" },
    },
  });

  const limit = Number(values.limit ?? DEFAULT_LIMIT);

  if (!Number.isInteger(limit) || limit <= 0) {
    throw new Error("--limit must be a positive integer.");
  }

  return {
    databaseUrl: getLocalDatabaseUrl(values["database-url"] ?? DEFAULT_DATABASE_URL),
    limit,
    out: path.resolve(values.out ?? DEFAULT_OUTPUT),
  };
}

/** Sampling copies learner data into files, so it refuses anything but a local database. */
function getLocalDatabaseUrl(value: string): string {
  const url = new URL(value);

  if (!LOCAL_HOSTS.has(url.hostname)) {
    throw new Error(`Refusing to sample from ${url.hostname}: only a local database is allowed.`);
  }

  return url.toString();
}

async function queryRows({ databaseUrl, sql }: { databaseUrl: string; sql: string }) {
  const { stdout } = await runFile("psql", [
    databaseUrl,
    "--no-psqlrc",
    "--tuples-only",
    "--no-align",
    "--command",
    `select coalesce(jsonb_agg(to_jsonb(sample) - 'label_rank'), '[]') from (${sql}) sample`,
  ]);

  return rowsSchema.parse(JSON.parse(stdout));
}

function escapeRegExp(value: string): string {
  return value.replaceAll(/[.*+?^${}()|[\]\\]/gu, String.raw`\$&`);
}

/**
 * Full names match in any case. Single name parts only match capitalized, so a
 * user called "Will" doesn't erase "free will" from an unrelated prompt.
 */
function getNamePatterns(users: Row[]): RegExp[] {
  const names = users.flatMap((user) => (user.name ? [user.name.trim()] : []));

  const fullNames = names
    .filter((name) => name.includes(" "))
    .map((name) => new RegExp(String.raw`\b${escapeRegExp(name)}\b`, "giu"));

  const nameParts = [...new Set(names.flatMap((name) => name.split(/\s+/u)))]
    .filter((part) => part.length >= MIN_NAME_PART_LENGTH && /^\p{Lu}/u.test(part))
    .map((part) => new RegExp(String.raw`\b${escapeRegExp(part)}\b`, "gu"));

  return [...fullNames, ...nameParts];
}

function anonymize({ namePatterns, text }: { namePatterns: RegExp[]; text: string }): string {
  const withoutContacts = text
    .replaceAll(EMAIL_PATTERN, "[email]")
    .replaceAll(URL_PATTERN, "[link]")
    .replaceAll(PHONE_PATTERN, (match) =>
      match.replaceAll(/\D/gu, "").length >= MIN_PHONE_DIGITS ? "[phone]" : match,
    );

  return namePatterns.reduce(
    (result, pattern) => result.replaceAll(pattern, "[name]"),
    withoutContacts,
  );
}

/** Hashes database ids so dataset ids are stable without exposing row ids. */
function toDatasetId(prefix: string, id: string | null): string {
  return `${prefix}-${createHash("sha256")
    .update(id ?? "")
    .digest("hex")
    .slice(0, ID_LENGTH)}`;
}

function anonymizeRow({
  namePatterns,
  prefix,
  row,
}: {
  namePatterns: RegExp[];
  prefix: string;
  row: Row;
}): Row {
  const fields = Object.entries(row)
    .filter(([key]) => key !== "id")
    .map(([key, value]): [string, string | null] => [
      key,
      value === null ? null : anonymize({ namePatterns, text: value }),
    ]);

  return { id: toDatasetId(prefix, row.id ?? null), ...Object.fromEntries(fields) };
}

/**
 * What each section reads. `strata` are the recorded labels (and language)
 * sampled equally, so rare ones still show up. `table` must exist: older
 * copies of the database lack the newer tables, and those sections are skipped.
 * Provenance read through `to_jsonb(row)` is null where a copy predates it.
 */
const SECTIONS = [
  {
    name: "coursePrompts",
    prefix: "prompt",
    sql: `select id, language, prompt, intent::text as "recordedIntent" from course_prompts`,
    strata: `"recordedIntent", language`,
    table: "course_prompts",
  },
  {
    name: "goals",
    prefix: "goal",
    sql: `
      select id, language, prompt, kind::text as "recordedKind", target_language as "targetLanguage"
      from goals
    `,
    strata: `"recordedKind", language`,
    table: "goals",
  },
  {
    name: "goalUnderstandings",
    prefix: "understanding",
    sql: `
      select id, language, normalized_prompt as prompt, result->>'route' as "recordedRoute",
        result::text as "recordedResult", model, prompt_version as "promptVersion"
      from goal_understandings
    `,
    strata: `"recordedRoute", language`,
    table: "goal_understandings",
  },
  {
    name: "tutorQuestions",
    prefix: "question",
    sql: `
      select question.id, library.language,
        question.context_kind::text as "contextKind", question.question, question.answer,
        to_jsonb(question)->>'model' as model,
        to_jsonb(question)->>'prompt_version' as "promptVersion"
      from lesson_questions question
      join lesson_question_threads thread on thread.id = question.thread_id
      left join library_lessons library on library.id = thread.library_lesson_id
    `,
    strata: `"contextKind", language`,
    table: "lesson_questions",
  },
  {
    name: "typedAnswers",
    prefix: "answer",
    sql: `
      select attempt.id, coalesce(lesson.language, item.language) as language,
        coalesce(step.content, item.content)->>'question' as question,
        attempt.answer->>'text' as answer, attempt.is_correct::text as "recordedCorrect",
        attempt.score::text as "recordedScore",
        coalesce(step.model, item.model) as "questionModel",
        coalesce(step.prompt_version, item.prompt_version) as "questionPromptVersion"
      from attempts attempt
      left join library_steps step on step.id = attempt.step_id
      left join library_lessons lesson on lesson.id = step.lesson_id
      left join items item on item.id = attempt.item_id
      where attempt.answer->>'kind' = 'typedAnswer'
    `,
    strata: `"recordedCorrect", language`,
    table: "attempts",
  },
  {
    name: "evaluationRuns",
    prefix: "evaluation",
    sql: `
      select id, task, model, requested_model as "requestedModel",
        prompt_version as "promptVersion", input::text as input,
        answers::text as "recordedAnswers"
      from evaluation_runs
      where input is not null
    `,
    strata: "task",
    table: "evaluation_runs",
  },
] as const;

type Section = (typeof SECTIONS)[number];

function stratifiedSql({ limit, section }: { limit: number; section: Section }) {
  return `
    select * from (
      select ranked.*, row_number() over (partition by ${section.strata} order by random()) as label_rank
      from (${section.sql}) ranked
    ) sampled
    order by label_rank
    limit ${limit}
  `;
}

async function tableExists({ databaseUrl, table }: { databaseUrl: string; table: string }) {
  const rows = await queryRows({
    databaseUrl,
    sql: `select (to_regclass('public.${table}') is not null)::text as present`,
  });

  return rows[0]?.present === "true";
}

/** JSON columns come back as text so they can be anonymized; they go back to JSON after. */
function parseJsonFields(row: Row): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => {
      if (!value?.startsWith("{") && !value?.startsWith("[")) {
        return [key, value];
      }

      try {
        return [key, JSON.parse(value) as unknown];
      } catch {
        return [key, value];
      }
    }),
  );
}

async function sampleSection({
  databaseUrl,
  limit,
  namePatterns,
  section,
}: {
  databaseUrl: string;
  limit: number;
  namePatterns: RegExp[];
  section: Section;
}): Promise<Record<string, unknown>[] | null> {
  if (!(await tableExists({ databaseUrl, table: section.table }))) {
    return null;
  }

  const rows = await queryRows({ databaseUrl, sql: stratifiedSql({ limit, section }) });

  return rows.map((row) =>
    parseJsonFields(anonymizeRow({ namePatterns, prefix: section.prefix, row })),
  );
}

async function main() {
  const { databaseUrl, limit, out } = parseCliArgs();
  const users = await queryRows({ databaseUrl, sql: "select name from users" });
  const namePatterns = getNamePatterns(users);

  const sampled = await Promise.all(
    SECTIONS.map(async (section) => ({
      name: section.name,
      rows: await sampleSection({ databaseUrl, limit, namePatterns, section }),
    })),
  );

  const dataset = {
    note: "Anonymized sample. Recorded labels are what production decided, with the model and prompt version that decided them, not ground truth.",
    sampledAt: new Date().toISOString(),
    source: `local database ${new URL(databaseUrl).pathname.slice(1)}`,
    ...Object.fromEntries(sampled.map((section) => [section.name, section.rows ?? []])),
  };

  await mkdir(path.dirname(out), { recursive: true });
  await writeFile(out, `${JSON.stringify(dataset, null, 2)}\n`);

  const summary = sampled
    .map((section) => `${section.name} ${section.rows?.length ?? "skipped (no table)"}`)
    .join(", ");

  process.stdout.write(`Saved to ${out}: ${summary}.\n`);
}

await main();
