import { readFileSync } from "node:fs";
import path from "node:path";
// Asks an audio-capable model to judge clips (we can't listen ourselves). Run from a linked app folder.
// node judge-audio.mjs <model> <prompt-file> <audio files...>
import { generateText } from "ai";
const [model, promptFile, ...files] = process.argv.slice(2);
const prompt = readFileSync(promptFile, "utf8");
const types = {
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".mp4": "video/mp4",
  ".m4a": "audio/mp4",
};
for (const f of files) {
  const { text } = await generateText({
    model,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: prompt },
          { type: "file", data: readFileSync(f), mediaType: types[path.extname(f)] },
        ],
      },
    ],
  });
  console.log(`### ${path.basename(f)}\n${text.trim()}\n`);
}
