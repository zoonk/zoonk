package com.zoonk.android.feature.activities.reasoning

import com.zoonk.api.models.PlayableLibraryStepAnyOfContentOneOf14Fields
import java.math.BigDecimal
import kotlin.math.abs
import kotlin.math.max
import com.zoonk.api.models.PlayableLibraryStepAnyOfContentOneOf14Fields.PlayableLibraryStepAnyOfContentOneOf14FieldsOneOf1Value as SumFields
import com.zoonk.api.models.PlayableLibraryStepAnyOfContentOneOf14Fields.PlayableLibraryStepAnyOfContentOneOf14FieldsOneOf2Value as ProductFields
import com.zoonk.api.models.PlayableLibraryStepAnyOfContentOneOf14Fields.PlayableLibraryStepAnyOfContentOneOf14FieldsOneOfValue as AlleleFields

internal enum class GridRule { Alleles, Sum, Product }

internal data class GridSide(
    val label: String,
    val values: List<String>,
)

internal data class GridTraits(
    val dominant: String,
    val recessive: String,
)

internal data class GridCell(
    val row: String,
    val rowIndex: Int,
    val column: String,
    val columnIndex: Int,
)

/** Core's `combination-grid` template and main's `grid-model`: a grid whose every cell combines its row and its column. */
internal data class CombinationGrid(
    val rule: GridRule,
    val title: String,
    val rows: GridSide,
    val columns: GridSide,
    val traits: GridTraits? = null,
) {
    val isAllele: Boolean get() = rule == GridRule.Alleles

    val places: List<GridCell> =
        rows.values.flatMapIndexed { rowIndex, row ->
            columns.values.mapIndexed { columnIndex, column -> GridCell(row, rowIndex, column, columnIndex) }
        }

    val cells: List<String> = places.map { combine(it.row, it.column) }

    /** Past this many cells, filling every one by hand is busywork: the grid is shown filled, to read. */
    val isFillable: Boolean get() = cells.size <= MAX_FILLED_CELLS

    val options: List<String>
        get() =
            if (isAllele) {
                val letter = rows.values.firstOrNull().orEmpty()
                val (dominant, recessive) = letter.uppercase() to letter.lowercase()
                listOf(dominant + dominant, genotype(dominant, recessive), recessive + recessive)
            } else {
                cells.distinct().sortedBy { it.toDouble() }
            }

    private fun combine(
        row: String,
        column: String,
    ): String =
        when (rule) {
            GridRule.Alleles -> genotype(row, column)
            GridRule.Sum -> jsNumberText(row.toDouble() + column.toDouble())
            GridRule.Product -> jsNumberText(row.toDouble() * column.toDouble())
        }

    companion object {
        fun of(fields: PlayableLibraryStepAnyOfContentOneOf14Fields): CombinationGrid =
            when (fields) {
                is AlleleFields -> {
                    with(fields.value) {
                        CombinationGrid(
                            GridRule.Alleles,
                            title,
                            GridSide(rows.label, rows.propertyValues),
                            GridSide(columns.label, columns.propertyValues),
                            GridTraits(traits.dominant, traits.recessive),
                        )
                    }
                }

                is SumFields -> {
                    with(fields.value) {
                        CombinationGrid(
                            GridRule.Sum,
                            title,
                            numberSide(rows.label, rows.propertyValues),
                            numberSide(columns.label, columns.propertyValues),
                        )
                    }
                }

                is ProductFields -> {
                    with(fields.value) {
                        CombinationGrid(
                            GridRule.Product,
                            title,
                            numberSide(rows.label, rows.propertyValues),
                            numberSide(columns.label, columns.propertyValues),
                        )
                    }
                }
            }

        private fun numberSide(
            label: String,
            values: List<Double>,
        ) = GridSide(label, values.map(::jsNumberText))
    }
}

internal typealias GridFill = List<String?>

internal fun genotype(
    first: String,
    second: String,
): String = listOf(first, second).sorted().joinToString("")

internal fun isDominantPhenotype(cell: String): Boolean = cell != cell.lowercase()

/** Whether a cell counts toward a check's `output`: "dominant", "recessive", a genotype like "Pp", or a value like "7". */
internal fun cellMatches(
    cell: String,
    output: String,
): Boolean {
    if (output == "dominant") return isDominantPhenotype(cell)
    if (output == "recessive") return !isDominantPhenotype(cell)
    if (GENOTYPE.matches(output)) return cell == genotype(output.substring(0, 1), output.substring(1))
    val number = output.toDoubleOrNull()?.takeIf { it.isFinite() } ?: return false
    val value = cell.toDoubleOrNull() ?: return false
    return abs(value - number) <= FLOAT_SLACK * max(1.0, abs(number))
}

/** Genotypes in either order are the same cell; numbers are the same as written. */
internal fun sameCell(
    first: String,
    second: String,
): Boolean =
    if (GENOTYPE.matches(first) && GENOTYPE.matches(second)) {
        genotype(first.substring(0, 1), first.substring(1)) == genotype(second.substring(0, 1), second.substring(1))
    } else {
        first.trim() == second.trim()
    }

/** The next empty cell after [after], wrapping around, or null when every cell is filled. */
internal fun nextEmptyCell(
    fill: GridFill,
    after: Int?,
): Int? {
    val start = after?.plus(1) ?: 0
    return fill.indices.map { (start + it) % fill.size }.firstOrNull { fill[it] == null }
}

internal fun completeFill(fill: GridFill): List<String>? = fill.filterNotNull().takeIf { it.size == fill.size }

/** The share of the learner's cells that count toward [output], once every cell is filled. */
internal fun fillShare(
    fill: GridFill,
    output: String,
): Double? {
    val cells = completeFill(fill)?.takeIf { it.isNotEmpty() } ?: return null
    return cells.count { cellMatches(it, output) }.toDouble() / cells.size
}

internal data class TraitCounts(
    val dominant: Int,
    val recessive: Int,
)

internal fun traitCounts(fill: GridFill): TraitCounts {
    val cells = fill.filterNotNull()
    val dominant = cells.count { cellMatches(it, "dominant") }
    return TraitCounts(dominant, cells.size - dominant)
}

/**
 * A number as JavaScript's `String(number)` writes it, which is how core writes a cell: its shortest
 * digits ("7", "2.5", "0.30000000000000004"), in exponent form below 1e-6 or from 1e21 ("1e+21").
 */
internal fun jsNumberText(value: Double): String {
    if (value.isNaN()) return "NaN"
    if (value.isInfinite()) return if (value > 0) "Infinity" else "-Infinity"
    if (value == 0.0) return "0"
    val shortest = BigDecimal(value.toString()).stripTrailingZeros()
    if (abs(value) in JS_PLAIN_RANGE) return shortest.toPlainString()
    val digits = shortest.unscaledValue().abs().toString()
    val exponent = digits.length - 1 - shortest.scale()
    val mantissa = if (digits.length == 1) digits else "${digits[0]}.${digits.substring(1)}"
    return "${if (value < 0) "-" else ""}${mantissa}e${if (exponent < 0) "-" else "+"}${abs(exponent)}"
}

private val JS_PLAIN_RANGE = 1e-6..<1e21
private val GENOTYPE = Regex("^[A-Za-z]{2}$")
private const val MAX_FILLED_CELLS = 9
private const val FLOAT_SLACK = 1e-9
