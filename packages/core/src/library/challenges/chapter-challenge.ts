import "server-only";
import { type CourseLevel } from "@zoonk/db";
import { scopeIdentityKey } from "@zoonk/utils/identity-key";
import { type SupportedLocale, getSupportedLocaleFromLanguage } from "@zoonk/utils/locale";
import { type LibraryProvenance } from "../_utils/library-rows";
import { createLibraryLesson } from "../lessons/create-library-lesson";
import { type ChallengeLessonSpec, getChallengeVariant } from "./challenge-lesson-spec";

type ChallengeCopy = { canDo: string; description: string; title: string };

const CHALLENGE_COPY: Readonly<
  Record<SupportedLocale, Record<ChallengeLessonSpec["variant"], ChallengeCopy>>
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
  it: {
    whatIf: {
      canDo: "Immaginare come si sviluppano le idee di questo capitolo",
      description: "Esplora un «E se…?» con le idee di questo capitolo.",
      title: "E se…? {title}",
    },
    work: {
      canDo: "Prendere decisioni con le competenze di questo capitolo",
      description:
        "Risolvi un caso concreto di lavoro con quello che hai imparato in questo capitolo.",
      title: "Sfida: {title}",
    },
  },
  ja: {
    whatIf: {
      canDo: "この章の考え方を使うとどうなるか想像する",
      description: "この章の考え方を使って、「もしも」を考えてみましょう。",
      title: "もしも：{title}",
    },
    work: {
      canDo: "この章のスキルを使って判断する",
      description: "この章で学んだことを使って、実際の仕事に近いケースを解決しましょう。",
      title: "チャレンジ：{title}",
    },
  },
  ko: {
    whatIf: {
      canDo: "이 장의 개념이 실제로 어떻게 작동할지 상상하기",
      description: "이 장의 개념으로 ‘만약에?’ 상황을 상상해 보세요.",
      title: "만약에? {title}",
    },
    work: {
      canDo: "이 장에서 배운 내용으로 판단하기",
      description: "이 장에서 배운 내용으로 실제 업무 같은 사례를 해결해 보세요.",
      title: "챌린지: {title}",
    },
  },
  pl: {
    whatIf: {
      canDo: "Wyobrazić sobie, jak działają idee z tego rozdziału",
      description: "Rozegraj scenariusz „A co, jeśli…?”, korzystając z tego rozdziału.",
      title: "A co, jeśli? {title}",
    },
    work: {
      canDo: "Podejmować decyzje, wykorzystując umiejętności z tego rozdziału",
      description:
        "Rozwiąż problem jak z prawdziwej pracy, korzystając z tego, czego nauczył Cię ten rozdział.",
      title: "Wyzwanie: {title}",
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
  tr: {
    whatIf: {
      canDo: "Bu bölümdeki fikirlerin nasıl işlediğini hayal etmek",
      description: "Bu bölümdeki fikirlerle bir “farz edelim ki” senaryosu kur.",
      title: "Farz edelim ki: {title}",
    },
    work: {
      canDo: "Bu bölümdeki becerilerle karar vermek",
      description: "Bu bölümde öğrendiklerinle iş hayatından bir vakayı çöz.",
      title: "Meydan okuma: {title}",
    },
  },
};

const CHALLENGE_MINUTES = { whatIf: 4, work: 6 } as const;

const MAX_CHALLENGE_SKILLS = 6;

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
  return CHALLENGE_COPY[getSupportedLocaleFromLanguage(language)][variant];
}

/** Internal workflow bridge: the owner must come from the goal the public boundary authorized. */
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
