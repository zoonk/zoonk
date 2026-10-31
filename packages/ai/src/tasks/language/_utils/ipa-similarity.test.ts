import { describe, expect, it } from "vitest";
import { getIpaSimilarity, isCloserToNative } from "./ipa-similarity";

describe(getIpaSimilarity, () => {
  it("ignores stress, length marks and slashes", () => {
    expect(getIpaSimilarity("/ˈnaːmə/", "namə")).toBe(1);
  });

  it("scores a different sound as a partial match", () => {
    expect(getIpaSimilarity("kɪnt", "kɪmt")).toBe(0.75);
  });

  it("counts a consonant that only differs in voicing as half a change", () => {
    expect(getIpaSimilarity("kɪnt", "kɪnd")).toBe(0.875);
  });
});

describe(isCloserToNative, () => {
  it("accepts sounds that follow the word's own pronunciation", () => {
    expect(isCloserToNative({ englishIpa: "taɪm", heard: "ˈtʃĩmi", ipa: "ˈtʃimi" })).toBe(true);
  });

  it("accepts the language's vowel with a voiced ending, an accent rather than English", () => {
    expect(isCloserToNative({ englishIpa: "kaɪnd", heard: "kɪnd", ipa: "kɪnt" })).toBe(true);
  });

  it("rejects an English reading with one sound of the language added", () => {
    expect(isCloserToNative({ englishIpa: "taɪm", heard: "ˈtaɪmi", ipa: "ˈtʃimi" })).toBe(false);
  });
});
