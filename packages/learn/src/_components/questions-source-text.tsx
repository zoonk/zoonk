"use client";

import { useExtracted } from "next-intl";
import { getSourceHost } from "../_utils/source-host";

/** Where an exam's questions per subject were counted, with the count's source as a link. */
export function QuestionsSourceText({
  source,
}: {
  source: { edition: string | null; url: string };
}) {
  const t = useExtracted();
  const publisher = getSourceHost(source.url);

  const link = (chunks: React.ReactNode) => (
    <a
      className="hover:text-foreground underline underline-offset-2"
      href={source.url}
      rel="noreferrer"
      target="_blank"
    >
      {chunks}
    </a>
  );

  return source.edition
    ? t.rich("Questions per subject in the {edition}, as counted by <link>{publisher}</link>.", {
        edition: source.edition,
        link,
        publisher,
      })
    : t.rich("Questions per subject in the latest exam, as counted by <link>{publisher}</link>.", {
        link,
        publisher,
      });
}
