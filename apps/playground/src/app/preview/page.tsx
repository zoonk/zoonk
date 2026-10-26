import { PlayerPreview } from "@zoonk/player/preview";
import { getPreviewEntry, previewLesson } from "@zoonk/player/preview/catalog";
import { type Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { readOption, readParam } from "../_utils/gallery-params";
import { PreviewIntlProvider } from "./preview-intl-provider";

export const metadata: Metadata = { title: "Preview" };

async function PreviewScreen({ searchParams }: Pick<PageProps<"/preview">, "searchParams">) {
  const params = await searchParams;
  const entry = getPreviewEntry(readParam(params.entry) ?? "");
  const state = entry ? (readOption(entry.states, params.state) ?? entry.states[0]) : undefined;

  if (!entry || !state) {
    notFound();
  }

  // Each load builds a new lesson (fresh ids, language options shuffled again), so it renders at
  // request time, never in a prerender or prefetch.
  await connection();

  return (
    <PreviewIntlProvider>
      <PlayerPreview lesson={previewLesson(entry, state)} state={state} />
    </PreviewIntlProvider>
  );
}

/** One screen of the player's catalog, played alone at the window's size. */
export default function PreviewPage({ searchParams }: PageProps<"/preview">) {
  return (
    <Suspense>
      <PreviewScreen searchParams={searchParams} />
    </Suspense>
  );
}
