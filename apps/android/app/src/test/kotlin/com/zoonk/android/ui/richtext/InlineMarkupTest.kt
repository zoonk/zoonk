package com.zoonk.android.ui.richtext

import com.zoonk.android.ui.richtext.MarkupKind.Bold
import com.zoonk.android.ui.richtext.MarkupKind.Code
import com.zoonk.android.ui.richtext.MarkupKind.Italic
import com.zoonk.android.ui.richtext.MarkupKind.Text
import org.junit.Assert.assertEquals
import org.junit.Test

class InlineMarkupTest {
    @Test
    fun readsBoldItalicsWithStarsOrUnderscoresAndInlineCode() {
        assertEquals(
            listOf(
                InlineMarkup(Text, "Cada valor vale "),
                InlineMarkup(Bold, "10 mil viagens"),
                InlineMarkup(Text, "; o filme "),
                InlineMarkup(Italic, "Caminhos"),
                InlineMarkup(Text, ": "),
                InlineMarkup(Code, "COUNT(*)"),
            ),
            parseInlineMarkup("Cada valor vale **10 mil viagens**; o filme *Caminhos*: `COUNT(*)`"),
        )
    }

    @Test
    fun leavesSnakeCaseMultiplicationLoneMarkersAndMarkersInsideCodeAsText() {
        assertEquals(
            listOf(InlineMarkup(Text, "user_id, 2 * 3 * 4 and SELECT * FROM t")),
            parseInlineMarkup("user_id, 2 * 3 * 4 and SELECT * FROM t"),
        )

        assertEquals(
            listOf(
                InlineMarkup(Text, "Ich ___ nach Hause und du ____ "),
                InlineMarkup(Italic, "gern"),
                InlineMarkup(Text, "?"),
            ),
            parseInlineMarkup("Ich ___ nach Hause und du ____ _gern_?"),
        )

        assertEquals(
            listOf(InlineMarkup(Code, "a_b_c"), InlineMarkup(Text, " and "), InlineMarkup(Code, "**x**")),
            parseInlineMarkup("`a_b_c` and `**x**`"),
        )
    }

    @Test
    fun readsWordsInAngleQuotesAsItalicsWithoutTheMarks() {
        assertEquals(
            listOf(
                InlineMarkup(Text, "A legenda "),
                InlineMarkup(Italic, "Duas bolas no chão"),
                InlineMarkup(Text, " combina; "),
                InlineMarkup(Italic, "Três caixas"),
                InlineMarkup(Text, " não."),
            ),
            parseInlineMarkup("A legenda «Duas bolas no chão» combina; <<Três caixas>> não."),
        )

        assertEquals(
            listOf(InlineMarkup(Bold, "Legenda"), InlineMarkup(Text, ": "), InlineMarkup(Italic, "Mettre fin au lien")),
            parseInlineMarkup("**Legenda**: « Mettre fin au lien »"),
        )
    }

    @Test
    fun leavesUnpairedAngleQuotesAndShiftsInsideCodeAsText() {
        assertEquals(
            listOf(InlineMarkup(Text, "x << 2 and "), InlineMarkup(Code, "a << b >> c"), InlineMarkup(Text, " and «")),
            parseInlineMarkup("x << 2 and `a << b >> c` and «"),
        )
    }

    @Test
    fun findsNothingInAnEmptyLine() {
        assertEquals(emptyList<InlineMarkup>(), parseInlineMarkup(""))
    }
}
