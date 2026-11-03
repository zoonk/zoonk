import { z } from "zod";

export const liveCallCueSchema = z
  .object({
    channel: z
      .enum(["commentary", "instructions", "thinking"])
      .meta({
        description:
          "The live session's context channel to append `text` on: `commentary` is said aloud, `thinking` and `instructions` steer without being spoken",
      }),
    text: z.string(),
  })
  .meta({ id: "LiveCallCue" });

export type LiveCallCue = z.infer<typeof liveCallCueSchema>;

const millisecondsSchema = z.int().positive();

export const liveCallScriptSchema = z
  .object({
    cues: z
      .object({
        checkIn: liveCallCueSchema,
        goodbye: liveCallCueSchema,
        goodbyeDone: liveCallCueSchema,
        noBackend: liveCallCueSchema,
        opening: liveCallCueSchema,
        typedReply: liveCallCueSchema,
      })
      .meta({
        description:
          "`opening` once the session starts, and once more when no character transcript arrives within `timing.openingRetryMs`. `goodbye` ends the call at its talk time or after a long silence, `goodbyeDone` once the objective check says every objective is met. `checkIn` once in a silence episode. `noBackend` answers every delegation, with its delegation id. `typedReply` sends a typed reply as its `text` followed by the reply as a JSON string literal (`text + JSON.stringify(reply)`)",
        id: "LiveCallCues",
      }),
    timing: z
      .object({
        answerWaitMs: millisecondsSchema.meta({
          description:
            "Once the ending is armed and the character stopped, how long to wait for the learner before sending the goodbye anyway",
        }),
        characterQuietMs: millisecondsSchema.meta({
          description: "The character counts as talking until this long after its last transcript",
        }),
        checkInMs: millisecondsSchema.meta({
          description: "How far into a silence episode `cues.checkIn` is sent",
        }),
        goodbyeQuietMs: millisecondsSchema.meta({
          description:
            "Hang up once the goodbye was said and nothing (character transcript, learner speech or typing) happened for this long, or once no words (a character or learner transcript, typing) came for `answerWaitMs`, so a noisy microphone can't hold the call open",
        }),
        goodbyeRetryMs: millisecondsSchema.meta({
          description:
            "Send the goodbye once more when no character transcript arrived and nothing happened for this long after the learner gave up the floor",
        }),
        openingRetryMs: millisecondsSchema.meta({
          description: "Send `cues.opening` once more when the character stays silent this long",
        }),
        quietGoodbyeMs: millisecondsSchema.meta({
          description: "How far into a silence episode the call ends with `cues.goodbye`",
        }),
        quietHintMs: millisecondsSchema.meta({
          description:
            "How far into a silence episode the screen says the learner can take their time",
        }),
      })
      .meta({ id: "LiveCallTiming" }),
  })
  .meta({
    description: "What the app tells the live session during the call, and when",
    id: "LiveCallScript",
  });

export type LiveCallScript = z.infer<typeof liveCallScriptSchema>;
