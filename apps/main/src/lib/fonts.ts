import { Geist, Geist_Mono } from "next/font/google";

/**
 * The app's two faces, served with the app: Geist for text and Geist Mono for numbers that change
 * or line up. `@zoonk/ui`'s theme reads their variables as `font-sans` and `font-mono`.
 */
// oxlint-disable-next-line eslint/new-cap -- next/font names its loaders after the font.
export const geistSans = Geist({ subsets: ["latin", "latin-ext"], variable: "--font-geist-sans" });

// oxlint-disable-next-line eslint/new-cap -- next/font names its loaders after the font.
export const geistMono = Geist_Mono({
  subsets: ["latin", "latin-ext"],
  variable: "--font-geist-mono",
});
