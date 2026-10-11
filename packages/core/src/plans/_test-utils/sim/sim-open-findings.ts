import { type SimFixtureName } from "./sim-fixture";

/**
 * The rules each fixture's lives still break, with the open bug behind each (reported to the
 * planner's owner with the life that shows it). A large run fails on any other rule: remove an
 * entry with its fix.
 */
const OPEN_FINDINGS: Record<SimFixtureName, Partial<Record<string, string>>> = {
  camara: {},
  career: {},
  "class-test": {},
  enem: {},
  ielts: {},
  language: {},
  oab: {},
};

/**
 * Rules only the database tier can check (it alone has sessions and the lessons the learner
 * finished) that its lives still break, with the open bug behind each. The fast tier never breaks
 * them, so they aren't listed by fixture: unlist one when its fix lands.
 */
const OPEN_DB_FINDINGS: Partial<Record<string, string>> = {};

/** Whether a fixture's lives are known to break a rule (see `OPEN_FINDINGS`, `OPEN_DB_FINDINGS`). */
export function isOpenFinding({ fixture, rule }: { fixture: SimFixtureName; rule: string }) {
  return Object.hasOwn(OPEN_FINDINGS[fixture], rule) || Object.hasOwn(OPEN_DB_FINDINGS, rule);
}
