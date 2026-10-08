import { type CourseCategory } from "@zoonk/utils/categories";

/**
 * The version of the style block, the palettes and the prompt layout. Every
 * image stores it, and reuse only matches images of the same version, so a
 * change that makes new images look different must bump it. Old images are
 * replaced when their lesson is next revised, never regenerated in bulk.
 */
export const IMAGE_STYLE_VERSION = 2;

/**
 * A portrait picture, like main's lesson images: it fills a phone's screen
 * above the words, the way learners liked in story-like lessons.
 */
export const IMAGE_SIZE = "1024x1280";

/**
 * Two to four soft colors and one accent. Each subject keeps its own colors in
 * every image, so a physics course looks like one course. Hex values anchor
 * the names for the image model; the names do most of the work.
 */
export type ImagePalette = { key: string; colors: readonly string[]; accent: string };

type PaletteKey = CourseCategory | "general";

const PALETTES: Readonly<Record<PaletteKey, Omit<ImagePalette, "key">>> = {
  arts: {
    accent: "raspberry (#E0457B)",
    colors: ["soft violet (#B69CF0)", "pale lilac (#EFE8FD)", "warm gray (#78716C)"],
  },
  business: {
    accent: "amber (#FBBF24)",
    colors: ["dusty navy (#5B6B9A)", "pale cream (#FBF3E0)", "warm gray (#78716C)"],
  },
  communication: {
    accent: "coral (#F97360)",
    colors: ["soft sky blue (#7DB8F2)", "pale blue (#E3F0FD)", "slate gray (#64748B)"],
  },
  culture: {
    accent: "turquoise (#1FB5A8)",
    colors: ["saffron (#F2B45A)", "pale peach (#FDEEDB)", "soft plum (#8E6C8A)"],
  },
  economics: {
    accent: "amber (#FBBF24)",
    colors: ["soft green (#7FC8A0)", "pale mint (#E3F4EA)", "slate gray (#64748B)"],
  },
  engineering: {
    accent: "safety orange (#F59E0B)",
    colors: ["steel blue (#7A9CC6)", "pale steel (#E3EAF3)", "charcoal (#334155)"],
  },
  general: {
    accent: "amber (#FBBF24)",
    colors: ["soft indigo (#8B93F8)", "pale lavender (#E4E6FD)", "slate gray (#64748B)"],
  },
  geography: {
    accent: "coral (#F97360)",
    colors: ["sea blue (#6BB5D8)", "sand (#F3E7C9)", "leaf green (#8CC084)"],
  },
  health: {
    accent: "teal (#14B8A6)",
    colors: ["soft rose (#F4A6B4)", "pale blush (#FDE8EC)", "slate gray (#64748B)"],
  },
  history: {
    accent: "deep teal (#0F766E)",
    colors: ["terracotta (#D08C6B)", "parchment (#F6ECDC)", "warm brown (#8B6B4E)"],
  },
  languages: {
    accent: "coral red (#F05D5E)",
    colors: ["soft indigo (#6E6CD8)", "pale lavender (#E6E4FB)", "warm yellow (#F8D26A)"],
  },
  law: {
    accent: "gold (#D4A72C)",
    colors: ["slate navy (#5A6A8A)", "pale stone (#ECEAE4)", "warm gray (#78716C)"],
  },
  math: {
    accent: "sunflower yellow (#F8C630)",
    colors: ["soft teal (#5CC8C2)", "pale mint (#DDF4F2)", "slate gray (#64748B)"],
  },
  science: {
    accent: "coral red (#F05D5E)",
    colors: ["soft indigo (#8B93F8)", "pale lavender (#E4E6FD)", "slate gray (#64748B)"],
  },
  society: {
    accent: "sunflower yellow (#F8C630)",
    colors: ["soft sage (#9DBF9E)", "pale sage (#E8F1E8)", "slate gray (#64748B)"],
  },
  tech: {
    accent: "lime green (#84CC16)",
    colors: ["soft blue (#6FA8F5)", "pale sky (#E0ECFD)", "charcoal (#334155)"],
  },
};

function isPaletteKey(value: string): value is PaletteKey {
  return value in PALETTES;
}

/** The subject's palette, from the course's category; unknown or missing categories share one. */
export function getImagePalette(category: string | null | undefined): ImagePalette {
  const key = category && isPaletteKey(category) ? category : "general";
  return { key, ...PALETTES[key] };
}
