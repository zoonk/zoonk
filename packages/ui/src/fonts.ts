import { Geist, Geist_Mono } from "next/font/google";

// oxlint-disable-next-line eslint/new-cap -- next/font names its loaders after the font.
const geistSans = Geist({ subsets: ["latin", "latin-ext"], variable: "--font-geist-sans" });

// oxlint-disable-next-line eslint/new-cap -- next/font names its loaders after the font.
const geistMono = Geist_Mono({ subsets: ["latin", "latin-ext"], variable: "--font-geist-mono" });

/** Goes on a Next app's `<html>`: it sets the variables `font-sans` and `font-mono` read. */
export const FONT_VARIABLES = `${geistSans.variable} ${geistMono.variable}`;
