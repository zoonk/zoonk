// /stage/?film=<folder in films/>&scene=<name>&fmt=16x9|4x5&lang=en|pt
// Exposes window.__ready, __duration and __seek(t), as scripts/render.mjs and scripts/stills.mjs expect.
import "@repo/packages/player/src/_test-utils/browser.css";
import { type Format, type Scene, FORMATS, createStage } from "./stage";

declare global {
  interface Window {
    __ready: Promise<void>;
    __duration: number;
    __seek: (t: number) => void;
  }
}

const films = import.meta.glob<{ scenes: Record<string, Scene> }>("../../films/*/scenes.ts");

const q = new URLSearchParams(location.search);
const fmt: Format = q.get("fmt") === "4x5" ? "4x5" : "16x9";
const frame = document.querySelector<HTMLDivElement>("#frame") as HTMLDivElement;
const { w, h } = FORMATS[fmt];
Object.assign(frame.style, { width: `${w}px`, height: `${h}px` });
const fit = () => {
  frame.style.transform = `scale(${window.innerWidth / w})`;
};
fit();
window.addEventListener("resize", fit);

async function findScene(): Promise<Scene | string> {
  const load = films[`../../films/${q.get("film")}/scenes.ts`];
  if (!load)
    return `films: ${Object.keys(films)
      .map((path) => path.split("/")[3])
      .join(" ")}`;
  const { scenes } = await load();
  return scenes[q.get("scene") ?? ""] ?? `scenes: ${Object.keys(scenes).join(" ")}`;
}

window.__ready = (async () => {
  await document.fonts.ready;
  const scene = await findScene();
  if (typeof scene === "string") {
    document.body.textContent = scene;
    return;
  }
  const stage = createStage({ fmt, frame, lang: q.get("lang") === "pt" ? "pt" : "en" });
  await scene(stage);
  window.__duration = stage.tl.duration;
  window.__seek = (t) => stage.tl.seek(t);
  stage.tl.seek(Number(q.get("t") ?? 0));
})();
