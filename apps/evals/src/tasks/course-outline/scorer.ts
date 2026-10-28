import { type CodeCheckResult, scoreWithCodeChecks } from "@/lib/code-checked-score";
import { type TaskScorer } from "@/lib/types";
import { type CourseOutlineParams } from "@zoonk/ai/tasks/v2/curriculum/course-outline";
import { findMixedAreaChapters } from "@zoonk/ai/tasks/v2/curriculum/outline-areas";
import { COURSE_OUTLINE_SCORE_CATEGORIES } from "./score-categories";

/** A case-insensitive pattern matched against practical chapters' tool names. */
export type CourseOutlineExpected = { tool: string };

type OutlineTool = { essential: boolean; name: string };
type OutlineChapter = { skillKeys?: string[]; title: string; tools: OutlineTool[] };

const MAX_TOOL_NAME_LENGTH = 60;
const MAX_TOOL_NAME_WORDS = 8;
const MAX_CHAPTER_TOOLS = 4;

function parseChapters(output: string): OutlineChapter[] {
  try {
    const parsed = JSON.parse(output) as { chapters?: OutlineChapter[] };
    return parsed.chapters ?? [];
  } catch {
    return [];
  }
}

function getToolProblems({
  chapter,
  level,
  withoutTools,
}: {
  chapter: OutlineChapter;
  level: CourseOutlineParams["level"];
  withoutTools: boolean;
}): string[] {
  const tools = chapter.tools ?? [];
  const where = `Chapter "${chapter.title}"`;
  const taggedForExam = withoutTools && (chapter.skillKeys ?? []).length > 0;

  const names = tools.flatMap((tool) =>
    tool.name.length > MAX_TOOL_NAME_LENGTH || tool.name.split(/\s+/u).length > MAX_TOOL_NAME_WORDS
      ? [`${where}: the tool "${tool.name}" is a description, not a tool name.`]
      : [],
  );

  return [
    ...names,
    tools.length > MAX_CHAPTER_TOOLS && `${where} lists ${tools.length} tools.`,
    level === "overview" &&
      tools.length > 0 &&
      `${where} is an overview chapter but lists tools; overviews use none.`,
    taggedForExam &&
      tools.length > 0 &&
      `${where} teaches a skill a written exam needs but lists tools; it must teach it without them.`,
  ].filter((problem) => typeof problem === "string");
}

function getAreaProblems({
  chapter,
  params,
}: {
  chapter: OutlineChapter;
  params: CourseOutlineParams;
}): string[] {
  const skills = [...(params.requiredSkills ?? []), ...(params.extendSkills ?? [])];

  return findMixedAreaChapters({
    chapters: [{ skillKeys: chapter.skillKeys ?? [], title: chapter.title }],
    skills,
  }).map(
    (mixed) =>
      `Chapter "${mixed.title}" teaches skills of several areas: ${mixed.areas.join(", ")}.`,
  );
}

function checkOutline({
  expected,
  output,
  params,
}: {
  expected: CourseOutlineExpected | undefined;
  output: string;
  params: CourseOutlineParams;
}): CodeCheckResult {
  const { level, withoutTools = false } = params;
  const chapters = parseChapters(output);

  const chapterProblems = chapters.map((chapter) => [
    ...getToolProblems({ chapter, level, withoutTools }),
    ...getAreaProblems({ chapter, params }),
  ]);

  const pattern = expected ? new RegExp(expected.tool, "iu") : null;

  const found =
    !pattern ||
    chapters.some((chapter) => (chapter.tools ?? []).some((tool) => pattern.test(tool.name)));

  const problems = [
    ...chapterProblems.flat(),
    !found && `No chapter names the tool the course practices with (${expected?.tool}).`,
  ].filter((problem) => typeof problem === "string");

  return {
    judgedOutput: output,
    passed: chapterProblems.filter((list) => list.length === 0).length + (pattern && found ? 1 : 0),
    problems: chapters.length === 0 ? ["The output has no chapters."] : problems,
    total: Math.max(chapters.length + (pattern ? 1 : 0), 1),
  };
}

export const scoreCourseOutline: TaskScorer<CourseOutlineExpected> = ({ output, testCase }) => {
  const params = testCase.userInput as CourseOutlineParams;

  return scoreWithCodeChecks({
    check: (value) => checkOutline({ expected: testCase.expected, output: value, params }),
    output,
    scoreCategories: COURSE_OUTLINE_SCORE_CATEGORIES,
    testCase,
  });
};
