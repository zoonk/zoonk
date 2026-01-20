"use server";

import { revalidateMainApp } from "@zoonk/core/cache/revalidate";
import { cacheTagLesson } from "@zoonk/utils/cache";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { getExtracted } from "next-intl/server";
import { createActivity } from "@/data/activities/create-activity";
import { exportActivities } from "@/data/activities/export-activities";
import { importActivities } from "@/data/activities/import-activities";
import { reorderActivities } from "@/data/activities/reorder-activities";
import { getErrorMessage } from "@/lib/error-messages";

async function createActivityAction(
  lessonSlug: string,
  lessonId: number,
  position: number,
): Promise<{ activityId: bigint | null; error: string | null }> {
  const t = await getExtracted();
  const title = t("Untitled activity");
  const description = t("Add a description…");

  const { data, error } = await createActivity({
    description,
    kind: "custom",
    lessonId,
    position,
    title,
  });

  if (error) {
    return { activityId: null, error: await getErrorMessage(error) };
  }

  after(async () => {
    await revalidateMainApp([cacheTagLesson({ lessonSlug })]);
  });

  return { activityId: data.id, error: null };
}

async function importActivitiesAction(
  lessonSlug: string,
  lessonId: number,
  formData: FormData,
): Promise<{ error: string | null }> {
  const file = formData.get("file");
  const mode = formData.get("mode") as "merge" | "replace";

  if (!(file && file instanceof File)) {
    const t = await getExtracted();
    return { error: t("No file provided") };
  }

  const { error } = await importActivities({
    file,
    lessonId,
    mode,
  });

  if (error) {
    return { error: await getErrorMessage(error) };
  }

  after(async () => {
    await revalidateMainApp([cacheTagLesson({ lessonSlug })]);
  });

  return { error: null };
}

export async function exportActivitiesAction(lessonId: number): Promise<{
  data: object | null;
  error: Error | null;
}> {
  const { data, error } = await exportActivities({ lessonId });

  if (error) {
    return { data: null, error };
  }

  return { data, error: null };
}

type ActivityRouteParams = {
  chapterSlug: string;
  courseSlug: string;
  lang: string;
  lessonId: number;
  lessonSlug: string;
  orgSlug: string;
};

export async function insertActivityAction(
  params: ActivityRouteParams,
  position: number,
): Promise<void> {
  const { chapterSlug, courseSlug, lang, lessonId, lessonSlug, orgSlug } =
    params;
  const { activityId, error } = await createActivityAction(
    lessonSlug,
    lessonId,
    position,
  );

  if (error) {
    throw new Error(error);
  }

  if (activityId) {
    revalidatePath(
      `/${orgSlug}/c/${lang}/${courseSlug}/ch/${chapterSlug}/l/${lessonSlug}`,
    );
    redirect(
      `/${orgSlug}/c/${lang}/${courseSlug}/ch/${chapterSlug}/l/${lessonSlug}/a/${activityId}`,
    );
  }
}

export async function handleImportActivitiesAction(
  params: ActivityRouteParams,
  formData: FormData,
): Promise<{ error: string | null }> {
  const { chapterSlug, courseSlug, lang, lessonId, lessonSlug, orgSlug } =
    params;
  const { error } = await importActivitiesAction(
    lessonSlug,
    lessonId,
    formData,
  );

  if (error) {
    return { error };
  }

  revalidatePath(
    `/${orgSlug}/c/${lang}/${courseSlug}/ch/${chapterSlug}/l/${lessonSlug}`,
  );
  return { error: null };
}

export async function reorderActivitiesAction(
  params: ActivityRouteParams,
  activities: { id: number; position: number }[],
): Promise<{ error: string | null }> {
  const { chapterSlug, courseSlug, lang, lessonId, lessonSlug, orgSlug } =
    params;

  const { error } = await reorderActivities({
    activities: activities.map((a) => ({
      activityId: BigInt(a.id),
      position: a.position,
    })),
    lessonId,
  });

  if (error) {
    return { error: await getErrorMessage(error) };
  }

  after(async () => {
    await revalidateMainApp([cacheTagLesson({ lessonSlug })]);
  });

  revalidatePath(
    `/${orgSlug}/c/${lang}/${courseSlug}/ch/${chapterSlug}/l/${lessonSlug}`,
  );
  return { error: null };
}
