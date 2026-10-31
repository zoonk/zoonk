package com.zoonk.android.feature.activities.music

/** Melodies that cover what the notation player reads: meters, keys, clefs, repeats, endings, ties, tuplets, chords and rests. */
internal object MusicTunes {
    const val SCALE = "T:C major scale\nM:4/4\nL:1/4\nK:C\nC D E F | G A B c | c B A G | F E D C |]"
    const val JIG = "T:The Kesh\nM:6/8\nL:1/8\nK:G\n|:GAG GAB|ABA ABd|edd gdd|edB dBA|\nGAG GAB|ABA ABd|edd gdB|AGF G3:|"
    const val ENDINGS = "T:Endings\nM:4/4\nL:1/8\nK:D\n|:D2FA d2fd|e2c2 A4|1 B2AG F2E2:|2 B2cB A4|]"
    const val TIES = "T:Ties and triplets\nM:3/4\nL:1/8\nK:F\nF2 A2 c2-|c2 (3BAG F2|E4- E2|F6|]"
    const val CHORDS = "T:Chords\nM:4/4\nL:1/4\nK:G\n\"G\"[GBd] \"C\"[ceg] \"D7\"[DF^Ac] \"G\"[G,B,DG]|\"Em\"E>F G<A B2 z2|]"
    const val BASS = "T:Bass line\nM:2/4\nL:1/8\nK:Bb clef=bass\nB,,D,F,D, | _E,G,=B,,C, | D,4 |]"
    const val CHROMATIC = "T:Chromatic\nC:Traditional\nM:C\nL:1/16\nK:A\nABcd efga a2g2 f2e2|[K:Eb] e4 =e4 ^f2g2 z4|]"
    const val RESTS = "M:3/4\nL:1/4\nK:Em\nE z G | z2 B | Z | e3 |]"
    const val UNITLESS = "T:No unit length\nM:2/4\nK:C\nCDEF GABc|c2B2 A4|]"

    val all =
        mapOf(
            "scale" to SCALE,
            "jig" to JIG,
            "endings" to ENDINGS,
            "ties" to TIES,
            "chords" to CHORDS,
            "bass" to BASS,
            "chromatic" to CHROMATIC,
            "rests" to RESTS,
            "unitless" to UNITLESS,
        )
}
