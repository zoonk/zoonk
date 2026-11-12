import "server-only";
import { combineTaskProvenance } from "@zoonk/ai/combine-task-provenance";
import { assembleChallengeCase } from "@zoonk/ai/tasks/challenge/assemble";
import { generateChallengePlan } from "@zoonk/ai/tasks/challenge/plan";
import { type ChallengeCaseParams } from "@zoonk/ai/tasks/challenge/schema";
import { generateChallengeScript } from "@zoonk/ai/tasks/challenge/script";
import { checkChallengeQuality } from "@zoonk/ai/tasks/quality/challenge-quality-check";
import { checkWrittenChallenge } from "./challenge-case-content";
import { checkChallengePlan } from "./challenge-plan-check";
import { renderChallengeMap } from "./render-challenge";

export type PlannedChallenge = Awaited<ReturnType<typeof planChallenge>>;

export type ScriptedChallenge = {
  content: NonNullable<ReturnType<typeof checkWrittenChallenge>["content"]>;
  provenance: ReturnType<typeof combineTaskProvenance>;
  summary: { ideas: { text: string }[]; shape: "hub" };
  writerModels: string[];
};

export type ChallengeDraft = ScriptedChallenge | { model: string; problems: string[] };

export async function planChallenge(params: ChallengeCaseParams) {
  const { data: plan, provenance } = await generateChallengePlan(params);
  const problems = checkChallengePlan({ plan, skills: params.skills, variant: params.variant });
  return { plan, problems, provenance };
}

export async function scriptChallenge({
  params,
  planned,
}: {
  params: ChallengeCaseParams;
  planned: PlannedChallenge;
}): Promise<ChallengeDraft> {
  const scripted = await generateChallengeScript({ ...params, plan: planned.plan });
  const { missing, written } = assembleChallengeCase({ plan: planned.plan, script: scripted.data });
  const checked = checkWrittenChallenge({ variant: params.variant, written });
  const provenance = combineTaskProvenance([planned.provenance, scripted.provenance]);
  const problems = [...missing.map((id) => `The script left out ${id}`), ...checked.problems];

  if (!checked.content || problems.length > 0) {
    return { model: provenance.model, problems };
  }

  return {
    content: checked.content,
    provenance,
    summary: { ideas: scripted.data.summary.map((text) => ({ text })), shape: "hub" },
    writerModels: [planned.provenance.model, scripted.provenance.model],
  };
}

export async function reviewChallenge({
  params,
  scripted,
}: {
  params: ChallengeCaseParams;
  scripted: ScriptedChallenge;
}) {
  const reviewed = await checkChallengeQuality({
    analytics: params.analytics,
    field: params.field,
    language: params.language,
    level: params.level,
    renderedCase: renderChallengeMap({
      ...scripted.content,
      summary: scripted.summary.ideas.map((idea) => idea.text),
    }).text,
    serviceTier: params.serviceTier,
    skills: params.skills,
    writerModels: scripted.writerModels,
  });

  return reviewed.data.findings.map(
    (finding) =>
      `${finding.location} (${finding.path}): ${finding.error} Evidence: ${finding.evidence}`,
  );
}
