import { type Skill } from "@zoonk/db";

export const ITEM_WRITING_SKILL_SELECT = {
  country: true,
  description: true,
  id: true,
  language: true,
  level: true,
  name: true,
  ownerId: true,
  targetLanguage: true,
} as const;

export type ItemWritingSkill = Pick<Skill, keyof typeof ITEM_WRITING_SKILL_SELECT>;
