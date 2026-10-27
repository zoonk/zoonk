/**
 * What a principal engineer, a security researcher and a designer each stop at when they read a
 * Zoonk diff. A rule flags an added line (or a file the change creates); the author answers its
 * question in the report, by fixing the code or saying why it's right. `blocks` marks what must be
 * fixed rather than answered.
 */
export type Role = "design" | "engineering" | "security";

export type Rule = {
  blocks?: boolean;
  /** Only files whose current content says `"use client"` (client), or only the others (server). */
  side?: "client" | "server";
  /** A file the change creates whose path matches; for rules about new files. */
  created?: RegExp;
  files?: RegExp;
  line?: RegExp;
  name: string;
  question: string;
  role: Role;
};

export const CODE = /\.(?:mts|tsx?)$/u;
export const SOURCE =
  /^(?:apps|packages)\/[^/]+\/src\/(?!.*\.test\.)(?!.*_test-utils).*\.(?:mts|tsx?)$/u;
/** Code that runs on the server: the API, Main's routes and actions, and the server packages. */
export const SERVER_SOURCE =
  /^(?:apps\/(?:api|main)|packages\/(?:ai|auth|core|db|utils))\/src\/(?!.*\.test\.).*\.(?:mts|tsx?)$/u;
export const UI = /\.tsx$/u;
export const TESTS = /\.test\.(?:mts|tsx?)$/u;
