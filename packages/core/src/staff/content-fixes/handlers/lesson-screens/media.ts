import { createHash } from "node:crypto";
import { type TransactionClient } from "@zoonk/db";
import { isJsonObject } from "@zoonk/utils/json";
import { isTTSSupportedLanguage } from "@zoonk/utils/languages";
import {
  getOptionPictureRequests,
  getPictureKey,
  getStepImageRequest,
} from "../../../../library/media/_utils/step-image-request";
import { type ContentFixMediaNeed, clipMediaKey } from "../../media-schema";
import { type Screen, type ScreenList, type ScreenMediaLink } from "./schema";
import { type ScreenLesson } from "./snapshot";

type PendingLink = { need: ContentFixMediaNeed; link: ScreenMediaLink };

export function setPictureRequest({
  entry,
  path,
  problems,
  screen,
}: {
  entry: ScreenList["screens"][number];
  path: string;
  problems: string[];
  screen: Screen;
}) {
  if (!entry.picture) {
    return;
  }

  if (entry.mediaAssetId !== undefined) {
    problems.push(`${path}.picture: request a new picture or link an existing mediaAssetId.`);
  }

  screen.content = { ...screen.content, image: entry.picture };
  screen.mediaAssetId = null;
  screen.pictureAvailableAt = null;
  screen.pictureRemovedAt = null;
}

function validatePicture({
  screen,
  original,
  picture,
  path,
  problems,
}: {
  screen: Screen;
  original?: Screen;
  picture: boolean;
  path: string;
  problems: string[];
}) {
  const request = getPictureKey(screen);

  if (
    request &&
    !picture &&
    !screen.mediaAssetId &&
    (!original || request !== getPictureKey(original))
  ) {
    problems.push(
      `${path}.mediaAssetId: request a new picture or link an existing checked picture.`,
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

async function prepareAlphabetClip(
  db: TransactionClient,
  {
    screen,
    original,
    path,
    lesson,
    problems,
  }: { screen: Screen; original?: Screen; path: string; lesson: ScreenLesson; problems: string[] },
): Promise<PendingLink | null> {
  if (screen.kind !== "alphabet") {
    return null;
  }

  const { audioText, audioUrl } = screen.content;

  if (
    original &&
    audioUrl === original.content.audioUrl &&
    audioText === original.content.audioText
  ) {
    return null;
  }

  if (!lesson.targetLanguage) {
    problems.push(`${path}.kind: alphabet cards need a lesson with a target language.`);
    return null;
  }

  if (!audioUrl && !isTTSSupportedLanguage(lesson.targetLanguage)) {
    return null;
  }

  if (!audioUrl && typeof audioText === "string" && audioText.trim()) {
    const identity = {
      language: lesson.targetLanguage,
      model: "AlphabetCard" as const,
      text: audioText,
    };

    const key = clipMediaKey(identity);

    return {
      link: { key, position: screen.position, target: "alphabet" },
      need: { ...identity, key, kind: "clip" },
    };
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
      `${path}.content.audioUrl: this alphabet card needs audioText and either a null audioUrl to generate a clip or an existing recording of "${typeof audioText === "string" ? audioText : "the letter"}" in ${lesson.targetLanguage}.`,
    );
  }

  return null;
}

function prepareIdeaIcons(list: ScreenList): PendingLink[] {
  return (list.ideas ?? []).flatMap((idea, position) => {
    if (idea.from !== undefined || !("text" in idea)) {
      return [];
    }

    const key = `idea:${String(position)}`;

    const digest = createHash("sha256")
      .update(JSON.stringify([idea.label, idea.text]))
      .digest("hex");

    const name = `idea ${digest.replaceAll(/[0-9]/gu, (digit) => "ghijklmnop"[Number(digit)] ?? "")}`;
    const description = `${idea.label}: ${idea.text}`;
    const need = { description, name, searchWords: [] };

    return [{ link: { key, position, target: "idea" }, need: { key, kind: "ideaIcon", need } }];
  });
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
  const links = await Promise.all(
    screens.map(async (screen) => {
      const entry = list.screens[screen.position];

      const original =
        entry && "id" in entry
          ? lesson.before.screens.find(({ id }) => id === entry.id)
          : undefined;

      const path = `screens[${String(screen.position)}]`;
      const issues: string[] = [];
      const pending: PendingLink[] = [];

      if (entry?.picture) {
        const request = getStepImageRequest(screen);

        if (request) {
          const key = `picture:${String(screen.position)}`;

          pending.push({
            link: { key, position: screen.position, target: "picture" },
            need: {
              alt: request.alt,
              context: request.screenText,
              key,
              kind: "picture",
              language: lesson.language,
              numberedParts: request.parts ? [...request.parts] : undefined,
              request: request.prompt,
            },
          });
        } else {
          issues.push(`${path}.picture: use a screen kind that supports a picture.`);
        }
      }

      validatePicture({
        original,
        path,
        picture: Boolean(entry?.picture),
        problems: issues,
        screen,
      });

      const clip = await prepareAlphabetClip(db, {
        lesson,
        original,
        path,
        problems: issues,
        screen,
      });

      return { issues, pending: [...pending, ...(clip ? [clip] : [])] };
    }),
  );

  problems.push(...links.flatMap(({ issues }) => issues));
  return [...links.flatMap(({ pending }) => pending), ...prepareIdeaIcons(list)];
}
