import { Geist, Geist_Mono } from "next/font/google";

// oxlint-disable-next-line eslint/new-cap -- next/font names its loaders after the font.
export const geistSans = Geist({ subsets: ["latin", "latin-ext"], variable: "--font-geist-sans" });

// oxlint-disable-next-line eslint/new-cap -- next/font names its loaders after the font.
export const geistMono = Geist_Mono({
  subsets: ["latin", "latin-ext"],
  variable: "--font-geist-mono",
});
