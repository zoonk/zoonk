import { type TransactionClient } from "@zoonk/db";
import { PlanInputWriteConflictError } from "../../../../library/_utils/plan-input-write";
import { toAudioData } from "../../../../library/language/_utils/audio-data";
import { readSavedLessonMap } from "../../../../library/lessons/lesson-map";
import { type FixContext } from "../fix-handler";
import { type ScreenSnapshot, type StoredScreens } from "./schema";

function linkIdeaIcon({
  after,
  iconId,
  position,
}: {
  after: ScreenSnapshot;
  iconId: string;
  position: number;
}) {
  const map = readSavedLessonMap(after.summary);
  const idea = map?.ideas[position];

  if (map && idea) {
    idea.iconId = iconId;
    after.summary = map;
  }
}

export function linkScreenMedia(change: StoredScreens, context: FixContext): ScreenSnapshot {
  if (!change.mediaLinks?.length) {
    return change.after;
  }

  const after = structuredClone(change.after);

  for (const link of change.mediaLinks) {
    const media = context.media.get(link.key);

    if (media?.kind === "picture" && link.target === "picture") {
      const screen = after.screens.find(({ position }) => position === link.position);

      if (screen) {
        screen.mediaAssetId = media.mediaAssetId;
        screen.pictureAvailableAt = context.now.toISOString();
      }
    } else if (link.target === "alphabet" && media?.kind === "clip") {
      const screen = after.screens.find(({ position }) => position === link.position);

      if (screen) {
        screen.content.audioUrl = media.url;
      }
    } else if (link.target === "idea" && media?.kind === "ideaIcon") {
      linkIdeaIcon({ after, iconId: media.iconId, position: link.position });
    } else if ("id" in link && media?.kind === "clip") {
      const rows = link.target === "word" ? after.words : after.sentences;
      const row = rows.find(({ id }) => id === link.id);

      if (row) {
        row.audioUrl = media.url;
      }
    } else {
      throw new Error(`Missing reviewed lesson media for ${link.key}`);
    }
  }

  return after;
}

export async function linkVocabularyMedia(
  tx: TransactionClient,
  change: StoredScreens,
  context: FixContext,
) {
  await Promise.all(
    (change.mediaLinks ?? []).map(async (link) => {
      if (link.target !== "word" && link.target !== "sentence") {
        return;
      }

      const media = context.media.get(link.key);

      if (media?.kind !== "clip") {
        throw new Error(`Missing reviewed vocabulary clip for ${link.key}`);
      }

      const data = toAudioData(media);
      const provenance = { model: "staff", promptVersion: "setScreens", runId: context.fixId };
      const where = { audioUrl: null, id: link.id, targetLanguage: link.language };

      const saveWord = async () => {
        const word = change.after.words.find(({ id }) => id === link.id);

        if (!word) {
          throw new Error("Missing reviewed word");
        }

        return link.create
          ? tx.word.createMany({
              data: {
                ...data,
                ...provenance,
                id: word.id,
                organizationId: word.organizationId,
                targetLanguage: link.language,
                word: word.word,
              },
              skipDuplicates: true,
            })
          : tx.word.updateMany({
              data,
              where: {
                ...where,
                organizationId: word.organizationId,
                romanization: word.romanization,
                word: word.word,
              },
            });
      };

      const saveSentence = async () => {
        const sentence = change.after.sentences.find(({ id }) => id === link.id);

        if (!sentence) {
          throw new Error("Missing reviewed sentence");
        }

        return link.create
          ? tx.sentence.createMany({
              data: {
                ...data,
                ...provenance,
                id: sentence.id,
                organizationId: sentence.organizationId,
                sentence: sentence.sentence,
                targetLanguage: link.language,
              },
              skipDuplicates: true,
            })
          : tx.sentence.updateMany({
              data,
              where: {
                ...where,
                organizationId: sentence.organizationId,
                romanization: sentence.romanization,
                sentence: sentence.sentence,
              },
            });
      };

      const { count } = await (link.target === "word" ? saveWord() : saveSentence());

      if (count !== 1) {
        throw new PlanInputWriteConflictError("The shared vocabulary changed during approval.");
      }
    }),
  );
}
