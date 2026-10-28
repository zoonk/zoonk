"use client";

import { type ChordQuality } from "@zoonk/core/library/activities/music";
import { useExtracted, useLocale } from "next-intl";
import { displayNoteName } from "./music-notes";

export function useNoteNames() {
  const t = useExtracted();
  const locale = useLocale();

  function display(name: string): string {
    return displayNoteName(name.replace(/\d$/u, ""), locale);
  }

  function spoken(name: string): string {
    const shown = display(name);
    const letter = shown.charAt(0);

    if (shown.includes("♯")) {
      return t("{note} sharp", { note: letter });
    }

    return shown.includes("♭") ? t("{note} flat", { note: letter }) : letter;
  }

  return { display, spoken };
}

export function useChordName() {
  const t = useExtracted();
  const { display } = useNoteNames();

  return (root: string, quality: ChordQuality): string => {
    const note = display(root);

    const names: Record<ChordQuality, string> = {
      augmented: t("{note} augmented", { note }),
      diminished: t("{note} diminished", { note }),
      dominant7: t("{note} dominant seventh", { note }),
      major: t("{note} major", { note }),
      major7: t("{note} major seventh", { note }),
      minor: t("{note} minor", { note }),
      minor7: t("{note} minor seventh", { note }),
    };

    return names[quality];
  };
}
