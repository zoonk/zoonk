import { readFileSync } from "node:fs";
// Transcribes clips to check the narration says the script: node transcribe.mjs <spec.json> <dir> → JSON lines
import { transcribe } from "ai";
const [specPath, dir] = process.argv.slice(2);
const spec = JSON.parse(readFileSync(specPath, "utf8"));
const out = await Promise.all(
  spec.map(async (c) => {
    const audio = readFileSync(`${dir}/${c.id}.wav`);
    const r = await transcribe({ model: "openai/gpt-4o-transcribe", audio });
    return { id: c.id, want: c.text, got: r.text };
  }),
);
for (const o of out) console.log(JSON.stringify(o));
