import { describe, expect, it } from "vitest";
import { resolveAudioMediaType } from "./audio-media-type";

const encoder = new TextEncoder();

const bytes = (...parts: (number[] | string)[]) =>
  new Uint8Array(
    parts.flatMap((part) => (typeof part === "string" ? [...encoder.encode(part)] : part)),
  );

describe(resolveAudioMediaType, () => {
  it("keeps a declared audio type", () => {
    expect(resolveAudioMediaType({ bytes: bytes("RIFF"), declared: "audio/webm" })).toBe(
      "audio/webm",
    );
  });

  it("reads the container of a recording sent as octet-stream", () => {
    const generic = "application/octet-stream";

    expect(
      resolveAudioMediaType({ bytes: bytes([0, 0, 0, 28], "ftypM4A "), declared: generic }),
    ).toBe("audio/mp4");

    expect(resolveAudioMediaType({ bytes: bytes([26, 69, 223, 163]), declared: "" })).toBe(
      "audio/webm",
    );

    expect(
      resolveAudioMediaType({ bytes: bytes("RIFF", [0, 0, 0, 0], "WAVE"), declared: generic }),
    ).toBe("audio/wav");

    expect(resolveAudioMediaType({ bytes: bytes("ID3"), declared: generic })).toBe("audio/mpeg");

    expect(resolveAudioMediaType({ bytes: bytes([255, 251]), declared: generic })).toBe(
      "audio/mpeg",
    );
  });

  it("leaves bytes it can't name with their declared type", () => {
    const generic = "application/octet-stream";
    expect(resolveAudioMediaType({ bytes: bytes("hello"), declared: generic })).toBe(generic);
  });
});
