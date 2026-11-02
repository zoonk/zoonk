import { safeAsync } from "@zoonk/utils/error";
import { type ExamOutline } from "../exam-outline";
import { type RawSkillGraph, type SkillGraph, normalizeSkillGraph } from "./normalize-skill-graph";
import { type SkillGraphProblem, findSkillGraphProblems } from "./skill-graph-checks";
import { getSectionCall, joinSections } from "./skill-graph-sections";

type DraftParams = {
  examBlueprint?: ExamOutline;
  goalKind: "learn" | "exam" | "language";
  lessonBudget?: number | null;
};

/** Normalization repairs these, but evals still report them as the model's flaws. */
const REPAIRED_CODES: ReadonlySet<SkillGraphProblem["code"]> = new Set([
  "cycle",
  "emDash",
  "markdown",
  "nearDuplicate",
]);

/** The graph is never failed for what code repaired (`repaired`), but evals report it. */
export function normalizeDraft({ params, raw }: { params: DraftParams; raw: RawSkillGraph }) {
  const repaired = findSkillGraphProblems({ exam: false, phases: raw.phases, skills: raw.skills });

  return {
    data: normalizeSkillGraph(raw, params.examBlueprint, params.lessonBudget),
    repaired: repaired.filter((problem) => REPAIRED_CODES.has(problem.code)),
  };
}

type GraphDraft = ReturnType<typeof normalizeDraft>;

/**
 * Not worth a new draft: the planner ranks a skill beyond the notice after the notice's, and one
 * phase's name would cost a whole new graph. Evals still count both.
 */
const KEPT_CODES: ReadonlySet<SkillGraphProblem["code"]> = new Set([
  "offNoticeFirst",
  "repeatedPhaseName",
]);

export function findRedraftProblems({
  data,
  params,
}: {
  data: SkillGraph;
  params: DraftParams;
}): SkillGraphProblem[] {
  return findSkillGraphProblems({
    exam: params.goalKind === "exam",
    phases: data.phases,
    skills: data.skills,
  }).filter((problem) => !KEPT_CODES.has(problem.code));
}

type GraphFrame = Pick<RawSkillGraph, "courses" | "phases">;

type SkillsCall = { output: { skills: RawSkillGraph["skills"] } };

function joinDraft({
  frame,
  params,
  written,
}: {
  frame: GraphFrame;
  params: DraftParams;
  written: readonly SkillsCall[];
}): GraphDraft {
  const raw: RawSkillGraph = {
    courses: frame.courses,
    phases: frame.phases,
    skills: joinSections(written.map((call) => call.output.skills)),
  };

  return normalizeDraft({ params, raw });
}

/**
 * Only flawed sections are written again, once, since one subject's call costs a fraction of the
 * graph. A new call is kept only when the graph has fewer problems with it.
 */
export async function redraftFlawedSections<TCall extends SkillsCall>({
  frame,
  params,
  rewrite,
  written,
}: {
  frame: GraphFrame;
  params: DraftParams;
  rewrite: (index: number) => Promise<TCall>;
  written: readonly TCall[];
}): Promise<GraphDraft & { rewrites: TCall[] }> {
  const first = joinDraft({ frame, params, written });
  const count = ({ data }: GraphDraft) => findRedraftProblems({ data, params }).length;

  const flawed = new Set(
    findRedraftProblems({ data: first.data, params }).flatMap((problem) =>
      problem.keys.flatMap((key) => getSectionCall(key) ?? []),
    ),
  );

  const rewrites = await Promise.all(
    [...flawed].map(async (index) => {
      const { data } = await safeAsync(() => rewrite(index));
      return { call: data, index };
    }),
  );

  const kept = rewrites.reduce(
    (best, { call, index }) => {
      const swapped = call ? best.written.with(index, call) : best.written;
      const draft = joinDraft({ frame, params, written: swapped });

      return count(draft) < count(best.draft) ? { draft, written: swapped } : best;
    },
    { draft: first, written },
  );

  return { ...kept.draft, rewrites: rewrites.flatMap(({ call }) => call ?? []) };
}
