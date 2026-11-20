import { type TransactionClient } from "@zoonk/db";
import { isJsonObject } from "@zoonk/utils/json";
import { isTTSSupportedLanguage } from "@zoonk/utils/languages";
import {
  getOptionPictureRequests,
  getPictureKey,
} from "../../../../library/media/_utils/step-image-request";
import { type Screen, type ScreenList } from "./schema";
import { type ScreenLesson } from "./snapshot";

function validatePicture({
  screen,
  original,
  path,
  problems,
}: {
  screen: Screen;
  original?: Screen;
  path: string;
  problems: string[];
}) {
  const request = getPictureKey(screen);

  if (request && !screen.mediaAssetId && (!original || request !== getPictureKey(original))) {
    problems.push(
      `${path}.mediaAssetId: link an existing checked picture for the new picture request.`,
    );
  }

  if (screen.mediaAssetId && !request && screen.mediaAssetId !== original?.mediaAssetId) {
    problems.push(`${path}.content: add the picture request describing what the screen shows.`);
  }

  const previousOptions = original ? getOptionPictureRequests(original) : [];

  for (const option of getOptionPictureRequests(screen)) {
    if (
      !previousOptions.some(
        (old) =>
          old.optionId === option.optionId &&
          old.prompt === option.prompt &&
          old.alt === option.alt,
      )
    ) {
      problems.push(
        `${path}.content.options: option ${option.optionId} needs a checked picture. Keep its current picture or supply a text option.`,
      );
    }
  }

  const image = screen.content.image;

  if (
    isJsonObject(image) &&
    typeof image.url === "string" &&
    image.url !== (isJsonObject(original?.content.image) ? original.content.image.url : null)
  ) {
    problems.push(
      `${path}.content.image.url: use an existing checked mediaAssetId for a new picture.`,
    );
  }
}

async function validateAlphabetClip(
  db: TransactionClient,
  {
    screen,
    original,
    path,
    lesson,
    problems,
  }: { screen: Screen; original?: Screen; path: string; lesson: ScreenLesson; problems: string[] },
) {
  if (screen.kind !== "alphabet") {
    return;
  }

  const { audioText, audioUrl } = screen.content;

  if (
    original &&
    audioUrl === original.content.audioUrl &&
    audioText === original.content.audioText
  ) {
    return;
  }

  if (!lesson.targetLanguage) {
    problems.push(`${path}.kind: alphabet cards need a lesson with a target language.`);
    return;
  }

  if (!audioUrl && !isTTSSupportedLanguage(lesson.targetLanguage)) {
    return;
  }

  const existing =
    typeof audioUrl === "string" &&
    typeof audioText === "string" &&
    (await db.step.findFirst({
      select: { id: true },
      where: {
        AND: [
          { content: { equals: audioUrl, path: ["audioUrl"] } },
          { content: { equals: audioText, path: ["audioText"] } },
        ],
        kind: "alphabet",
        lesson: { ownerId: null, targetLanguage: lesson.targetLanguage, visibility: "public" },
      },
    }));

  if (!existing) {
    problems.push(
      `${path}.content.audioUrl: this alphabet card needs an existing recording of "${typeof audioText === "string" ? audioText : "the letter"}" in ${lesson.targetLanguage}.`,
    );
  }
}

export async function checkProposedMedia(
  db: TransactionClient,
  {
    screens,
    lesson,
    list,
    problems,
  }: { screens: Screen[]; lesson: ScreenLesson; list: ScreenList; problems: string[] },
) {
  const invalid = await Promise.all(
    screens.map(async (screen) => {
      const entry = list.screens[screen.position];

      const original =
        entry && "id" in entry
          ? lesson.before.screens.find(({ id }) => id === entry.id)
          : undefined;

      const path = `screens[${String(screen.position)}]`;
      const issues: string[] = [];

      if (entry?.picture) {
        issues.push(
          `${path}.picture: a new picture needs a checked mediaAssetId. Link the checked asset before approval.`,
        );
      }

      validatePicture({ original, path, problems: issues, screen });
      await validateAlphabetClip(db, { lesson, original, path, problems: issues, screen });
      return issues;
    }),
  );

  problems.push(...invalid.flat());
}
