package com.zoonk.android.ui.richtext

import com.zoonk.android.ui.richtext.SegmentKind.Bold
import com.zoonk.android.ui.richtext.SegmentKind.Code
import com.zoonk.android.ui.richtext.SegmentKind.DisplayMath
import com.zoonk.android.ui.richtext.SegmentKind.Italic
import com.zoonk.android.ui.richtext.SegmentKind.Math
import com.zoonk.android.ui.richtext.SegmentKind.Text
import org.junit.Assert.assertEquals
import org.junit.Test

private fun text(value: String) = RichSegment(Text, value)

private fun marked(
    kind: SegmentKind,
    value: String,
) = RichSegment(kind, value, marked = true)

/**
 * Main's parser cases (`packages/player/src/lesson/_utils/lesson-rich-text.test.ts` and the
 * formulas `math-markup.test.ts` finds), plus Apple's `RichTextBlockTests`.
 */
class RichTextParserTest {
    @Test
    fun readsInlineAndDisplayMathBetweenDollarSigns() {
        assertEquals(
            listOf(
                text("So "),
                RichSegment(Math, "0.75 \\times 80 = 60"),
                text(" and "),
                RichSegment(DisplayMath, "A = P(1+r)^t"),
                text(" too"),
            ),
            parseRichInline("So $0.75 \\times 80 = 60$ and $\$A = P(1+r)^t$$ too"),
        )
    }

    @Test
    fun keepsPricesAndCurrenciesAsText() {
        assertEquals(listOf(text("It costs $5 and $10, or R$ 80.")), parseRichInline("It costs $5 and $10, or R$ 80."))
        assertEquals(listOf(text("Pay $5 now")), parseRichInline("Pay \\$5 now"))
        assertEquals(listOf(text("It costs $5 and then $10.")), parseRichInline("It costs $5 and then $10."))
    }

    @Test
    fun readsBoldItalicsWithStarsOrUnderscoresAndInlineCode() {
        assertEquals(
            listOf(
                text("A "),
                RichSegment(Bold, "cloud"),
                text(" of "),
                RichSegment(Italic, "chances"),
                text(", not "),
                RichSegment(Italic, "paths"),
                text(": "),
                RichSegment(Code, "orbit()"),
            ),
            parseRichInline("A **cloud** of _chances_, not *paths*: `orbit()`"),
        )
    }

    @Test
    fun leavesSnakeCaseMultiplicationAndEmphasisMarkersInsideCodeAlone() {
        assertEquals(listOf(text("user_id stays, 2 * 3 * 4 too")), parseRichInline("user_id stays, 2 * 3 * 4 too"))
        assertEquals(
            listOf(RichSegment(Code, "a_b_c"), text(" and "), RichSegment(Code, "**x**")),
            parseRichInline("`a_b_c` and `**x**`"),
        )
    }

    @Test
    fun neverAppliesEmphasisInsideMath() {
        assertEquals(listOf(RichSegment(Math, "a_1 * b_2")), parseRichInline("$" + "a_1 * b_2$"))
    }

    @Test
    fun keepsStandardAndOverEscapedLatexDistinctFromCurrencyAndEmphasis() {
        assertEquals(
            listOf(
                RichSegment(Bold, "Compare"),
                text(" "),
                RichSegment(Math, "x^2"),
                text(", "),
                RichSegment(Math, "y^2"),
                text(" and "),
                RichSegment(Math, "z^2"),
                text(" for R$ 80."),
            ),
            parseRichInline("**Compare** \\(x^2\\), \\\\(y^2\\\\) and \$z^2$ for R$ 80."),
        )
    }

    @Test
    fun readsEveryLatexDelimiter() {
        assertEquals(
            listOf(
                text("Compare "),
                RichSegment(Math, "x^2"),
                text(" with "),
                RichSegment(DisplayMath, "\\frac{a}{b}"),
                text(", "),
                RichSegment(Math, "y_1"),
                text(" and "),
                RichSegment(DisplayMath, "\\sqrt{z}"),
                text("."),
            ),
            parseRichInline("Compare \$x^2$ with $\$\\frac{a}{b}$$, \\(y_1\\) and \\[\\sqrt{z}\\]."),
        )
    }

    @Test
    fun readsAFormulaAcrossLinesOnceTheTextIsOneLine() {
        assertEquals(
            listOf(text("The speed is "), RichSegment(DisplayMath, "v = \\sqrt{\\frac{GM}{r}}"), text(" in orbit.")),
            parseRichInline(toOneLine("The speed is $\$v =\n  \\sqrt{\\frac{GM}{r}}$$ in orbit.")),
        )
    }

    @Test
    fun groupsLinesIntoParagraphsAndLists() {
        val blocks =
            parseRichBlocks("The cloud shows:\n- where it's likely\n- where it isn't\n\n1. Read it\n2. Guess\n\nThat's all.")

        assertEquals(
            listOf(RichBlock.Paragraph::class, RichBlock.ListBlock::class, RichBlock.ListBlock::class, RichBlock.Paragraph::class),
            blocks.map { it::class },
        )
        assertEquals(
            RichBlock.ListBlock(listOf(listOf(text("where it's likely")), listOf(text("where it isn't"))), ordered = false),
            blocks[1],
        )
        assertEquals(true, (blocks[2] as RichBlock.ListBlock).ordered)
    }

    @Test
    fun keepsASingleLineBreakInsideTheParagraphAndSplitsOnABlankLine() {
        assertEquals(
            listOf(
                RichBlock.Paragraph(listOf(listOf(text("First line")), listOf(text("second line")))),
                RichBlock.Paragraph(listOf(listOf(text("New idea")))),
            ),
            parseRichBlocks("First line\nsecond line\n\nNew idea"),
        )
    }

    @Test
    fun readsATableOfDataBetweenParagraphsWithMathAndEmphasisInItsCells() {
        assertEquals(
            listOf(
                RichBlock.Paragraph(listOf(listOf(text("Uma tabela mostra as bicicletas:")))),
                RichBlock.Table(
                    align = listOf(null, TableAlign.End),
                    header = listOf(listOf(text("Hora")), listOf(text("Bicicletas"))),
                    rows =
                        listOf(
                            listOf(listOf(text("7h")), listOf(text("9"))),
                            listOf(listOf(RichSegment(Bold, "8h")), listOf(RichSegment(Math, "5"))),
                        ),
                ),
                RichBlock.Paragraph(listOf(listOf(text("Qual horário teve menos?")))),
            ),
            parseRichBlocks(
                "Uma tabela mostra as bicicletas:\n| Hora | Bicicletas |\n|---|---:|\n| 7h | 9 |\n| **8h** | \$5$ |\n\nQual horário teve menos?",
            ),
        )
    }

    @Test
    fun findsFormulasInATablesCellsAndAListsItems() {
        val (table, list) = parseRichBlocks("| Sensor | Formula |\n| --- | --- |\n| A | \$x^2$ |\n\n- First \$a+b$\n- Second")
        val cells = (table as RichBlock.Table).rows.flatten().flatten()
        val items = (list as RichBlock.ListBlock).items.flatten()

        assertEquals(listOf("x^2", "a+b"), (cells + items).filter { it.kind == Math }.map { it.text })
    }

    @Test
    fun listsLoseTheirMarkersAndEndAtOtherText() {
        val text =
            """
            Owning shares gives you:

            - A part of the **profit**
            * A vote
            • A slice of the future

            1. First
            2) Second
            It doesn't give you a guaranteed return.
            """.trimIndent()

        assertEquals(
            listOf(
                RichBlock.Paragraph(listOf(listOf(text("Owning shares gives you:")))),
                RichBlock.ListBlock(
                    listOf(
                        listOf(text("A part of the "), RichSegment(Bold, "profit")),
                        listOf(text("A vote")),
                        listOf(text("A slice of the future")),
                    ),
                    ordered = false,
                ),
                RichBlock.ListBlock(listOf(listOf(text("First")), listOf(text("Second"))), ordered = true),
                RichBlock.Paragraph(listOf(listOf(text("It doesn't give you a guaranteed return.")))),
            ),
            parseRichBlocks(text),
        )
    }

    @Test
    fun aTableNeedsADelimiterRowWithItsCellsAndPadsShortRows() {
        assertEquals(
            listOf(
                RichBlock.Table(
                    align = listOf(TableAlign.Start, TableAlign.End),
                    header = listOf(listOf(text("Price")), listOf(text("Shares"))),
                    rows = listOf(listOf(listOf(text("5")), listOf(text("10")))),
                ),
                RichBlock.Paragraph(listOf(listOf(text("7")), listOf(text("After")))),
            ),
            parseRichBlocks("Price | Shares\n:--- | ---:\n5 | 10\n7\nAfter"),
        )

        assertEquals(
            listOf(RichBlock.Paragraph(listOf(listOf(text("| a | b |")), listOf(text("|---|")), listOf(text("rest"))))),
            parseRichBlocks("| a | b |\n|---|\nrest"),
        )
    }

    @Test
    fun marksTheQuotedSentenceByTheWordsItShowsAcrossEmphasisAndOnlyOnce() {
        val text = "A change multiplies the **current** value. Then it repeats.\n\nA change multiplies the **current** value."
        val (first, second) = markRichBlocks(parseRichBlocks(text), "A change multiplies the **current** value.")

        assertEquals(
            RichBlock.Paragraph(
                listOf(
                    listOf(
                        marked(Text, "A change multiplies the "),
                        marked(Bold, "current"),
                        marked(Text, " value."),
                        text(" Then it repeats."),
                    ),
                ),
            ),
            first,
        )
        assertEquals(parseRichBlocks(text)[1], second)
    }

    @Test
    fun splitsEmphasisTheQuoteStartsInsideAndMarksAFormulaItReachesWhole() {
        assertEquals(
            listOf(
                RichSegment(Bold, "Always "),
                marked(Bold, "multiply"),
                marked(Text, " by "),
                marked(Math, "1.2"),
                text(" first."),
            ),
            markRichInline(parseRichInline("**Always multiply** by \$1.2$ first."), "multiply by 1"),
        )
    }

    @Test
    fun readsAQuoteCopiedWithItsListMarkerTheWayTheListItemShows() {
        val blocks = parseRichBlocks("Two rules:\n\n- Rises add.\n1. Falls **subtract**.")

        assertEquals(listOf(listOf(marked(Text, "Rises add."))), (markRichBlocks(blocks, "- Rises add.")[1] as RichBlock.ListBlock).items)
        assertEquals(
            listOf(listOf(marked(Text, "Falls "), marked(Bold, "subtract"), marked(Text, "."))),
            (markRichBlocks(blocks, "1. Falls **subtract**.")[2] as RichBlock.ListBlock).items,
        )
    }

    @Test
    fun marksNothingWhenNoLineShowsTheQuoteOrTheQuoteCutsAMarkInTwo() {
        val blocks = parseRichBlocks("A **bold** idea.\n\n- One item")

        assertEquals(blocks, markRichBlocks(blocks, "Another idea."))
        assertEquals(blocks, markRichBlocks(blocks, "A **bold idea."))
        assertEquals(
            RichBlock.ListBlock(listOf(listOf(marked(Text, "One item"))), ordered = false),
            markRichBlocks(blocks, "One item")[1],
        )
    }
}
