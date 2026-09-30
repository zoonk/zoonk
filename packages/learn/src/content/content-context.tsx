"use client";

import { type ContentView } from "@zoonk/core/view-models/content/get";
import { createContext, use } from "react";

export type ContentCard = ContentView["groups"][number]["cards"][number];
export type ContentGroup = ContentView["groups"][number];

/**
 * Where Content links: today's session opens the capsules due today; the map of the subject and
 * each chapter's page (the chapter id is appended) show when the host has them.
 */
export type ContentHrefs = { capsules: string; chapterBasePath?: string; map?: string };

type ContentScreenValue = { content: ContentView; hrefs: ContentHrefs };

const ContentScreenContext = createContext<ContentScreenValue | null>(null);

export function ContentScreenProvider({
  children,
  value,
}: {
  children: React.ReactNode;
  value: ContentScreenValue;
}) {
  return <ContentScreenContext value={value}>{children}</ContentScreenContext>;
}

export function useContentScreen(): ContentScreenValue {
  const value = use(ContentScreenContext);

  if (!value) {
    throw new Error("Content components must be used within ContentScreen");
  }

  return value;
}
