import { PlayerPreview } from "@zoonk/player/preview";
import { getPreviewEntry, previewLesson } from "@zoonk/player/preview/catalog";
import { type Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { readOption, readParam } from "../_utils/gallery-params";
import { PreviewIntlProvider } from "./preview-intl-provider";

export const metadata: Metadata = { title: "Preview" };

/**
 * Building a lesson draws ids and shuffles language options, which a prerender can't do outside a
 * cache.
 */
async function getPreview(entryId: string, requestedState: string | undefined) {
  "use cache";
  const entry = getPreviewEntry(entryId);
  const state = entry ? (readOption(entry.states, requestedState) ?? entry.states[0]) : undefined;
  return entry && state ? { lesson: previewLesson(entry, state), state } : null;
}

async function PreviewScreen({ searchParams }: Pick<PageProps<"/preview">, "searchParams">) {
  const params = await searchParams;
  const preview = await getPreview(readParam(params.entry) ?? "", readParam(params.state));

  if (!preview) {
    notFound();
  }

  return (
    <PreviewIntlProvider>
      <PlayerPreview lesson={preview.lesson} state={preview.state} />
    </PreviewIntlProvider>
  );
}

export default function PreviewPage({ searchParams }: PageProps<"/preview">) {
  return (
    <Suspense>
      <PreviewScreen searchParams={searchParams} />
    </Suspense>
  );
}
