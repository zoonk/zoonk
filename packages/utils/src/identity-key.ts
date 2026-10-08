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

/**
 * Keeps unique indexes valid for long URLs and prompts. A hashed key still
 * identifies one item exactly, which is all the unique constraint needs.
 */
function boundIdentityKey(key: string): string {
  if (key.length <= MAX_IDENTITY_KEY_LENGTH) {
    return key;
  }

  return `sha256:${hashText(key)}`;
}

/**
 * Reduces text to its words so casing, accents, spacing and punctuation never
 * turn one identity into two ("Regra de Três" and "regra de tres!" match).
 */
export function normalizeIdentityText(value: string): string {
  return (removeAccents(value).toLowerCase().match(WORD_PATTERN) ?? []).join("-");
}

/** Positional parts keep keys readable and unambiguous: an empty target language stays empty. */
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

/** Every public setup skill's key starts with this, so shared plans can leave them out. */
export const SETUP_SKILL_KEY_PREFIX = ":setup:";

/**
 * A setup lesson's skill ("Set up Python on Windows") is the tool and the device, however a model
 * words its name, so everyone who sets up the same tool on the same device shares its lesson.
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

/**
 * A lesson is the set of skills it teaches at one level of one course. Skills are shared across
 * courses, but the same skills teach different content in another subject ("find the main idea"
 * in an English-reading course and in a Portuguese one), so only lessons of the same course match
 * exactly; another course's lesson is reused only when the reuse decision sees both courses.
 * Lessons outside any course (quick explanations, setup lessons) have an empty course part.
 *
 * An outline sometimes splits one skill set into several lessons ("Lançamento de ofício", "por
 * declaração" and "por homologação", all on "Classify assessment types"). Those lessons pass their
 * `title`, which tells them apart, so each keeps its own row instead of all becoming the first.
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

/**
 * A chapter is its scope at one level of one course; the title is the scope's most stable name.
 * The same title names different content in another subject, so only the same course matches
 * exactly.
 */
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

/**
 * The same document is often linked with and without `www`, `https`, a
 * trailing slash, a fragment or tracking parameters. None of those change the
 * document, so none of them are part of its identity.
 */
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

/** A web source is its canonical URL; an upload is its content hash. */
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

/** Every image key of one style version starts with this, so search keeps versions apart. */
export function getImageReuseKeyPrefix({ styleVersion }: { styleVersion: number }): string {
  return `image:v${styleVersion}:`;
}

/**
 * The same scene in the same style makes the same picture. An image with
 * labels is made per language; one without text (`language` null) serves
 * every language. Scenes are long, so the key keeps only their hash.
 */
export function buildImageReuseKey({
  language,
  prompt,
  styleVersion,
}: {
  language: string | null;
  prompt: string;
  styleVersion: number;
}): string {
  const prefix = getImageReuseKeyPrefix({ styleVersion });
  return `${prefix}${language ?? "any"}:${hashText(normalizeIdentityText(prompt))}`;
}

/**
 * Private content (a learner's too-specific goal) lives in its owner's own key
 * space, so an exact match never crosses owners and public search can exclude it.
 */
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
 * A private row under a public key would be found by other learners' exact
 * matches, and a public row under a private key would hide shared content, so
 * writes refuse a key from the wrong key space.
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
