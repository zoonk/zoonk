/**
 * Adds a Material Symbol (Outlined, weight 400, grade 0, 24) as `res/drawable/ic_<name>.xml` from
 * Google's Android vector files. `--filled` adds `ic_<name>_filled.xml` too, for a selected
 * navigation item; `--mirrored` flips it in right-to-left layouts (arrows and other directional
 * symbols). `Icon` tints it, so it's drawn in black here.
 *
 * pnpm --filter android symbol <name> [--filled] [--mirrored]
 */
import { writeFile } from "node:fs/promises";
import { parseArgs } from "node:util";

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: { filled: { type: "boolean" }, mirrored: { type: "boolean" } },
});

const [name] = positionals;

if (!name || !/^[a-z\d_]+$/u.test(name)) {
  throw new Error("Pass a Material Symbol's name, like `sunny` (fonts.google.com/icons).");
}

const drawables = new URL("../../app/src/main/res/drawable/", import.meta.url);
const source = `https://raw.githubusercontent.com/google/material-design-icons/master/symbols/android/${name}/materialsymbolsoutlined/${name}`;

async function addVariant({ file, url }: { file: string; url: string }) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`${url} answered ${response.status}`);
  }

  const original = await response.text();

  const xml = original
    .replace(/\s+android:tint="[^"]*"/u, values.mirrored ? '\n    android:autoMirrored="true"' : "")
    .replaceAll("@android:color/white", "@android:color/black");

  await writeFile(new URL(file, drawables), xml);
  process.stdout.write(`Added res/drawable/${file}\n`);
}

await addVariant({ file: `ic_${name}.xml`, url: `${source}_24px.xml` });

if (values.filled) {
  await addVariant({ file: `ic_${name}_filled.xml`, url: `${source}_fill1_24px.xml` });
}
