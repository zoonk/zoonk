import { CODE, type Rule, SERVER_SOURCE, SOURCE } from "./shared.mts";

/** What a security researcher questions: secrets, entry points, model calls, injection and trust. */
export const SECURITY_RULES: Rule[] = [
  {
    blocks: true,
    line: /\bsk_live_\w{8,}|\bsk_test_\w{16,}|\bAKIA[0-9A-Z]{16}\b|-----BEGIN [A-Z ]*PRIVATE KEY|\bgh[pousr]_\w{30,}|\bxox[abps]-[\w-]{10,}|\bAIza[\w-]{30,}|\beyJ[\w-]{20,}\.eyJ[\w-]{20,}/u,
    name: "Secret",
    question: "A credential in the code: remove it, rotate it, and read it from the environment.",
    role: "security",
  },
  {
    blocks: true,
    created: /(?:^|\/)\.env(?:\.[\w.]+)?$(?<!\.example)/u,
    name: "Environment file",
    question: "An env file in the change: keep secrets out of git (only `.env.example`).",
    role: "security",
  },
  {
    files: /(?:^|\/)pnpm-workspace\.yaml$/u,
    line: /\b(?:allowBuilds|onlyBuiltDependencies|overrides|minimumReleaseAge|patchedDependencies)\b|^\s+[@\w./-]+:\s*(?:true|false|['"]?[~^]?\d)/u,
    name: "Install policy",
    question:
      "Which package may now run install scripts or resolve to another version, and why? Each one runs code on every install and in CI.",
    role: "security",
  },
  {
    files: /^\.github\/workflows\/.*\.ya?ml$/u,
    line: /\buses:\s*(?!\.\/)[\w.-]+\/[\w./-]+@(?![0-9a-f]{40}\b)/u,
    name: "Unpinned action",
    question:
      "Pin it to a full commit SHA (with the version in a comment): a tag can be moved to run other code in CI, with its secrets.",
    role: "security",
  },
  {
    files: CODE,
    line: /^\s*["']use server["']/u,
    name: "Server Action",
    question:
      "Every export here is a public POST anyone can call: does each authenticate, authorize through a core capability, validate its input, and rate-limit or budget anything that costs (AI)? Is it in the public API too (parity)?",
    role: "security",
  },
  {
    created: /\/route\.tsx?$/u,
    name: "Route handler",
    question:
      "Who may call it? It needs the same authentication, authorization, input validation and limits as a Server Action, an OpenAPI entry if it's public, and no writes or AI on GET.",
    role: "security",
  },
  {
    files: CODE,
    line: /\b(?:generateText|streamText|generateObject|streamObject|embedMany|embed)\(/u,
    name: "Model call",
    question:
      "Does only a learner's POST start it, inside their limits and the AI budget? Is learner text kept from steering it (prompt injection), and its output checked before it's saved or shown?",
    role: "security",
  },
  {
    files: CODE,
    line: /dangerouslySetInnerHTML|\.innerHTML\s*=/u,
    name: "Raw HTML",
    question: "Is this HTML trusted or sanitized? Never learner or model text as HTML.",
    role: "security",
  },
  {
    files: CODE,
    line: /\$(?:query|execute)RawUnsafe\(|Prisma\.raw\(|\beval\(|new Function\(/u,
    name: "Code or SQL built from strings",
    question:
      "Can any part come from a request? Use parameters (`$queryRaw` tagged templates), never concatenation.",
    role: "security",
  },
  {
    files: CODE,
    line: /\bNEXT_PUBLIC_\w+/u,
    name: "Public environment value",
    question: "It ships to every browser: is it safe for anyone to read?",
    role: "security",
  },
  {
    files: CODE,
    line: /\bprocess\.env\.(?!NEXT_PUBLIC_|NODE_ENV)/u,
    name: "Server value in a client file",
    question:
      "Client code only sees NEXT_PUBLIC_ values: is a secret being bundled, or is this always undefined?",
    role: "security",
    side: "client",
  },
  {
    files: SOURCE,
    line: /\bredirect\([^)"'`]|\bNextResponse\.redirect\(/u,
    name: "Redirect to a variable",
    question:
      "Can the target come from the request? Allow only this site's own paths (open redirect).",
    role: "security",
  },
  {
    files: SERVER_SOURCE,
    line: /\bfetch\(\s*(?!["'`](?:https?:\/\/|\/))[\w`]/u,
    name: "Server request to a variable URL",
    question:
      "Can a learner choose the URL? Check it with `isPublicUrl`/`publicLookup` (packages/core/src/library/sources/_utils/public-url.ts) so it can't reach private networks (SSRF).",
    role: "security",
    side: "server",
  },
  {
    files: SOURCE,
    line: /\bcookies\(\)\.(?:set|delete)\(|Set-Cookie/iu,
    name: "Cookie",
    question: "HttpOnly, Secure and SameSite set, and nothing secret readable by scripts?",
    role: "security",
  },
  {
    files: SOURCE,
    line: /\bx-forwarded-for\b|\bx-real-ip\b/iu,
    name: "Client-supplied header",
    question: "Anyone can send this header: is it only trusted from Vercel's proxy?",
    role: "security",
  },
];
