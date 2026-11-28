import { scopeIdentityKey } from "@zoonk/utils/identity-key";

export const SECOND_TAKE_MINUTES = 4;

const SECOND_TAKE_KEY = "retake:";
export const SECOND_TAKE_KEY_WHERE = {
  OR: [
    { identityKey: { startsWith: SECOND_TAKE_KEY } },
    { identityKey: { contains: `:${SECOND_TAKE_KEY}` } },
  ],
};
export const SECOND_TAKE_IDENTITY_PATTERN = `(^|:)${SECOND_TAKE_KEY}[0-9a-f-]{36}$`;
const secondTakeIdentity = new RegExp(SECOND_TAKE_IDENTITY_PATTERN, "u");

export function getSecondTakeIdentityKey({
  ownerId,
  skillId,
}: {
  ownerId: string | null;
  skillId: string;
}): string {
  return scopeIdentityKey({ key: `${SECOND_TAKE_KEY}${skillId}`, ownerId });
}

export function isSecondTakeIdentityKey(identityKey: string): boolean {
  return getSecondTakeSkillId(identityKey) !== null;
}

export function getSecondTakeSkillId(identityKey: string): string | null {
  return secondTakeIdentity.test(identityKey)
    ? (identityKey.split(SECOND_TAKE_KEY).at(-1) ?? null)
    : null;
}
