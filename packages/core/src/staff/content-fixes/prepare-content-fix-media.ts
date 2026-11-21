import "server-only";
import { toIconNeed } from "@zoonk/ai/tasks/icons/need";
import { prisma, sql } from "@zoonk/db";
import { AI_ORG_SLUG } from "@zoonk/utils/org";
import { generateLanguageAudio } from "../../audio/generate-language-audio";
import {
  claimLessonIcons,
  drawLessonIcon,
  failLessonIcon,
} from "../../library/icons/lesson-icon-library";
import {
  type ContentFixMediaNeed,
  type ProducedContentFixMedia,
  readContentFixMedia,
} from "./media-schema";

export {
  checkFixPicture,
  drawFixPicture,
  planFixPicture,
  storeFixPicture,
} from "./_utils/prepare-fix-picture";

export async function listPendingFixMedia(fixId: string): Promise<ContentFixMediaNeed[]> {
  const fix = await prisma.contentFix.findFirst({
    select: { media: true },
    where: { id: fixId, mediaOwedAt: { not: null }, status: "proposed" },
  });

  if (!fix) {
    return [];
  }

  return readContentFixMedia(fix.media).flatMap(({ need, result }) =>
    result === null ? [need] : [],
  );
}

export async function recordFixMedia({
  fixId,
  key,
  result,
}: {
  fixId: string;
  key: string;
  result: ProducedContentFixMedia | "failed";
}): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const [fix] = await tx.$queryRaw<{ media: unknown }[]>(sql`
      SELECT media FROM content_fixes WHERE id = ${fixId}::uuid
        AND status = 'proposed' AND voice_owed_at IS NOT NULL FOR UPDATE`);

    if (!fix) {
      return;
    }

    const media = readContentFixMedia(fix.media);
    const item = media.find(({ need }) => need.key === key);

    if (!item || item.result !== null) {
      return;
    }

    if (result !== "failed" && (result.key !== key || result.kind !== item.need.kind)) {
      throw new Error(`Result does not match media ${key} on content fix ${fixId}`);
    }

    const updated = media.map((entry) => (entry === item ? { ...entry, result } : entry));

    await tx.contentFix.update({
      data: {
        media: updated,
        ...(updated.every((entry) => entry.result && entry.result !== "failed")
          ? { mediaOwedAt: null }
          : {}),
      },
      where: { id: fixId },
    });
  });
}

export async function recordFixClip({
  fixId,
  need,
}: {
  fixId: string;
  need: Extract<ContentFixMediaNeed, { kind: "clip" }>;
}): Promise<void> {
  const pending = await listPendingFixMedia(fixId);

  if (!pending.some(({ key }) => key === need.key)) {
    return;
  }

  const alphabet = need.model === "AlphabetCard";

  const { data, error } = await generateLanguageAudio({
    language: need.language,
    orgSlug: need.orgSlug ?? (alphabet ? AI_ORG_SLUG : undefined),
    text: need.text,
    ...(alphabet ? { usage: "alphabetSymbol" } : {}),
  });

  if (error) {
    throw error;
  }

  const { generatedAt, model, promptVersion, runId } = data.provenance;

  await recordFixMedia({
    fixId,
    key: need.key,
    result: {
      key: need.key,
      kind: "clip",
      provenance: { generatedAt, model, promptVersion, runId },
      url: data.url,
    },
  });
}

function iconRunId({ fixId, key }: { fixId: string; key: string }): string {
  return `content-fix:${fixId}:${key}`;
}

export async function produceFixIdeaIcon({
  fixId,
  media,
}: {
  fixId: string;
  media: Extract<ContentFixMediaNeed, { kind: "ideaIcon" }>;
}): Promise<ProducedContentFixMedia | "failed"> {
  const need = toIconNeed(media.need);

  if (!need) {
    return "failed";
  }

  const [claim] = await claimLessonIcons({
    needs: [need],
    runId: iconRunId({ fixId, key: media.key }),
  });

  if (!claim) {
    return "failed";
  }

  if (claim.claimed) {
    await drawLessonIcon({ iconId: claim.iconId, need });
  }

  const icon = await prisma.lessonIcon.findUnique({
    select: { status: true, url: true },
    where: { id: claim.iconId },
  });

  if (icon?.status === "running") {
    throw new Error(`The idea icon ${claim.iconId} is still being drawn.`);
  }

  return icon?.status === "completed" && icon.url
    ? { iconId: claim.iconId, key: media.key, kind: "ideaIcon", url: icon.url }
    : "failed";
}

export async function failFixMedia({
  fixId,
  need,
}: {
  fixId: string;
  need: ContentFixMediaNeed;
}): Promise<void> {
  const icon = need.kind === "ideaIcon" ? toIconNeed(need.need) : null;

  if (icon) {
    const row = await prisma.lessonIcon.findUnique({
      select: { id: true },
      where: { name: icon.name, runId: iconRunId({ fixId, key: need.key }) },
    });

    if (row) {
      await failLessonIcon(row.id);
    }
  }

  await recordFixMedia({ fixId, key: need.key, result: "failed" });
}
