package com.zoonk.android.feature.activities.reasoning

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/** Main's `grid-model.test.ts`, and cells as core's `combinationGrid` template writes them. */
class CombinationGridModelTest {
    private val punnett =
        CombinationGrid(
            GridRule.Alleles,
            "Flower color",
            rows = GridSide("Purple parent", listOf("P", "p")),
            columns = GridSide("White parent", listOf("p", "p")),
            traits = GridTraits("Purple", "White"),
        )

    private val dice =
        CombinationGrid(GridRule.Sum, "Two dice", GridSide("First die", listOf("1", "2")), GridSide("Second die", listOf("1", "2")))

    @Test
    fun pairsEachRowValueWithEachColumnValueRowByRow() {
        assertEquals(listOf("Pp", "Pp", "pp", "pp"), punnett.places.map { it.row + it.column })
        assertEquals(listOf(0 to 0, 0 to 1, 1 to 0, 1 to 1), dice.places.map { it.rowIndex to it.columnIndex })
    }

    @Test
    fun writesCellsAsCoreDoes() {
        val sums = CombinationGrid(GridRule.Sum, "t", GridSide("a", listOf("0.2", "1")), GridSide("b", listOf("0.1", "2.5", "-3")))
        val products =
            CombinationGrid(
                GridRule.Product,
                "t",
                GridSide("a", listOf("3", "-0.5")),
                GridSide("b", listOf("0.1", "1.5", "40000000000000000000")),
            )
        val round = punnett.copy(rows = GridSide("r", listOf("R", "r")), columns = GridSide("c", listOf("r", "R")))

        assertEquals(listOf("0.30000000000000004", "2.7", "-2.8", "1.1", "3.5", "-2"), sums.cells)
        assertEquals(
            listOf("0.30000000000000004", "4.5", "120000000000000000000", "-0.05", "-0.75", "-20000000000000000000"),
            products.cells,
        )
        assertEquals(listOf("Rr", "RR", "rr", "Rr"), round.cells)
    }

    @Test
    fun offersTheGenotypesDominantFirstAndEachNumberOnceSmallestFirst() {
        assertEquals(listOf("PP", "Pp", "pp"), punnett.options)
        assertEquals(listOf("RR", "Rr", "rr"), punnett.copy(rows = GridSide("Round parent", listOf("r", "R"))).options)
        assertEquals(listOf("2", "3", "4"), dice.options)
        val squares = CombinationGrid(GridRule.Product, "t", GridSide("a", listOf("2", "3")), GridSide("b", listOf("2", "3", "4")))
        assertEquals(listOf("4", "6", "8", "9", "12"), squares.options)
    }

    @Test
    fun readsAGenotypeInEitherOrderAndANumberAsWritten() {
        assertTrue(sameCell("pP", "Pp"))
        assertFalse(sameCell("PP", "Pp"))
        assertTrue(sameCell("7", " 7 "))
        assertFalse(sameCell("7", "8"))
    }

    @Test
    fun movesToTheNextEmptyCellWrappingAroundAndStopsOnAFullGrid() {
        assertEquals(0, nextEmptyCell(listOf(null, null, null, null), null))
        assertEquals(3, nextEmptyCell(listOf("Pp", null, "pp", null), 1))
        assertEquals(0, nextEmptyCell(listOf(null, "Pp", "pp", "pp"), 3))
        assertNull(nextEmptyCell(listOf("Pp", "Pp", "pp", "pp"), 0))
    }

    @Test
    fun countsTheCellsACheckReadsOnceTheGridIsFull() {
        val fill = listOf("Pp", "Pp", "pp", "pp")
        assertEquals(0.5, fillShare(fill, "recessive"))
        assertEquals(0.5, fillShare(fill, "dominant"))
        assertEquals(0.5, fillShare(fill, "pP"))
        assertEquals(0.5, fillShare(listOf("2", "3", "3", "4"), "3"))
        assertNull(fillShare(listOf("Pp", null, "pp", "pp"), "recessive"))
        assertEquals(0.25, fillShare(listOf("PP", "PP", "PP", "pp"), "recessive"))
    }

    @Test
    fun countsTheTraitsAmongFilledCells() {
        assertEquals(TraitCounts(dominant = 2, recessive = 1), traitCounts(listOf("Pp", "PP", "pp", null)))
        assertNull(completeFill(listOf("Pp", null)))
        assertEquals(listOf("Pp", "pp"), completeFill(listOf("Pp", "pp")))
    }

    @Test
    fun showsAGridOfMoreThanNineCellsFilled() {
        val sixBySix = GridSide("die", (1..6).map { "$it" })
        assertFalse(CombinationGrid(GridRule.Sum, "Two dice", sixBySix, sixBySix).isFillable)
        assertTrue(
            CombinationGrid(GridRule.Product, "t", GridSide("a", listOf("1", "2", "3")), GridSide("b", listOf("1", "2", "3"))).isFillable,
        )
    }
}
