import { randomUUID } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import { getLessonScreenSkillId } from "../../../../library/lessons/_utils/lesson-screen-skill";
import { STEP_CONTRACT_VERSION } from "../../../../library/steps/contract/step-contract";
import { type ContentFixEffect } from "../../contract";
import { prepareAdded } from "./added";
import { checkBasis, remapBasis } from "./basis";
import { editVariants, setContent } from "./content";
import { mapIdeas, remapMarks } from "./ideas";
import { setPictureRequest } from "./media";
import { changedRows } from "./references";
import { type Screen, type ScreenList, type StoredScreens } from "./schema";
import { type ScreenLesson } from "./snapshot";
import { type resolveVocabulary } from "./vocabulary";

type Entry = ScreenList["screens"][number];
type Vocabulary = Awaited<ReturnType<typeof resolveVocabulary>>;

function blankScreen({
  entry,
  lesson,
}: {
  entry: Extract<Entry, { kind: string }>;
  lesson: ScreenLesson;
}): Screen {
  return {
    content: {},
    contractVersion: STEP_CONTRACT_VERSION,
    id: "",
    itemId: null,
    kind: entry.kind,
    marks: null,
    mediaAssetId: null,
    optionPictures: [],
    pictureAvailableAt: null,
    pictureRemovedAt: null,
    position: 0,
    provenance: null,
    sentenceId: null,
    skillId: getLessonScreenSkillId({
      lessonSkillIds: lesson.skillIds,
      skillId: entry.skillId ?? null,
    }),
    sourceId: null,
    sourcePage: null,
    sources: [],
    variants: [],
    wordId: null,
  };
}

function draftScreen({
  base,
  entry,
  id,
  position,
}: {
  base: Screen;
  entry: Entry;
  id: string;
  position: number;
}): Screen {
  return {
    ...base,
    content: entry.content ?? base.content,
    id,
    position,
    ...(entry.citation !== undefined && {
      sourceId: entry.citation?.sourceId ?? null,
      sourcePage: entry.citation?.page ?? null,
    }),
    ...(entry.mediaAssetId !== undefined &&
      entry.mediaAssetId !== base.mediaAssetId && {
        mediaAssetId: entry.mediaAssetId,
        pictureAvailableAt: null,
        pictureRemovedAt: null,
      }),
  };
}

function screenWasEdited({
  base,
  changedSentenceIds,
  changedWordIds,
  contentChanged,
  entry,
  screen,
}: {
  base: Screen;
  changedSentenceIds: string[];
  changedWordIds: string[];
  contentChanged: boolean;
  entry: Entry;
  screen: Screen;
}) {
  return (
    contentChanged ||
    screen.variants.some(({ provenance }) => provenance === null) ||
    Boolean(entry.picture) ||
    (screen.wordId !== null && changedWordIds.includes(screen.wordId)) ||
    (screen.sentenceId !== null && changedSentenceIds.includes(screen.sentenceId)) ||
    screen.mediaAssetId !== base.mediaAssetId ||
    screen.sourceId !== base.sourceId ||
    screen.sourcePage !== base.sourcePage
  );
}

export function buildScreens({
  lesson,
  list,
  vocabulary,
  allocated,
  problems,
}: {
  lesson: ScreenLesson;
  list: ScreenList;
  vocabulary: Vocabulary;
  allocated?: StoredScreens;
  problems: string[];
}) {
  const map = mapIdeas({ lesson, list, problems });
  const effects: ContentFixEffect[] = [];
  const newItems: StoredScreens["newItems"] = [];
  const used = new Set<string>();

  const changedWordIds = changedRows(lesson.before.words, vocabulary.words);
  const changedSentenceIds = changedRows(lesson.before.sentences, vocabulary.sentences);

  const screens = list.screens.flatMap((entry, position): Screen[] => {
    const path = `screens[${String(position)}]`;

    const original =
      "id" in entry ? lesson.before.screens.find(({ id }) => id === entry.id) : undefined;

    const base = "kind" in entry ? blankScreen({ entry, lesson }) : original;

    if (!base) {
      problems.push(`${path}.id: use an ID from the current lesson version.`);
      return [];
    }

    if ("id" in entry && used.has(entry.id)) {
      problems.push(`${path}.id: keep a screen only once.`);
    }

    used.add(base.id);
    const allocatedScreen = allocated?.after.screens[position];

    const screen = draftScreen({ base, entry, id: allocatedScreen?.id ?? randomUUID(), position });

    if ("kind" in entry) {
      prepareAdded({
        allocatedScreen,
        entry,
        lesson,
        newItems,
        path,
        problems,
        screen,
        vocabulary,
      });
    }

    setPictureRequest({ entry, path, problems, screen });
    setContent({ entry, list, map, original, path, problems, screen, vocabulary });
    screen.variants = editVariants({ allocatedScreen, base, entry, lesson, list, path, problems });
    const contentChanged = !isDeepStrictEqual(screen.content, base.content);

    screen.provenance = screenWasEdited({
      base,
      changedSentenceIds,
      changedWordIds,
      contentChanged,
      entry,
      screen,
    })
      ? null
      : base.provenance;

    if ("id" in entry && entry.content) {
      const count = base.variants.length - (entry.variants?.length ?? 0);

      if (count > 0) {
        effects.push({ count, kind: "variantsKept", stepId: base.id });
      }
    }

    screen.content = remapBasis({
      content: screen.content,
      lesson,
      list,
      original: original?.content,
    });

    screen.marks = remapMarks({ base, contentChanged, entry, list, map, path, problems, screen });
    return [screen];
  });

  for (const [index, screen] of screens.entries()) {
    const path = `screens[${String(index)}]`;
    checkBasis({ content: screen.content, index, path: `${path}.content`, problems, screens });

    for (const [variantIndex, variant] of screen.variants.entries()) {
      checkBasis({
        content: variant.content,
        index,
        path: `${path}.variants[${String(variantIndex)}].content`,
        problems,
        screens,
      });
    }
  }

  for (const [index, word] of vocabulary.words.entries()) {
    if (!screens.some(({ wordId }) => wordId === word.id)) {
      problems.push(
        `words[${String(index)}]: add a screen for "${word.word}" or leave it out of words.`,
      );
    }
  }

  for (const [index, sentence] of vocabulary.sentences.entries()) {
    if (!screens.some(({ sentenceId }) => sentenceId === sentence.id)) {
      problems.push(
        `sentences[${String(index)}]: add a screen for "${sentence.sentence}" or leave it out of sentences.`,
      );
    }
  }

  return { effects, newItems, screens, summary: map.summary };
}
