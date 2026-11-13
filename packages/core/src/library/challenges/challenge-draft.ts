import "server-only";
import { combineTaskProvenance } from "@zoonk/ai/combine-task-provenance";
import { assembleChallengeCase } from "@zoonk/ai/tasks/challenge/assemble";
import { fixChallengeCase } from "@zoonk/ai/tasks/challenge/fix";
import { generateChallengePlan } from "@zoonk/ai/tasks/challenge/plan";
import {
  type ChallengeCaseParams,
  type WrittenChallengeCase,
} from "@zoonk/ai/tasks/challenge/schema";
import { generateChallengeScript } from "@zoonk/ai/tasks/challenge/script";
import {
  type ChallengeFinding,
  checkChallengeQuality,
} from "@zoonk/ai/tasks/quality/challenge-quality-check";
import { checkWrittenChallenge } from "./challenge-case-content";
import { applyChallengeEdits } from "./challenge-edits";
import { checkChallengePlan } from "./challenge-plan-check";
import { renderChallengeMap } from "./render-challenge";

export type PlannedChallenge = Awaited<ReturnType<typeof planChallenge>>;

export type ScriptedChallenge = {
  content: NonNullable<ReturnType<typeof checkWrittenChallenge>["content"]>;
  provenance: ReturnType<typeof combineTaskProvenance>;
  /** The model that wrote the case's text, which also fixes it. */
  scriptModel: string;
  written: WrittenChallengeCase;
  writerModels: string[];
};

type HeldChallenge = { model: string; problems: string[] };

export type ChallengeDraft = ScriptedChallenge | HeldChallenge;

function holdBack({
  findings,
  scripted,
}: {
  findings: ChallengeFinding[];
  scripted: ScriptedChallenge;
}): HeldChallenge {
  return {
    model: scripted.provenance.model,
    problems: findings.map(
      (finding) =>
        `${finding.location} (${finding.path}): ${finding.error} Evidence: ${finding.evidence}`,
    ),
  };
}

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
    scriptModel: scripted.provenance.model,
    writerModels: [planned.provenance.model, scripted.provenance.model],
    written,
  };
}

export async function reviewChallenge({
  params,
  scripted,
}: {
  params: ChallengeCaseParams;
  scripted: ScriptedChallenge;
}): Promise<ChallengeFinding[]> {
  const reviewed = await checkChallengeQuality({
    analytics: params.analytics,
    field: params.field,
    language: params.language,
    level: params.level,
    renderedCase: renderChallengeMap({ ...scripted.content, summary: scripted.written.summary })
      .text,
    serviceTier: params.serviceTier,
    skills: params.skills,
    writerModels: scripted.writerModels,
  });

  return reviewed.data.findings;
}

/** A fix that can't be applied whole, or that breaks the case, holds the draft back on its findings. */
export async function fixChallenge({
  findings,
  params,
  scripted,
}: {
  findings: ChallengeFinding[];
  params: ChallengeCaseParams;
  scripted: ScriptedChallenge;
}): Promise<ChallengeDraft> {
  const fix = await fixChallengeCase({
    analytics: params.analytics,
    findings,
    model: scripted.scriptModel,
    reasoning: params.reasoning,
    serviceTier: params.serviceTier,
    speed: params.speed,
    written: scripted.written,
  });

  const written = applyChallengeEdits({ edits: fix.data.edits, written: scripted.written });
  const content = written && checkWrittenChallenge({ variant: params.variant, written }).content;

  if (!written || !content) {
    return holdBack({ findings, scripted });
  }

  return {
    content,
    provenance: combineTaskProvenance([scripted.provenance, fix.provenance]),
    scriptModel: scripted.scriptModel,
    writerModels: [...scripted.writerModels, fix.provenance.model],
    written,
  };
}

export async function recheckChallenge({
  fixed,
  params,
}: {
  fixed: ScriptedChallenge;
  params: ChallengeCaseParams;
}): Promise<ChallengeDraft> {
  const findings = await reviewChallenge({ params, scripted: fixed });
  return findings.length > 0 ? holdBack({ findings, scripted: fixed }) : fixed;
}
