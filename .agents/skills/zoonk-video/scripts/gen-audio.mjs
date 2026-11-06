import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import path from "node:path";
// Generates speech and music clips through Vercel AI Gateway (for example Gemini TTS, ElevenLabs music).
// Run from a Vercel-linked app folder so the gateway can authenticate with the Vercel login (OIDC):
//   cd <repo>/apps/api && node <studio>/scripts/gen-audio.mjs <spec.json> <outdir> [id,id…]
// spec.json: [{ "id", "model", "text", "voice"?, "instructions"?, "providerOptions"?, "outputFormat"? }]
import { generateSpeech } from "ai";
const [specPath, outDir, only] = process.argv.slice(2);
const spec = JSON.parse(readFileSync(specPath, "utf8"));
mkdirSync(outDir, { recursive: true });
for (const clip of spec) {
  if (only && !only.split(",").includes(clip.id)) continue;
  const saved = ["mp3", "wav"].map((ext) => path.join(outDir, `${clip.id}.${ext}`));
  if (saved.some((file) => existsSync(file)) && !only) {
    console.log("skip", clip.id);
    continue;
  }
  const t = Date.now();
  const res = await generateSpeech({
    model: clip.model,
    text: clip.text,
    ...(clip.voice ? { voice: clip.voice } : {}),
    ...(clip.instructions ? { instructions: clip.instructions } : {}),
    ...(clip.outputFormat ? { outputFormat: clip.outputFormat } : {}),
    // Only public marketing copy goes through here; ElevenLabs on the gateway has no no-training route.
    providerOptions: { ...(clip.providerOptions ?? {}) },
  });
  writeFileSync(saved[res.audio.mediaType === "audio/wav" ? 1 : 0], res.audio.uint8Array);
  console.log(
    "ok",
    clip.id,
    res.audio.uint8Array.length,
    "bytes",
    ((Date.now() - t) / 1000).toFixed(1) + "s",
    res.audio.mediaType ?? "",
  );
}
