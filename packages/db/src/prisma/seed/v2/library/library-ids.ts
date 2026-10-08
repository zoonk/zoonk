import { type SeedLanguage } from "../_utils/localize";
import { seedId } from "../_utils/seed-id";

/**
 * Stable ids for seeded Library rows, so learners, tests and E2E setups can point at a course,
 * lesson or skill without querying for it.
 */
export const libraryIds = {
  blueprint: (exam: string, language: SeedLanguage) => seedId(`blueprint:${exam}:${language}`),
  chapter: (course: string, chapter: string, language: SeedLanguage) =>
    seedId(`chapter:${course}:${chapter}:${language}`),
  course: (course: string, language: SeedLanguage) => seedId(`course:${course}:${language}`),
  item: (course: string, item: string, language: SeedLanguage) =>
    seedId(`item:${course}:${item}:${language}`),
  lesson: (course: string, lesson: string, language: SeedLanguage) =>
    seedId(`lesson:${course}:${lesson}:${language}`),
  skill: (course: string, skill: string, language: SeedLanguage) =>
    seedId(`skill:${course}:${skill}:${language}`),
  source: (source: string) => seedId(`source:${source}`),
  step: (course: string, lesson: string, position: number, language: SeedLanguage) =>
    seedId(`step:${course}:${lesson}:${position}:${language}`),
} as const;
