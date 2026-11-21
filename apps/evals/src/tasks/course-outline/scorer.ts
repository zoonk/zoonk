import { type CodeCheckResult, scoreWithCodeChecks } from "@/lib/code-checked-score";
import { type TaskCodeChecks, type TaskScorer } from "@/lib/types";
import { type CourseOutlineParams } from "@zoonk/ai/tasks/curriculum/course-outline";
import { findMixedAreaChapters } from "@zoonk/ai/tasks/curriculum/outline-areas";
import { COURSE_OUTLINE_SCORE_CATEGORIES } from "./score-categories";

/** A case-insensitive pattern matched against practical chapters' tool names. */
export type CourseOutlineExpected = { tool: string };

type OutlineTool = { essential: boolean; name: string };
type OutlineChapter = { skillKeys?: string[]; title: string; tools: OutlineTool[] };

const MAX_TOOL_NAME_WORDS = 8;
const MAX_CHAPTER_TOOLS = 4;

type Outline = { chapters: OutlineChapter[]; uncoveredSkillKeys: string[] };

function parseOutline(output: string): Outline {
  try {
    const parsed = JSON.parse(output) as Partial<Outline>;
    return { chapters: parsed.chapters ?? [], uncoveredSkillKeys: parsed.uncoveredSkillKeys ?? [] };
  } catch {
    return { chapters: [], uncoveredSkillKeys: [] };
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
    tool.name.split(/\s+/u).length > MAX_TOOL_NAME_WORDS
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

function checkChapters({
  chapters,
  params,
}: {
  chapters: OutlineChapter[];
  params: CourseOutlineParams;
}) {
  const checks = chapters.map((chapter) => ({
    area: getAreaProblems({ chapter, params }),
    tools: getToolProblems({
      chapter,
      level: params.level,
      withoutTools: params.withoutTools ?? false,
    }),
  }));

  return {
    hasAreaProblems: checks.some(({ area }) => area.length > 0),
    hasToolProblems: checks.some(({ tools }) => tools.length > 0),
    passed: checks.filter(({ area, tools }) => area.length === 0 && tools.length === 0).length,
    problems: checks.flatMap(({ area, tools }) => [...tools, ...area]),
  };
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
  const { chapters, uncoveredSkillKeys } = parseOutline(output);

  const coversSkills =
    (params.requiredSkills?.length ?? 0) + (params.extendSkills?.length ?? 0) > 0;

  const checked = checkChapters({ chapters, params });

  const pattern = expected ? new RegExp(expected.tool, "iu") : null;

  const found =
    !pattern ||
    chapters.some((chapter) => (chapter.tools ?? []).some((tool) => pattern.test(tool.name)));

  const leavesSkillsOut = coversSkills && uncoveredSkillKeys.length > 0;

  const problems = [
    ...checked.problems,
    !found && `No chapter names the tool the course practices with (${expected?.tool}).`,
    leavesSkillsOut &&
      `No chapter teaches ${uncoveredSkillKeys.length} required skill(s): ${uncoveredSkillKeys.join(", ")}.`,
  ].filter((problem) => typeof problem === "string");

  const blockingProblems = chapters.length === 0 ? ["The output has no chapters."] : [];
  const hasToolExpectation = Boolean(pattern);

  return {
    blockingProblems,
    criteria: [
      ...(checked.hasToolProblems || !found ? ["levelFit"] : []),
      ...(checked.hasAreaProblems || leavesSkillsOut || blockingProblems.length > 0
        ? ["coverage"]
        : []),
    ],
    judgedOutput: output,
    passed:
      checked.passed +
      Number(hasToolExpectation && found) +
      Number(coversSkills && !leavesSkillsOut),
    problems: blockingProblems.length > 0 ? blockingProblems : problems,
    total: Math.max(chapters.length + Number(hasToolExpectation) + Number(coversSkills), 1),
  };
}

export const checkCourseOutlineOutput: TaskCodeChecks<CourseOutlineExpected> = ({
  output,
  testCase,
}) => {
  const params = testCase.userInput as CourseOutlineParams;

  return checkOutline({ expected: testCase.expected, output, params });
};

export const scoreCourseOutline: TaskScorer<CourseOutlineExpected> = ({ output, testCase }) =>
  scoreWithCodeChecks({
    check: (value) => checkCourseOutlineOutput({ output: value, testCase }),
    output,
    scoreCategories: COURSE_OUTLINE_SCORE_CATEGORIES,
    testCase,
  });
