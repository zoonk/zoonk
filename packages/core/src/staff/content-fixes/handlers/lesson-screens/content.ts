import { randomUUID } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import { checkScreenContentChange } from "../../screen-content-rules";
import { screenContentProblem } from "../screens";
import { remapBasis } from "./basis";
import { type mapIdeas } from "./ideas";
import { type Screen, type ScreenList } from "./schema";
import { type ScreenLesson } from "./snapshot";
import { type resolveVocabulary } from "./vocabulary";

type Entry = ScreenList["screens"][number];
type Vocabulary = Awaited<ReturnType<typeof resolveVocabulary>>;

function validateEdit({
  content,
  original,
  kind,
  path,
  picture,
  problems,
}: {
  content: Screen["content"];
  original?: Screen["content"];
  kind: Screen["kind"];
  path: string;
  picture?: boolean;
  problems: string[];
}) {
  const invalid = screenContentProblem({ content, kind });

  if (invalid) {
    problems.push(`${path}: ${invalid}. Correct the screen's fields.`);
  }

  if (!original) {
    return;
  }

  const { image: _newImage, ...prose } = content;
  const { image: _oldImage, ...originalProse } = original;

  const verdict = checkScreenContentChange({
    after: picture ? prose : content,
    before: picture ? originalProse : original,
    keyedElsewhere: false,
    kind,
  });

  if (!verdict.ok) {
    problems.push(`${path}: ${verdict.problem} Replace the screen if its structure changes.`);
  }
}

type Context = {
  entry: Entry;
  screen: Screen;
  original?: Screen;
  list: ScreenList;
  vocabulary: Vocabulary;
  map: ReturnType<typeof mapIdeas>;
  path: string;
  problems: string[];
};

function setSummary({
  screen,
  list,
  map,
  entry,
  original,
  path,
  problems,
}: Omit<Context, "vocabulary">) {
  if (screen.kind === "summary" && list.ideas) {
    screen.content = { ideas: map.ideas.map(({ text }) => ({ text })) };
  }

  if (
    screen.kind === "summary" &&
    !list.ideas &&
    map.ideas.length > 0 &&
    (entry.content || !original) &&
    !isDeepStrictEqual(
      screen.content.ideas,
      map.ideas.map(({ text }) => ({ text })),
    )
  ) {
    problems.push(
      `${path}.content.ideas: supply the final map in setScreens.ideas to change its closing summary.`,
    );
  }
}

function setSpokenContent({
  screen,
  entry,
  original,
  list,
  vocabulary,
  path,
  problems,
}: Omit<Context, "map">) {
  if (
    screen.kind !== "spokenAnswer" ||
    !screen.sentenceId ||
    !(entry.content || !original || list.sentences)
  ) {
    return;
  }

  const row = vocabulary.sentences.find(({ id }) => id === screen.sentenceId);

  if (!row) {
    return;
  }

  const fields = {
    romanization: row.romanization,
    targetText: row.sentence,
    translation: row.translation,
  };

  if (
    entry.content &&
    Object.entries(fields).some(
      ([key, value]) =>
        entry.content?.[key] !== undefined &&
        entry.content[key] !== original?.content[key] &&
        entry.content[key] !== value,
    )
  ) {
    problems.push(`${path}.content: edit copied sentence fields in sentences.`);
  }

  const { romanization: _previous, ...content } = screen.content;

  screen.content = {
    ...content,
    targetText: row.sentence,
    translation: row.translation,
    ...(row.romanization && { romanization: row.romanization }),
  };
}

export function setContent({
  entry,
  screen,
  original,
  list,
  vocabulary,
  map,
  path,
  problems,
}: Context) {
  if (screen.wordId && !vocabulary.wordRefs.has(screen.wordId)) {
    problems.push(`${path}.word: keep this word in words or remove the screen.`);
  }

  if (screen.sentenceId && !vocabulary.sentenceRefs.has(screen.sentenceId)) {
    problems.push(`${path}.sentence: keep this sentence in sentences or remove the screen.`);
  }

  setSpokenContent({ entry, list, original, path, problems, screen, vocabulary });
  setSummary({ entry, list, map, original, path, problems, screen });

  if (entry.content || entry.picture || !original) {
    validateEdit({
      content: screen.content,
      kind: screen.kind,
      original: original?.content,
      path: `${path}.content`,
      picture: Boolean(entry.picture),
      problems,
    });
  }

  if (original?.itemId && entry.content && !isDeepStrictEqual(entry.content, original.content)) {
    problems.push(
      `${path}.content: replace the linked numeric check with a numeric question so practice grades the same problem.`,
    );
  }
}

export function editVariants({
  base,
  entry,
  lesson,
  list,
  path,
  problems,
  allocatedScreen,
}: Pick<Context, "entry" | "list" | "path" | "problems"> & {
  base: Screen;
  lesson: ScreenLesson;
  allocatedScreen?: Screen;
}) {
  const variants = "variants" in entry ? (entry.variants ?? []) : [];

  if (
    new Set(variants.map(({ id }) => id)).size !== variants.length ||
    variants.some(({ id }) => !base.variants.some((variant) => variant.id === id))
  ) {
    problems.push(`${path}.variants: use each current variant ID from this screen at most once.`);
  }

  return base.variants.map((variant, index) => {
    const edit = variants.find(({ id }) => id === variant.id);

    if (edit) {
      validateEdit({
        content: edit.content,
        kind: base.kind,
        original: variant.content,
        path: `${path}.variants[${String(index)}].content`,
        problems,
      });
    }

    return {
      ...variant,
      content: remapBasis({
        content: edit?.content ?? variant.content,
        lesson,
        list,
        original: variant.content,
      }),
      id: allocatedScreen?.variants[index]?.id ?? randomUUID(),
    };
  });
}
