import "server-only";
import { type CourseLevel } from "@zoonk/db";
import { scopeIdentityKey } from "@zoonk/utils/identity-key";
import { type LibraryProvenance } from "../_utils/library-rows";
import { createLibraryLesson } from "../lessons/create-library-lesson";
import { type ChallengeLessonSpec, getChallengeVariant } from "./challenge-lesson-spec";

type ChallengeCopy = { canDo: string; description: string; title: string };

/**
 * The outline line of a chapter's challenge, per content language. `{title}` is the chapter's
 * title; the case itself gets its own title when it's written.
 */
const CHALLENGE_COPY: Readonly<
  Record<string, Record<ChallengeLessonSpec["variant"], ChallengeCopy>>
> = {
  de: {
    whatIf: {
      canDo: "Sich vorstellen, wie die Ideen dieses Kapitels wirken",
      description: "Spiele ein „Was wäre, wenn?“ mit den Ideen dieses Kapitels durch.",
      title: "Was wäre, wenn? {title}",
    },
    work: {
      canDo: "Mit den Fähigkeiten dieses Kapitels Entscheidungen treffen",
      description: "Löse einen Fall wie im Job, mit dem, was dieses Kapitel gezeigt hat.",
      title: "Challenge: {title}",
    },
  },
  en: {
    whatIf: {
      canDo: "Imagine how this chapter's ideas play out",
      description: "Play out a “What if” with this chapter's ideas.",
      title: "What if? {title}",
    },
    work: {
      canDo: "Make decisions with this chapter's skills",
      description: "Solve a case like at work with what this chapter taught.",
      title: "Challenge: {title}",
    },
  },
  es: {
    whatIf: {
      canDo: "Imaginar cómo funcionan las ideas de este capítulo",
      description: "Explora un “¿Y si…?” con las ideas de este capítulo.",
      title: "¿Y si…? {title}",
    },
    work: {
      canDo: "Tomar decisiones con las habilidades de este capítulo",
      description: "Resuelve un caso como en el trabajo con lo que enseñó este capítulo.",
      title: "Desafío: {title}",
    },
  },
  fr: {
    whatIf: {
      canDo: "Imaginer comment les idées de ce chapitre s'appliquent",
      description: "Explorez un « Et si ? » avec les idées de ce chapitre.",
      title: "Et si ? {title}",
    },
    work: {
      canDo: "Prendre des décisions avec les compétences de ce chapitre",
      description: "Résolvez un cas comme au travail avec ce que ce chapitre vous a appris.",
      title: "Défi : {title}",
    },
  },
  pt: {
    whatIf: {
      canDo: "Imaginar como as ideias deste capítulo funcionam",
      description: "Explore um “E se?” com as ideias deste capítulo.",
      title: "E se? {title}",
    },
    work: {
      canDo: "Tomar decisões com as habilidades deste capítulo",
      description: "Resolva um caso como no trabalho com o que este capítulo ensinou.",
      title: "Desafio: {title}",
    },
  },
};

/** A work case takes about six minutes; a "What if" about four. */
const CHALLENGE_MINUTES = { whatIf: 4, work: 6 } as const;

/** A case trains a handful of the chapter's skills; more would crowd the debrief. */
const MAX_CHALLENGE_SKILLS = 6;

/**
 * One challenge per chapter: its identity is the chapter's, so a retried outline step finds the
 * same lesson instead of writing a second one.
 */
function getChallengeIdentityKey({
  chapterId,
  ownerId,
}: {
  chapterId: string;
  ownerId: string | null;
}): string {
  return scopeIdentityKey({ key: `challenge:${chapterId}`, ownerId });
}

function getChallengeCopy({
  language,
  variant,
}: {
  language: string;
  variant: ChallengeLessonSpec["variant"];
}): ChallengeCopy {
  const copy = CHALLENGE_COPY[language] ?? CHALLENGE_COPY.en;
  return copy?.[variant] ?? { canDo: "", description: "", title: "{title}" };
}

/**
 * Adds the challenge that closes a chapter: a work case, or a "What if" in an overview band. Its
 * spec is written right away (the variant and the chapter's skills), so the lesson goes straight
 * to the challenge writer when a learner reaches it. It has no skill rows, so plans find it through
 * its chapter and place it at the chapter's end. Language courses have none: their units end with a
 * conversation instead. Returns the lesson id, or null when the chapter gets no challenge.
 *
 * This is a workflow bridge: the owner comes from the goal the public boundary loaded.
 */
export async function createChapterChallenge({
  chapterId,
  chapterTitle,
  language,
  level,
  ownerId,
  provenance,
  skills,
  targetLanguage,
}: {
  chapterId: string;
  chapterTitle: string;
  language: string;
  level: CourseLevel;
  ownerId: string | null;
  provenance: LibraryProvenance;
  /** The skills the chapter's lessons teach, in teaching order. */
  skills: readonly string[];
  targetLanguage: string | null;
}): Promise<string | null> {
  const names = [...new Set(skills)].slice(0, MAX_CHALLENGE_SKILLS);

  if (targetLanguage || names.length === 0) {
    return null;
  }

  const variant = getChallengeVariant(level);
  const copy = getChallengeCopy({ language, variant });

  const spec: ChallengeLessonSpec = {
    kind: "challenge",
    skills: names.map((name) => ({ description: null, name })),
    variant,
  };

  const { lesson } = await createLibraryLesson({
    canDo: copy.canDo,
    description: copy.description,
    estimatedMinutes: CHALLENGE_MINUTES[variant],
    homeChapterId: chapterId,
    identityKey: getChallengeIdentityKey({ chapterId, ownerId }),
    language,
    level,
    ownerId,
    provenance,
    skillIds: [],
    spec,
    specStatus: "completed",
    targetLanguage,
    title: copy.title.replace("{title}", chapterTitle),
  });

  return lesson.id;
}
