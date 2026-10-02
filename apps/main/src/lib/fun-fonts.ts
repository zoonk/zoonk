import { Figtree, Unbounded } from "next/font/google";

/**
 * Fun mode's type: Unbounded for numbers and titles, Figtree for reading. They
 * are self-hosted and not preloaded, so Focus pages never download them; Fun
 * text fetches only the subsets it renders (Latin covers en, es, pt, de and fr).
 * `@zoonk/ui/fun.css` reads the CSS variables.
 */
// oxlint-disable-next-line eslint/new-cap -- next/font loaders are functions named after their font.
const unbounded = Unbounded({
  display: "swap",
  preload: false,
  subsets: ["latin"],
  variable: "--font-unbounded",
});

// oxlint-disable-next-line eslint/new-cap -- next/font loaders are functions named after their font.
const figtree = Figtree({
  display: "swap",
  preload: false,
  subsets: ["latin"],
  variable: "--font-figtree",
});

export const funFontVariables = `${unbounded.variable} ${figtree.variable}`;
