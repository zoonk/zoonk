"use client";

import { type ContentView } from "@zoonk/core/view-models/content/get";
import { useExperienceMode } from "../mode-provider";
import { type ContentHrefs, ContentScreenProvider } from "./content-context";
import { FocusContent } from "./focus-content";
import { FunCards } from "./fun-cards";

/**
 * The Content tab (Cards in Fun): one content view model from core, drawn as a skill list in
 * Focus and as study cards in Fun.
 */
export function ContentScreen({ content, hrefs }: { content: ContentView; hrefs: ContentHrefs }) {
  const mode = useExperienceMode();

  return (
    <ContentScreenProvider value={{ content, hrefs }}>
      {mode === "fun" ? <FunCards /> : <FocusContent />}
    </ContentScreenProvider>
  );
}
