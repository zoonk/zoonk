import "server-only";
import { loadSkillSurvivorMap } from "../_utils/update-learner-skill";

/**
 * GET-only, for shared Library plan reads: merges resolve once per request. No tag fits, since
 * another app's merge cannot expire this app's caches, so after a merge `next dev` answers the next
 * request from its in-memory copy while it reads again; production never keeps it between requests.
 */
export async function readSkillSurvivors(skillIds: string[]): Promise<[string, string][]> {
  "use cache: private";

  return [...(await loadSkillSurvivorMap(skillIds))];
}
