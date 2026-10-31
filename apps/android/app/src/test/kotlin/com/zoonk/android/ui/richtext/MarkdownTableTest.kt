package com.zoonk.android.ui.richtext

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class MarkdownTableTest {
    private val lines =
        listOf(
            "Ofícios recebidos:",
            "| Mês | Recebidos |",
            "| --- | ---: |",
            "| Maio | 40 |",
            "| Junho | 30 | 9 |",
            "",
            "Qual mês teve menos?",
        )

    @Test
    fun readsATablesHeaderAlignmentAndRowsPaddingOrDroppingCellsLikeGfm() {
        assertEquals(
            TableRead(
                table =
                    MarkdownTable(
                        align = listOf(null, TableAlign.End),
                        header = listOf("Mês", "Recebidos"),
                        rows = listOf(listOf("Maio", "40"), listOf("Junho", "30")),
                    ),
                end = 5,
            ),
            readMarkdownTable(lines, 1),
        )

        assertNull(readMarkdownTable(lines, 0))
    }

    @Test
    fun findsNoTableInProseWithAStrayPipe() {
        assertNull(readMarkdownTable(listOf("Escolha A | B."), 0))
    }

    @Test
    fun readsEscapedPipesInsideCellsAndOptionalEdgePipes() {
        assertEquals(
            MarkdownTable(
                align = listOf(TableAlign.Start, TableAlign.Center),
                header = listOf("Rule", "Means"),
                rows = listOf(listOf("a | b", "either"), listOf("x", "")),
            ),
            readMarkdownTable(listOf("Rule | Means", ":--- | :---:", "a \\| b | either", "x |"), 0)?.table,
        )
    }
}
