import { safeAsync } from "@zoonk/utils/error";
import { type ExamOutline } from "../exam-outline";
import { type RawSkillGraph, type SkillGraph, normalizeSkillGraph } from "./normalize-skill-graph";
import { type SkillGraphProblem, findSkillGraphProblems } from "./skill-graph-checks";
import { getSectionCall, joinSections } from "./skill-graph-sections";

/** What a graph's checks and normalization read of its goal. */
type DraftParams = {
  examBlueprint?: ExamOutline;
  goalKind: "learn" | "exam" | "language";
  lessonBudget?: number | null;
};

/** What normalization repairs in what a model wrote, which evals still report as its flaws. */
const REPAIRED_CODES: ReadonlySet<SkillGraphProblem["code"]> = new Set([
  "cycle",
  "emDash",
  "markdown",
  "nearDuplicate",
]);

/**
 * A written graph, normalized, with what code repaired in it (`repaired`): a loop it broke, a
 * skill written twice it merged, em dashes and Markdown it took out. The graph is never failed for
 * those, but evals report them, so the instructions still improve.
 */
export function normalizeDraft({ params, raw }: { params: DraftParams; raw: RawSkillGraph }) {
  const repaired = findSkillGraphProblems({ exam: false, phases: raw.phases, skills: raw.skills });

  return {
    data: normalizeSkillGraph(raw, params.examBlueprint, params.lessonBudget),
    repaired: repaired.filter((problem) => REPAIRED_CODES.has(problem.code)),
  };
}

type GraphDraft = ReturnType<typeof normalizeDraft>;

/**
 * What code finds in a normalized graph that only a model can fix (`findSkillGraphProblems`): a
 * chain too deep or in a textbook's order, unfinished text, or Markdown no repair could take out.
 * Normalization already broke loops, merged skills written twice and took em dashes and Markdown
 * out, and a skill beyond the notice that opens a subject is the planner's to rank after the
 * notice's (coverage may still place it in the notice).
 */
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
  }).filter((problem) => problem.code !== "offNoticeFirst");
}

type GraphFrame = Pick<RawSkillGraph, "courses" | "phases">;

/** A call that wrote some of a big exam's sections. */
type SkillsCall = { output: { skills: RawSkillGraph["skills"] } };

/** The frame and its sections' skills as one normalized graph. */
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
 * Writes again, once, only the sections that hold a problem code finds (a subject chained in a
 * textbook's order, a skill left unfinished), since one subject's call costs a fraction of the
 * whole graph: `rewrite` writes the call at that index again. Each new call is kept when the graph
 * has fewer problems with it. Returns the graph kept and every call written again, for its cost.
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
