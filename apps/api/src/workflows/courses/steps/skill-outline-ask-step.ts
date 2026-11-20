import {
  type SkillOutlineAskRef,
  endSkillOutlineAsk,
} from "@zoonk/core/lookahead/skill-outline-ask";

export async function endSkillOutlineAskStep(ask: SkillOutlineAskRef): Promise<void> {
  "use step";

  await endSkillOutlineAsk(ask);
}
