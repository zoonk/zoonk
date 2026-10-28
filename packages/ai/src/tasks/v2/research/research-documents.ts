import { type FilePart, type TextPart } from "ai";
import { formatUntrustedInput } from "../../../evaluate/untrusted-input";

/** Enough text for a long notice; the rest of a huge document rarely changes the blueprint. */
const MAX_TEXT_LENGTH = 120_000;
const MAX_IMAGES_PER_DOCUMENT = 8;

/** PDFs and images go as files, since models read them natively. */
export type ResearchDocument = {
  file: { data: Uint8Array | URL; mediaType: string } | null;
  images: { data: string; mediaType: string }[];
  text: string | null;
  title: string;
  url: string | null;
};

function toHeader({ document, number }: { document: ResearchDocument; number: number }): string {
  return `DOCUMENT ${number}: ${document.title}${document.url ? ` (${document.url})` : ""}`;
}

/** Text is delimited as data because documents come from the web and from learners. */
function toTextPart({
  document,
  number,
}: {
  document: ResearchDocument;
  number: number;
}): TextPart {
  const header = toHeader({ document, number });

  if (document.file || !document.text) {
    return { text: `${header}${document.file ? " (attached file)" : ""}`, type: "text" };
  }

  return {
    text: `${header}\n${formatUntrustedInput({ [`DOCUMENT_${number}`]: document.text.slice(0, MAX_TEXT_LENGTH) })}`,
    type: "text",
  };
}

function toFileParts(document: ResearchDocument): FilePart[] {
  const images = document.images
    .slice(0, MAX_IMAGES_PER_DOCUMENT)
    .map((image) => ({ data: image.data, mediaType: image.mediaType, type: "file" as const }));

  if (!document.file) {
    return images;
  }

  return [
    { data: document.file.data, mediaType: document.file.mediaType, type: "file" },
    ...images,
  ];
}

/** Numbered from 1, so facts can cite a document by its number. */
export function toDocumentParts(documents: ResearchDocument[]): (FilePart | TextPart)[] {
  return documents.flatMap((document, index) => [
    toTextPart({ document, number: index + 1 }),
    ...toFileParts(document),
  ]);
}
