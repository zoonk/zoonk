// /stage/?film=<folder in films/>&scene=<name>&fmt=16x9|4x5|9x16&lang=en|pt
// Exposes window.__ready, __duration and __seek(t), as scripts/render.mjs and scripts/stills.mjs expect.
// A name it doesn't know rejects __ready, so a typo fails the render instead of saving this page as an image;
// so does a moment whose frame or crops cut through words (stage.cuts).
import "@repo/packages/player/src/_test-utils/browser.css";
import { type Lang } from "../story";
import { type Scene, FORMATS, createStage } from "./stage";

declare global {
  interface Window {
    __ready: Promise<void>;
    __duration: number;
    __seek: (t: number) => void;
    __cuts: () => string[];
  }
}

const films = Object.fromEntries(
  Object.entries(
    import.meta.glob<{ scenes: Record<string, Scene> }>("../../films/*/scenes.ts"),
  ).map(([file, load]) => [file.split("/")[3] ?? file, load]),
);
const LANGS: Record<Lang, Lang> = { en: "en", pt: "pt" };
const q = new URLSearchParams(location.search);

/** The option the query names, or the fallback when it names none. */
function choose<K extends string, T>(name: string, options: Record<K, T>, fallback?: K): [K, T] {
  const asked = q.get(name) ?? fallback;
  const key = (Object.keys(options) as K[]).find((option) => option === asked);
  if (key === undefined)
    throw new Error(`${name}=${asked ?? ""} isn't one of: ${Object.keys(options).join(", ")}`);
  return [key, options[key]];
}

async function start() {
  const [fmt, { w, h }] = choose("fmt", FORMATS, "16x9");
  const [, lang] = choose("lang", LANGS, "en");
  const [, load] = choose("film", films);
  const [, scene] = choose("scene", (await load()).scenes);

  const frame = document.querySelector<HTMLDivElement>("#frame") as HTMLDivElement;
  Object.assign(frame.style, { width: `${w}px`, height: `${h}px` });
  const fit = () => {
    frame.style.transform = `scale(${window.innerWidth / w})`;
  };
  fit();
  window.addEventListener("resize", fit);

  await document.fonts.ready;
  const stage = createStage({ fmt, frame, lang });
  await scene(stage);
  window.__duration = stage.tl.duration;
  window.__seek = (t) => stage.seek(t);
  window.__cuts = () => stage.cuts();
  stage.seek(Number(q.get("t") ?? 0));
  const cuts = stage.cuts();
  if (cuts.length > 0) throw new Error(`The frame cuts what it shows:\n${cuts.join("\n")}`);
}

window.__ready = start().catch((error: unknown) => {
  document.body.textContent = String(error);
  throw error;
});
