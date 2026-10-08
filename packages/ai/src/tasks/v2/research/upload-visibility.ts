import "server-only";
import { Output, generateText } from "ai";
import { z } from "zod";
import { type AiGenerationContext } from "../../../provenance/ai-generation-event";
import { runTaskGeneration } from "../../../provenance/run-task-generation";
import { type Reasoning, buildProviderOptions } from "../../../provider-options";
import { type ResearchDocument, toDocumentParts } from "./research-documents";
import systemPrompt from "./upload-visibility.prompt.md";

/**
 * The `upload-visibility` eval: every candidate was right; Luna was the cheapest. It compares
 * generation models only: besides public or private, the task returns the title, publisher,
 * language and kind that research's confirming title search needs, and it reads PDF and image
 * pages, while an evaluation model (Jev) answers questions over text alone.
 */
const defaultModel = "openai/gpt-6-luna";
const fallbackModels = ["google/gemini-3.8-flash", "google/gemini-3.5-flash-lite"] as const;

/** The first pages are enough to recognize a notice or a law; the rest would only cost more. */
const EXCERPT_LENGTH = 8000;

const UPLOAD_DOCUMENT_KINDS = [
  "examNotice",
  "syllabus",
  "pastExam",
  "law",
  "officialGuide",
  "classMaterial",
  "personalNotes",
  "workDocument",
  "other",
] as const;

const schema = z.object({
  documentKind: z.enum(UPLOAD_DOCUMENT_KINDS),
  language: z.string(),
  publisher: z.string().nullable(),
  title: z.string(),
  visibility: z.enum(["public", "private"]),
});

export type UploadVisibility = z.infer<typeof schema>;

export type UploadVisibilityParams = {
  fileName: string;
  document: ResearchDocument;
  model?: string;
  useFallback?: boolean;
  reasoning?: Reasoning;
  analytics?: AiGenerationContext;
};

/**
 * Only the start of a text document goes to the model. A PDF or an image is
 * sent as it is, since cutting a PDF's pages would mean parsing and rebuilding
 * it, and models read a notice's cover as quickly as its text.
 */
function toExcerpt(document: ResearchDocument): ResearchDocument {
  return {
    ...document,
    images: document.images.slice(0, 2),
    text: document.text?.slice(0, EXCERPT_LENGTH) ?? null,
  };
}

/**
 * Decides whether an upload is a document its publisher made public, such as
 * an exam notice or a law, which may be shared with other learners after a
 * search confirms it; anything else, and anything unsure, stays private.
 */
export async function classifyUploadVisibility({
  analytics,
  document,
  fileName,
  model = defaultModel,
  reasoning,
  useFallback = true,
}: UploadVisibilityParams) {
  const intro = `FILE_NAME: ${fileName}`;
  const providerOptions = buildProviderOptions({ fallbackModels, model, useFallback });

  const { provenance, result } = await runTaskGeneration({
    analytics,
    generate: () =>
      generateText({
        instructions: systemPrompt,
        model,
        output: Output.object({ schema }),
        prompt: [
          {
            content: [{ text: intro, type: "text" }, ...toDocumentParts([toExcerpt(document)])],
            role: "user",
          },
        ],
        providerOptions,
        reasoning,
      }),
    systemPrompt,
    task: "upload-visibility",
  });

  return { data: result.output, provenance, systemPrompt, usage: result.usage, userPrompt: intro };
}
