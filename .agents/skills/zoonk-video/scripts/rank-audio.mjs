import { readFileSync } from "node:fs";
import path from "node:path";
// Ranks several clips in one request: node rank-audio.mjs <model> <prompt-file> <files...>
import { generateText } from "ai";
const [model, promptFile, ...files] = process.argv.slice(2);
const types = { ".mp3": "audio/mpeg", ".wav": "audio/wav", ".mp4": "video/mp4" };
const content = [{ type: "text", text: readFileSync(promptFile, "utf8") }];
files.forEach((f, i) => {
  content.push({ type: "text", text: `Clip ${String.fromCharCode(65 + i)}:` });
  content.push({ type: "file", data: readFileSync(f), mediaType: types[path.extname(f)] });
});
const { text } = await generateText({ model, messages: [{ role: "user", content }] });
files.forEach((f, i) => console.log(`Clip ${String.fromCharCode(65 + i)} = ${path.basename(f)}`));
console.log(text.trim());
