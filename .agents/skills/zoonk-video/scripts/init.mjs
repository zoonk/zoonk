// Sets up a video studio in a folder outside the repo: node .agents/skills/zoonk-video/scripts/init.mjs <work-dir>
// Safe to run again: it adds missing files and refreshes links and generated files, and never overwrites your edits.
import { execFileSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";

const skill = path.dirname(import.meta.dirname);
const repo = path.resolve(skill, "../../..");
const work = path.resolve(process.argv[2] ?? "");

if (!process.argv[2]) throw new Error("usage: node init.mjs <work-dir>");
const fromRepo = path.relative(repo, work);
if (fromRepo === "" || !(fromRepo === ".." || fromRepo.startsWith(`..${path.sep}`))) {
  throw new Error("Use a folder outside the repo.");
}
for (const [command, args, fix] of [
  ["ffmpeg", ["-version"], "Install FFmpeg (on macOS: brew install ffmpeg)."],
  ["python3", ["-c", "import numpy"], "Install NumPy: python3 -m pip install numpy"],
]) {
  try {
    execFileSync(command, args, { stdio: "ignore" });
  } catch {
    throw new Error(`${command} check failed. ${fix}`);
  }
}

mkdirSync(work, { recursive: true });
for (const [from, to] of [
  ["engine", "engine"],
  ["scripts", "scripts"],
  ["realui", "realui"],
  ["example/zoonk-2", "films/zoonk-2"],
]) {
  cpSync(path.join(skill, from), path.join(work, to), { recursive: true, force: false });
}
writeFileSync(path.join(work, "studio.json"), `${JSON.stringify({ repo }, null, 2)}\n`);

const pkg = path.join(work, "package.json");
if (!existsSync(pkg)) {
  writeFileSync(
    pkg,
    `${JSON.stringify(
      {
        private: true,
        type: "module",
        scripts: { harness: "node node_modules/vite/bin/vite.js --config realui/vite.config.mjs" },
      },
      null,
      2,
    )}\n`,
  );
}
execFileSync(
  "npm",
  // geist lists Next as a peer; the studio only needs its font files.
  [
    "install",
    "--no-audit",
    "--no-fund",
    "--legacy-peer-deps",
    "gsap@3.15.0",
    "lucide-static@1.67.0",
    "geist@1.9.0",
  ],
  { cwd: work, stdio: "inherit" },
);

// The page's React, the AI SDK, Vite and Playwright come from the repo, so the harness renders with the
// app's exact versions and Playwright finds the browsers the repo's tests installed. npm install drops
// these links, so they're made after it.
const player = path.join(repo, "packages/player/node_modules");
/** pnpm puts a package's dependencies next to it, in the node_modules folder that holds it. */
const besides = (dir) => {
  const parts = realpathSync(dir).split(path.sep);
  return parts.slice(0, parts.lastIndexOf("node_modules") + 1).join(path.sep);
};
const links = {
  ai: path.join(player, "ai"),
  react: path.join(player, "react"),
  "react-dom": path.join(player, "react-dom"),
  "next-intl": path.join(player, "next-intl"),
  "lucide-react": path.join(player, "lucide-react"),
  "@vitejs/plugin-react": path.join(player, "@vitejs/plugin-react"),
  "@tailwindcss/vite": path.join(player, "@tailwindcss/vite"),
  vite: path.join(besides(path.join(player, "@vitejs/plugin-react")), "vite"),
  "playwright-core": path.join(besides(path.join(player, "playwright")), "playwright-core"),
};
for (const [name, target] of Object.entries(links)) {
  const link = path.join(work, "node_modules", name);
  rmSync(link, { force: true, recursive: true });
  mkdirSync(path.dirname(link), { recursive: true });
  symlinkSync(realpathSync(target), link, "dir");
}

const modules = path.join(work, "node_modules");
const assets = path.join(work, "assets");
for (const dir of ["js", "fonts", "svg", "real/en", "real/pt"]) {
  mkdirSync(path.join(assets, dir), { recursive: true });
}
for (const file of ["gsap.min.js", "CustomEase.min.js"]) {
  cpSync(path.join(modules, "gsap/dist", file), path.join(assets, "js", file));
}
cpSync(
  path.join(modules, "geist/dist/fonts/geist-sans/Geist-Variable.woff2"),
  path.join(assets, "fonts/GeistVF.woff2"),
);
cpSync(
  path.join(modules, "geist/dist/fonts/geist-mono/GeistMono-Variable.woff2"),
  path.join(assets, "fonts/GeistMonoVF.woff2"),
);

// Lucide, the app's icon set, as inner SVG markup by name for Z.icon().
const iconsDir = path.join(modules, "lucide-static/icons");
const icons = Object.fromEntries(
  readdirSync(iconsDir)
    .filter((file) => file.endsWith(".svg"))
    .map((file) => {
      const svg = readFileSync(path.join(iconsDir, file), "utf8");
      const inner = svg.slice(svg.indexOf(">", svg.indexOf("<svg")) + 1, svg.lastIndexOf("</svg>"));
      return [file.slice(0, -4), inner.replaceAll(/\s+/g, " ").trim()];
    }),
);
writeFileSync(path.join(assets, "js/icons.js"), `window.ICONS=${JSON.stringify(icons)};\n`);

const manifests = path.join(assets, "real/manifests.js");
if (!existsSync(manifests)) writeFileSync(manifests, "window.MANIFESTS={en:{},pt:{}};\n");

execFileSync("python3", [path.join(work, "realui/goals/buddy-gen.py")], { stdio: "inherit" });

console.log(`
Studio ready in ${work}
  npm run harness                          serves the app's components on http://localhost:5199
  node scripts/export-art.mjs              (with the harness running) saves the buddy and Trickster SVGs
  open http://localhost:5199/?lang=pt      lists every view
`);
