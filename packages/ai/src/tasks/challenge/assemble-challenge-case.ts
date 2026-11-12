import { type WrittenChallengeCase } from "./challenge-case";
import { type ChallengePlan } from "./challenge-plan";
import { type ChallengeScript } from "./challenge-script";

type PlanDecision = ChallengePlan["decisions"][number];
type ScriptDecision = ChallengeScript["decisions"][number];

function assembleChoice({
  meters,
  planned,
  written,
}: {
  meters: ReadonlySet<string>;
  planned: PlanDecision["choices"][number];
  written: ScriptDecision["choices"][number];
}): WrittenChallengeCase["nodes"][number]["choices"][number] {
  return {
    effects: written.effects.filter((effect) => meters.has(effect.meter)),
    id: planned.id,
    next: planned.next,
    notes: written.notes,
    quality: planned.quality,
    replies: written.replies,
    text: written.text,
    timeJump: planned.timePasses ? { label: planned.timePasses, panel: written.panel } : null,
  };
}

export function assembleChallengeCase({
  plan,
  script,
}: {
  plan: ChallengePlan;
  script: ChallengeScript;
}): { missing: string[]; written: WrittenChallengeCase } {
  const missing: string[] = [];
  const meters = new Set(plan.meters.map((meter) => meter.id));

  const nodes = plan.decisions.flatMap((decision) => {
    const scripted = script.decisions.find((item) => item.id === decision.id);

    if (!scripted) {
      missing.push(`decision "${decision.id}"`);
      return [];
    }

    const choices = decision.choices.flatMap((planned) => {
      const written = scripted.choices.find((item) => item.id === planned.id);

      if (!written) {
        missing.push(`choice "${decision.id}.${planned.id}"`);
        return [];
      }

      return [assembleChoice({ meters, planned, written })];
    });

    return [{ choices, id: decision.id, messages: scripted.messages, prompt: scripted.prompt }];
  });

  const endings = plan.endings.flatMap((ending) => {
    const scripted = script.endings.find((item) => item.id === ending.id);

    if (!scripted) {
      missing.push(`ending "${ending.id}"`);
      return [];
    }

    return [{ id: ending.id, outcome: scripted.outcome }];
  });

  return {
    missing,
    written: {
      deadline: plan.deadline ?? null,
      endings,
      meters: plan.meters,
      mission: plan.mission,
      nodes,
      panels: plan.panels,
      setting: plan.setting,
      skills: plan.skills,
      startNodeId: plan.startDecisionId,
      summary: script.summary,
      team: plan.team,
      title: plan.title,
    },
  };
}

export function draftEmptyScript(plan: ChallengePlan): ChallengeScript {
  const placeholder = "-";

  return {
    decisions: plan.decisions.map((decision) => ({
      choices: decision.choices.map((choice) => ({
        effects: [],
        id: choice.id,
        notes: decision.skills.map((skill) => ({
          example: null,
          kind: "good" as const,
          skill,
          text: placeholder,
        })),
        panel: null,
        replies: [],
        text: placeholder,
      })),
      id: decision.id,
      messages: [],
      prompt: placeholder,
    })),
    endings: plan.endings.map((ending) => ({ id: ending.id, outcome: placeholder })),
    summary: [],
  };
}
