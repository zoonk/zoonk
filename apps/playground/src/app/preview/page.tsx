import { PlayerPreview } from "@zoonk/player/preview";
import { getPreviewEntry, previewLesson } from "@zoonk/player/preview/catalog";
import { type Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { readOption, readParam } from "../_utils/gallery-params";

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
    <NextIntlClientProvider>
      <div className="contents **:data-[slot=lesson-player]:pr-0 **:data-[slot=task-aside]:hidden [&_[data-slot=lesson-player]_[data-slot=sidebar-toggle]]:hidden">
        <PlayerPreview lesson={preview.lesson} state={preview.state} />
      </div>
    </NextIntlClientProvider>
  );
}

export default function PreviewPage({ searchParams }: PageProps<"/preview">) {
  return (
    <Suspense>
      <PreviewScreen searchParams={searchParams} />
    </Suspense>
  );
}
