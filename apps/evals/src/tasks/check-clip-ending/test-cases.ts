import path from "node:path";
import { type TestCase } from "@/lib/types";

export const CLIP_ENDING_CLIPS_DIR = path.join(process.cwd(), "data", "clip-ending");

export type ClipEndingInput = { clipId: string; language: string; text: string };

export type ClipEndingExpected = { added: "none" | "sound" | "speech"; heard: string };

function clip(
  clipId: string,
  language: string,
  text: string,
  expected: ClipEndingExpected,
  origin?: "production",
): TestCase<ClipEndingExpected, ClipEndingInput> {
  return {
    expected,
    id: clipId,
    userInput: { clipId, language, text },
    ...(origin ? { origin } : {}),
  };
}

/**
 * Production clips learners reported or a listen found, clips voiced for the language-audio eval
 * before and after the voice was told to stop, and clean clips of open phrases like them.
 */
export const TEST_CASES: TestCase<ClipEndingExpected, ClipEndingInput>[] = [
  clip(
    "it-vivo-in-speech",
    "it",
    "vivo in",
    { added: "speech", heard: "vivo in ca" },
    "production",
  ),
  clip(
    "it-abito-a-speech",
    "it",
    "abito a",
    { added: "speech", heard: "abito a ca" },
    "production",
  ),
  clip(
    "it-lavoro-a-speech",
    "it",
    "lavoro a",
    { added: "speech", heard: "lavoro a qui" },
    "production",
  ),
  clip(
    "it-studio-a-speech",
    "it",
    "studio a",
    { added: "speech", heard: "studio a scuola" },
    "production",
  ),
  clip(
    "en-your-message-to-speech",
    "en",
    "your message to",
    { added: "speech", heard: "your message to playback" },
    "production",
  ),
  clip("en-what-sound", "en", "what", { added: "sound", heard: "what [chuckle]" }, "production"),
  clip("it-vivo-in-speech-2", "it", "vivo in", { added: "speech", heard: "vivo in na" }),
  clip("it-abito-a-speech-2", "it", "abito a", { added: "speech", heard: "abito a Firenze" }),
  clip("it-lavoro-a-speech-2", "it", "lavoro a", { added: "speech", heard: "lavoro a ca" }),
  clip("it-studio-a-speech-2", "it", "studio a", { added: "speech", heard: "studio a cal" }),
  clip("de-ich-wohne-in-speech", "de", "ich wohne in", {
    added: "speech",
    heard: "ich wohne in Berlin",
  }),
  clip("it-vivo-in-clean", "it", "vivo in", { added: "none", heard: "vivo in" }),
  clip("it-abito-a-clean", "it", "abito a", { added: "none", heard: "abito a" }),
  clip("it-lavoro-a-clean", "it", "lavoro a", { added: "none", heard: "lavoro a" }),
  clip("it-studio-a-clean", "it", "studio a", { added: "none", heard: "studio a" }),
  clip("en-your-message-to-clean", "en", "your message to", {
    added: "none",
    heard: "your message to",
  }),
  clip("en-what-clean", "en", "what", { added: "none", heard: "what" }),
  clip(
    "it-studio-in-clean",
    "it",
    "studio in",
    { added: "none", heard: "studio in" },
    "production",
  ),
  clip(
    "it-viaggio-in-clean",
    "it",
    "viaggio in",
    { added: "none", heard: "viaggio in" },
    "production",
  ),
  clip("it-vado-a-clean", "it", "vado a", { added: "none", heard: "vado a" }, "production"),
  clip("it-ai-clean", "it", "ai", { added: "none", heard: "ai" }, "production"),
  clip(
    "en-whos-interested-in-clean",
    "en",
    "Who's interested in",
    { added: "none", heard: "Who's interested in" },
    "production",
  ),
  clip(
    "en-your-message-about-clean",
    "en",
    "your message about",
    { added: "none", heard: "your message about" },
    "production",
  ),
  clip(
    "en-in-your-email-to-emma-clean",
    "en",
    "in your email to Emma",
    { added: "none", heard: "in your email to Emma" },
    "production",
  ),
  clip("pl-i-clean", "pl", "i", { added: "none", heard: "i" }, "production"),
  clip("zh-wo-shi-clean", "zh", "我是", { added: "none", heard: "我是" }, "production"),
  clip("zh-zai-ji-lou-clean", "zh", "在几楼", { added: "none", heard: "在几楼" }, "production"),
  clip(
    "pl-na-widzenia-misread",
    "pl",
    "Na widzenia",
    { added: "none", heard: "Do widzenia" },
    "production",
  ),
  clip("fr-recule-misread", "fr", "Recule", { added: "none", heard: "requil" }, "production"),
  clip(
    "en-rent-sentence-clean",
    "en",
    "How much is the rent, and what does it include?",
    { added: "none", heard: "How much is the rent, and what does it include?" },
    "production",
  ),
  clip("pt-moro-em-clean", "pt", "moro em", { added: "none", heard: "moro em" }),
  clip("es-vivo-en-clean", "es", "vivo en", { added: "none", heard: "vivo en" }),
  clip("fr-je-vais-a-clean", "fr", "je vais à", { added: "none", heard: "je vais à" }),
  clip("ru-ya-zhivu-v-clean", "ru", "я живу в", { added: "none", heard: "я живу в" }),
  clip("ja-eki-made-clean", "ja", "駅まで", { added: "none", heard: "駅まで" }),
];
