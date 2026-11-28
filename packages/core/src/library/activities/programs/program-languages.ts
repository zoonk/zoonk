type Language = { convention: string; fileName: string; name: string; runs: "device" | "sandbox" };

/** The largest program, in UTF-8 bytes, that our servers run. */
export const MAX_CODE_BYTES = 65_536;

export const PROGRAM_LANGUAGES = {
  cpp: { convention: "Use int main().", fileName: "main.cpp", name: "C++", runs: "sandbox" },
  csharp: {
    convention: "Use top-level statements or a static Main method.",
    fileName: "Program.cs",
    name: "C#",
    runs: "sandbox",
  },
  go: {
    convention: "Use package main and func main().",
    fileName: "main.go",
    name: "Go",
    runs: "sandbox",
  },
  java: {
    convention: "Use class Main with public static void main(String[] args).",
    fileName: "Main.java",
    name: "Java",
    runs: "sandbox",
  },
  javascript: {
    convention: "console.log prints like Node (arrays as [ 1, 2 ], objects as { a: 1 }).",
    fileName: "main.js",
    name: "JavaScript",
    runs: "device",
    timeLimitMs: 3000,
  },
  kotlin: {
    convention: "Use fun main() with no package declaration.",
    fileName: "Main.kt",
    name: "Kotlin",
    runs: "sandbox",
  },
  php: { convention: "Start with <?php.", fileName: "main.php", name: "PHP", runs: "sandbox" },
  python: {
    convention: "Use Python's standard library.",
    fileName: "main.py",
    name: "Python",
    runs: "device",
    timeLimitMs: 5000,
  },
  ruby: {
    convention: "Use top-level Ruby code.",
    fileName: "main.rb",
    name: "Ruby",
    runs: "sandbox",
  },
  rust: { convention: "Use fn main().", fileName: "main.rs", name: "Rust", runs: "sandbox" },
  swift: {
    convention: "Use top-level Swift code.",
    fileName: "main.swift",
    name: "Swift",
    runs: "sandbox",
  },
  typescript: {
    convention: "Use top-level TypeScript and console.log, with no imports.",
    fileName: "main.ts",
    name: "TypeScript",
    runs: "sandbox",
  },
} as const satisfies Record<string, Language | (Language & { timeLimitMs: number })>;

export type ProgramLanguage = keyof typeof PROGRAM_LANGUAGES;
export type SandboxLanguage = {
  [Id in ProgramLanguage]: (typeof PROGRAM_LANGUAGES)[Id]["runs"] extends "sandbox" ? Id : never;
}[ProgramLanguage];

export function isSandboxLanguage(language: ProgramLanguage): language is SandboxLanguage {
  return PROGRAM_LANGUAGES[language].runs === "sandbox";
}

export const PROGRAM_LANGUAGE_IDS = Object.keys(PROGRAM_LANGUAGES).filter(
  (language): language is ProgramLanguage => Object.hasOwn(PROGRAM_LANGUAGES, language),
);
export const SANDBOX_LANGUAGE_IDS = PROGRAM_LANGUAGE_IDS.filter((language) =>
  isSandboxLanguage(language),
);
