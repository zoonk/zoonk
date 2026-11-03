import { type CourseCategory } from "@zoonk/utils/categories";

/**
 * The light theme's tokens in `packages/ui/src/styles/globals.css`, in sRGB because Satori and Pango
 * read no `oklch()`. A certificate is always light. `certificate-palette.test.ts` keeps them equal.
 */
export const CERTIFICATE_COLORS = {
  edge: "rgba(0, 0, 0, 0.07)",
  faint: "#6e6e76",
  ground: "#f7f7f6",
  hairline: "rgba(0, 0, 0, 0.13)",
  ink: "#121214",
  muted: "#64646b",
  paper: "#ffffff",
  shadow: "rgba(0, 0, 0, 0.14)",
  success: "#4b95e5",
  successText: "#2d74ca",
  track: "#ebebe8",
} as const;

/** Each subject's `--subject-text` and its `--subject` at the tint's 13%, from `[data-subject]` in globals.css. */
export const SUBJECT_COLORS: Record<CourseCategory, { text: string; tint: string }> = {
  arts: { text: "#774773", tint: "rgba(191, 127, 185, 0.13)" },
  business: { text: "#655b2f", tint: "rgba(166, 152, 96, 0.13)" },
  communication: { text: "#32607d", tint: "rgba(101, 160, 198, 0.13)" },
  culture: { text: "#74532f", tint: "rgba(186, 143, 96, 0.13)" },
  economics: { text: "#336840", tint: "rgba(103, 170, 118, 0.13)" },
  engineering: { text: "#355e87", tint: "rgba(105, 157, 210, 0.13)" },
  exams: { text: "#525586", tint: "rgba(141, 146, 210, 0.13)" },
  geography: { text: "#346657", tint: "rgba(104, 167, 147, 0.13)" },
  health: { text: "#854354", tint: "rgba(209, 122, 143, 0.13)" },
  history: { text: "#7f4c2e", tint: "rgba(201, 134, 96, 0.13)" },
  languages: { text: "#874539", tint: "rgba(211, 126, 109, 0.13)" },
  law: { text: "#6d572f", tint: "rgba(176, 148, 96, 0.13)" },
  math: { text: "#326272", tint: "rgba(102, 162, 183, 0.13)" },
  science: { text: "#336466", tint: "rgba(103, 165, 166, 0.13)" },
  society: { text: "#54622f", tint: "rgba(143, 161, 96, 0.13)" },
  tech: { text: "#435a86", tint: "rgba(121, 152, 210, 0.13)" },
};
