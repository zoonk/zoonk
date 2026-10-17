import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { generateRealtimeSpeech } from "./realtime-speech";

type ClientEvent = { type: string; item?: { text: string }; config?: { instructions: string } };

const { realtimeModel, sent, spoken } = vi.hoisted(() => {
  const sentEvents: ClientEvent[] = [];
  const reply = { transcript: "" };

  return {
    realtimeModel: {
      doCreateClientSecret: vi.fn(async () => ({ token: "secret", url: "wss://realtime.test" })),
      getWebSocketConfig: vi.fn(({ url }: { url: string }) => ({ protocols: ["realtime"], url })),
      parseServerEvent: vi.fn((raw: unknown) => raw),
      serializeClientEvent: vi.fn(async (event: ClientEvent) => event),
    },
    sent: sentEvents,
    spoken: reply,
  };
});

vi.mock("../../direct-providers", () => ({
  directOpenAI: { experimental_realtime: () => realtimeModel },
}));

/** Opens at once and, asked for a reply, speaks two samples and writes down what it said. */
class FakeRealtimeSocket extends EventTarget {
  constructor() {
    super();
    queueMicrotask(() => this.dispatchEvent(new Event("open")));
  }

  send(data: string) {
    const event = JSON.parse(data) as ClientEvent;
    sent.push(event);

    if (event.type === "response-create") {
      this.reply([
        { delta: Buffer.from([1, 0, 2, 0]).toString("base64"), type: "audio-delta" },
        { transcript: spoken.transcript, type: "audio-transcript-done" },
        { raw: { response: { usage: { output_tokens: 3 } } }, type: "response-done" },
      ]);
    }
  }

  close = vi.fn();

  private reply(events: object[]) {
    for (const event of events) {
      queueMicrotask(() =>
        this.dispatchEvent(new MessageEvent("message", { data: JSON.stringify(event) })),
      );
    }
  }
}

describe(generateRealtimeSpeech, () => {
  beforeEach(() => {
    sent.length = 0;
    vi.stubGlobal("WebSocket", FakeRealtimeSocket);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sends the text between tags and returns what it spoke as WAV with OpenAI's usage", async () => {
    spoken.transcript = "Could you tell me where the station is?";

    const result = await generateRealtimeSpeech({
      instructions: "The following text is US English.",
      model: "gpt-realtime-2.1-mini",
      text: "Could you tell me where the station is?",
      voice: "marin",
    });

    expect(sent.find((event) => event.type === "conversation-item-create")?.item?.text).toBe(
      "<text>Could you tell me where the station is?</text>",
    );

    expect(sent[0]?.config?.instructions).toContain("The following text is US English.");
    expect(new TextDecoder().decode(result.audio.slice(0, 4))).toBe("RIFF");
    // The 44-byte header and the two samples it spoke.
    expect(result.audio.byteLength).toBe(48);
    expect(result.audio.slice(-4)).toStrictEqual(new Uint8Array([1, 0, 2, 0]));
    expect(result.providerMetadata).toStrictEqual({ openai: { usage: { output_tokens: 3 } } });
  });

  it("accepts a reading that only differs in case, punctuation and spacing", async () => {
    spoken.transcript = "could you tell me where the station is";

    await expect(
      generateRealtimeSpeech({
        instructions: "",
        model: "gpt-realtime-2.1-mini",
        text: "Could you tell me where the station is?",
        voice: "marin",
      }),
    ).resolves.toHaveProperty("audio");
  });

  it("fails a reply that answers the text instead of reading it", async () => {
    spoken.transcript = "I can't see where you are, but a maps app can show you the way.";

    await expect(
      generateRealtimeSpeech({
        instructions: "",
        model: "gpt-realtime-2.1-mini",
        text: "Could you tell me where the station is?",
        voice: "marin",
      }),
    ).rejects.toThrow("said something other than the text");
  });
});
