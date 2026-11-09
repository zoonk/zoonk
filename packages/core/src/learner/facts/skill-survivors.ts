import "server-only";
import { loadSkillSurvivorMap } from "../_utils/update-learner-skill";

/**
 * GET-only, for shared Library plan reads: merges resolve once per request and are never kept
 * between requests, since another app's merge cannot expire this app's caches.
 */
export async function readSkillSurvivors(skillIds: string[]): Promise<[string, string][]> {
  "use cache: private";

  return [...(await loadSkillSurvivorMap(skillIds))];
}
