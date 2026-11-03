# Certificate fonts

The certificate renderer (`../certificate-image.tsx`) bundles its fonts so a render never fetches one. All are under the SIL Open Font License (`OFL.txt`) except `ZoonkStrut.ttf`, which is ours.

## Satori (this folder)

Satori draws the certificate's own words. It takes no variable fonts, so each weight is a static instance, and Satori leaves a wide gap after every word it kerns, so the Geist copies have no `GPOS` table.

| File                              | From                                                | How                                                                                                      |
| --------------------------------- | --------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `Geist-{400,500,560,620,640}.ttf` | google/fonts `ofl/geist/Geist[wght].ttf`            | `fonttools varLib.instancer … wght=<weight>`, then `GPOS` removed                                        |
| `GeistMono-{400,500,600}.ttf`     | google/fonts `ofl/geistmono/GeistMono[wght].ttf`    | same                                                                                                     |
| `NotoSans-400.ttf`                | google/fonts `ofl/notosans/NotoSans[wdth,wght].ttf` | instanced at `wght=400 wdth=100`, subset to the characters Geist lacks (Greek, rarer Latin and Cyrillic) |
| `NotoSansJP-400.ttf`              | google/fonts `ofl/notosansjp/NotoSansJP[wght].ttf`  | instanced at 400, subset to JIS X 0208, kana and punctuation                                             |
| `NotoSansKR-400.ttf`              | google/fonts `ofl/notosanskr/NotoSansKR[wght].ttf`  | instanced at 400, subset to every Hangul syllable, jamo and punctuation                                  |

A character missing from the Japanese or Korean subsets falls back to `next/og`'s Google Fonts fetch.

## Pango (`shaping/`)

Names and titles, which can be in any script, are shaped by Pango through `sharp`. fontconfig reads `shaping/fonts.conf`, which lists this folder and nothing else, so local renders match Vercel's.

| File                                                                                                       | From                                                        | How                                                                                                                                  |
| ---------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `Geist-Variable.ttf`                                                                                       | google/fonts `ofl/geist/Geist[wght].ttf`                    | as is                                                                                                                                |
| `NotoSans-650.ttf`                                                                                         | google/fonts `ofl/notosans`                                 | instanced at 650, subset like `NotoSans-400.ttf`                                                                                     |
| `NotoSans{Arabic,Hebrew,Devanagari,Thai,Bengali,Tamil,Telugu,Gujarati,Gurmukhi,Kannada,Malayalam}-650.ttf` | google/fonts `ofl/notosans<script>`                         | instanced at `wght=650 wdth=100`                                                                                                     |
| `NotoSansCJK-650.otf`                                                                                      | notofonts/noto-cjk `Sans/Variable/OTF/NotoSansCJKjp-VF.otf` | instanced at 650; one font for Japanese, Korean and Chinese names, its regional shapes picked by the span's `lang`                   |
| `NotoEmoji-600.ttf`                                                                                        | google/fonts `ofl/notoemoji/NotoEmoji[wght].ttf`            | instanced at 600                                                                                                                     |
| `ZoonkStrut.ttf`                                                                                           | built with fontTools `FontBuilder`                          | one glyph at U+2502 inking 1.5 em above the baseline and 0.6 em below, with Geist's ascender and descender (see `../shaped-text.ts`) |

The CJK font is whole, not subset: names carry rare characters (髙橋, 𠮷野) that no standard character set holds.
