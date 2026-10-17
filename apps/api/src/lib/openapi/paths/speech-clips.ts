import { errorSchema } from "../schemas/common";
import {
  jsonResponse,
  smallAiHelpRefusalResponses,
  unauthorizedResponse,
  validationErrorResponse,
} from "../schemas/responses";
import { speechClipRequestSchema, speechClipResponseSchema } from "../schemas/speech-clips";
import { AUTHENTICATED_SECURITY } from "../security";

const speechUnavailableResponse = {
  content: { "application/json": { schema: errorSchema } },
  description: "`SPEECH_UNAVAILABLE`: no voice could read the text this time; try again later",
} as const;

export const speechClipPaths = {
  "/speech-clips": {
    post: {
      description:
        "A word, sentence or short passage read aloud in its language, for the signed-in learner or guest to play: the level test's voice messages, listening activities, conversation phrases and words without a recording. Clips are shared: the same words in the same language return the stored file, and only a new clip is voiced (Gemini text-to-speech, with the language named in every request) and counts as small AI help. It's a POST because a new clip calls a model; call it when the learner taps play, never on page load.",
      operationId: "requestSpeechClip",
      requestBody: {
        content: { "application/json": { schema: speechClipRequestSchema } },
        required: true,
      },
      responses: {
        "200": jsonResponse(speechClipResponseSchema, "The clip to play"),
        "400": validationErrorResponse,
        "401": unauthorizedResponse,
        ...smallAiHelpRefusalResponses,
        "503": speechUnavailableResponse,
      },
      security: AUTHENTICATED_SECURITY,
      summary: "Get a clip of text read aloud",
      tags: ["Language"],
    },
  },
};
