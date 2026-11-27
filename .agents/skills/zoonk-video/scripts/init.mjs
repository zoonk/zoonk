// Sets up a video studio in a folder outside the repo:
//   node .agents/skills/zoonk-video/scripts/init.mjs <work-dir> [--port 5199]
// Safe to run again: it adds missing files and refreshes links and generated files, and never overwrites your edits.
// It ends with the harness's type check, so a view that drifted from the app's contracts fails here, not on screen.
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { prepareStudio, repo } from "./prepare-studio.mjs";
const [dir, ...options] = process.argv.slice(2);
const work = path.resolve(dir ?? "");
const portAt = options.indexOf("--port");
const port = Number(portAt === -1 ? 5199 : options[portAt + 1]);

if (!dir || !Number.isInteger(port))
  throw new Error("usage: node init.mjs <work-dir> [--port 5199]");
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

const pkg = path.join(work, "package.json");
// Init never overwrites a studio's files, so over one made before the stage it would leave the old views and
// scripts in place. Those folders are scratch: start a fresh one and bring the films across.
if (existsSync(pkg) && !JSON.parse(readFileSync(pkg, "utf8")).scripts?.typecheck) {
  throw new Error(
    `${work} is a studio from before the stage. Make a fresh one (node init.mjs <new-dir>) and copy your films/ into it.`,
  );
}

mkdirSync(work, { recursive: true });

if (!existsSync(pkg)) {
  writeFileSync(
    pkg,
    `${JSON.stringify(
      {
        private: true,
        type: "module",
        scripts: {
          harness: "node node_modules/vite/bin/vite.js --config realui/vite.config.mjs",
          typecheck: "node scripts/typecheck.mjs",
        },
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

prepareStudio(work, port);

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

console.log(`
Studio in ${work}
  npm run harness                       serves the app's components on http://localhost:${port}
  open http://localhost:${port}/?lang=pt   lists every view
  node scripts/export-art.mjs           (with the harness running) saves the buddy and Trickster SVGs
`);
try {
  execFileSync("node", [path.join(work, "scripts/typecheck.mjs")], { stdio: "inherit" });
} catch {
  process.exitCode = 1;
}
