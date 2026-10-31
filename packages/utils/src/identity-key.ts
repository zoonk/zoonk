import { createHash } from "node:crypto";
import { removeAccents } from "./string";

/** Keys stay well under Postgres' btree row limit; longer ones are replaced by their hash. */
const MAX_IDENTITY_KEY_LENGTH = 200;
const HASH_LENGTH = 40;
const PRIVATE_KEY_PREFIX = "private:";
const WORD_PATTERN = /[\p{L}\p{M}\p{N}]+/gu;
const TRACKING_PARAM_PATTERN = /^(?:utm_|fbclid$|gclid$|mc_cid$|mc_eid$)/u;

function hashText(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, HASH_LENGTH);
}

function boundIdentityKey(key: string): string {
  if (key.length <= MAX_IDENTITY_KEY_LENGTH) {
    return key;
  }

  return `sha256:${hashText(key)}`;
}

export function normalizeIdentityText(value: string): string {
  return (removeAccents(value).toLowerCase().match(WORD_PATTERN) ?? []).join("-");
}

function joinKeyParts(parts: (string | null | undefined)[]): string {
  return boundIdentityKey(parts.map((part) => part ?? "").join(":"));
}

/** A skill is the same wherever it's taught, so its level is not part of its identity. */
export function buildSkillIdentityKey({
  name,
  targetLanguage,
}: {
  name: string;
  targetLanguage: string | null;
}): string {
  return joinKeyParts([targetLanguage, normalizeIdentityText(name)]);
}

export const SETUP_SKILL_KEY_PREFIX = ":setup:";

/**
 * A setup skill is its tool and device, however a model words its name, so everyone who sets up the
 * same tool on the same device shares its lesson.
 */
export function buildSetupSkillIdentityKey({
  system,
  tool,
}: {
  system: string;
  tool: string;
}): string {
  return boundIdentityKey(`${SETUP_SKILL_KEY_PREFIX}${normalizeIdentityText(tool)}:${system}`);
}

/** Owner-scoped keys put the owner first, so the prefix can sit anywhere in the key. */
export function isSetupSkillIdentityKey(identityKey: string): boolean {
  return identityKey.includes(SETUP_SKILL_KEY_PREFIX);
}

/**
 * The same skills teach different content in another subject, so only lessons of the same course
 * match exactly. An outline can split one skill set into several lessons; their `title` keeps each
 * in its own row.
 */
export function buildLessonIdentityKey({
  courseId,
  level,
  skillIds,
  targetLanguage,
  title = null,
}: {
  courseId: string | null;
  level: string;
  skillIds: readonly string[];
  targetLanguage: string | null;
  title?: string | null;
}): string {
  const skills = [...new Set(skillIds)].toSorted();

  if (skills.length === 0) {
    throw new Error("A lesson identity needs at least one skill.");
  }

  const parts = [level, targetLanguage, courseId, skills.join("+")];

  return joinKeyParts(title === null ? parts : [...parts, normalizeIdentityText(title)]);
}

/** The same title names different content in another subject, so only the same course matches. */
export function buildChapterIdentityKey({
  courseId,
  level,
  targetLanguage,
  title,
}: {
  courseId: string | null;
  level: string;
  targetLanguage: string | null;
  title: string;
}): string {
  return joinKeyParts([level, targetLanguage, courseId, normalizeIdentityText(title)]);
}

function isTrackingParam(name: string): boolean {
  return TRACKING_PARAM_PATTERN.test(name.toLowerCase());
}

function canonicalizeUrl(url: string): string {
  const parsed = new URL(url.trim());
  const host = parsed.host.replace(/^www\./u, "");
  const path = parsed.pathname.length > 1 ? parsed.pathname.replace(/\/+$/u, "") : "";

  const query = [...parsed.searchParams.entries()]
    .filter(([name]) => !isTrackingParam(name))
    .toSorted(([first], [second]) => first.localeCompare(second));

  const search = query.length > 0 ? `?${new URLSearchParams(query).toString()}` : "";

  return `${host}${path}${search}`;
}

export function buildSourceIdentityKey({
  contentHash,
  url,
}: {
  contentHash: string | null;
  url: string | null;
}): string {
  if (url) {
    return boundIdentityKey(canonicalizeUrl(url));
  }

  if (contentHash) {
    return `upload:${contentHash}`;
  }

  throw new Error("A source identity needs a URL or a content hash.");
}

/**
 * The style isn't part of the key: a style change draws new scenes only, and redrawing stored
 * pictures is a person's call.
 */
export function buildImageReuseKey({
  language,
  prompt,
}: {
  language: string | null;
  prompt: string;
}): string {
  return `image:${language ?? "any"}:${hashText(normalizeIdentityText(prompt))}`;
}

/** An exact match never crosses owners, and public search can exclude private keys. */
export function scopeIdentityKey({
  key,
  ownerId,
}: {
  key: string;
  ownerId: string | null | undefined;
}): string {
  return ownerId ? `${PRIVATE_KEY_PREFIX}${ownerId}:${key}` : key;
}

function isKeyScopedTo({ key, ownerId }: { key: string; ownerId: string | null }): boolean {
  if (ownerId) {
    return key.startsWith(`${PRIVATE_KEY_PREFIX}${ownerId}:`);
  }

  return !key.startsWith(PRIVATE_KEY_PREFIX);
}

/**
 * Throws for a key from the wrong key space: a private row under a public key would reach other
 * learners' exact matches, and a public row under a private key would hide shared content.
 */
export function assertIdentityKeyScope({
  key,
  ownerId,
}: {
  key: string;
  ownerId: string | null;
}): void {
  if (!isKeyScopedTo({ key, ownerId })) {
    throw new Error(`Identity key ${key} doesn't belong to this owner's key space.`);
  }
}
