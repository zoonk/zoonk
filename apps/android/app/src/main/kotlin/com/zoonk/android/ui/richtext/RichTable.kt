package com.zoonk.android.ui.richtext

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.Layout
import androidx.compose.ui.layout.Measurable
import androidx.compose.ui.semantics.CollectionInfo
import androidx.compose.ui.semantics.CollectionItemInfo
import androidx.compose.ui.semantics.collectionInfo
import androidx.compose.ui.semantics.collectionItemInfo
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Constraints
import androidx.compose.ui.unit.dp
import kotlin.math.roundToInt

private val CELL_PADDING = 8.dp
private val EDGE_PADDING = 12.dp

/**
 * A table of data in learner text with its header row (main's `RichTable`). Columns are as wide as
 * their content when that fits and share the frame's width like an HTML table; when even the
 * longest words don't fit (a phone, a large font), the table scrolls sideways inside its frame
 * instead of squeezing them. Numbers in right or centered columns line up on their digits.
 * TalkBack reads it as a table, each cell with its row and column.
 */
@Composable
internal fun RichTable(
    align: List<TableAlign?>,
    header: List<SpokenText>,
    rows: List<List<SpokenText>>,
    modifier: Modifier = Modifier,
) {
    val shape = MaterialTheme.shapes.medium
    val body = MaterialTheme.typography.bodyMedium
    val headerStyle = body.copy(fontWeight = FontWeight.SemiBold)
    val columns = align.size

    BoxWithConstraints(
        modifier
            .fillMaxWidth()
            .clip(shape)
            .border(1.dp, MaterialTheme.colorScheme.outlineVariant, shape),
    ) {
        val available = constraints.maxWidth

        Box(Modifier.horizontalScroll(rememberScrollState())) {
            TableGrid(
                available = available,
                columns = columns,
                rowCount = rows.size,
                headerBackground = { Box(Modifier.background(MaterialTheme.colorScheme.surfaceContainerHigh)) },
                dividers = { repeat(rows.size) { HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant) } },
                cells = {
                    header.forEachIndexed { column, cell ->
                        TableCell(cell, align[column], headerStyle, row = 0, column = column, columns = columns, isHeader = true)
                    }

                    rows.forEachIndexed { row, cells ->
                        cells.forEachIndexed { column, cell ->
                            TableCell(cell, align[column], body, row = row + 1, column = column, columns = columns, isHeader = false)
                        }
                    }
                },
            )
        }
    }
}

@Composable
private fun TableCell(
    cell: SpokenText,
    align: TableAlign?,
    style: TextStyle,
    row: Int,
    column: Int,
    columns: Int,
    isHeader: Boolean,
) {
    val numeric = align == TableAlign.End || align == TableAlign.Center
    val textAlign =
        when (align) {
            TableAlign.End -> TextAlign.End
            TableAlign.Center -> TextAlign.Center
            else -> TextAlign.Start
        }

    RichTextLine(
        text = cell,
        modifier =
            Modifier
                .semantics {
                    collectionItemInfo = CollectionItemInfo(rowIndex = row, rowSpan = 1, columnIndex = column, columnSpan = 1)
                    if (isHeader) heading()
                }.padding(
                    start = if (column == 0) EDGE_PADDING else CELL_PADDING,
                    end = if (column == columns - 1) EDGE_PADDING else CELL_PADDING,
                    top = CELL_PADDING,
                    bottom = CELL_PADDING,
                ),
        style = style.copy(textAlign = textAlign, fontFeatureSettings = if (numeric) "tnum" else style.fontFeatureSettings),
    )
}

/**
 * Column widths the way a browser lays out an automatic table that fills its frame: each column's
 * whole content when everything fits (spare width shared by content width), its longest word when
 * nothing would, and in between, the room above the longest words shared by how much more each
 * column wants.
 */
internal fun columnWidths(
    minimums: List<Int>,
    maximums: List<Int>,
    available: Int,
): List<Int> {
    val least = minimums.sum()
    val most = maximums.sum()

    return when {
        most <= available && most > 0 -> {
            maximums.map { it + ((available - most) * it.toFloat() / most).toInt() }
        }

        least >= available || most == least -> {
            minimums
        }

        else -> {
            val share = (available - least).toFloat() / (most - least)
            minimums.zip(maximums) { min, max -> min + ((max - min) * share).roundToInt() }
        }
    }
}

@Composable
private fun TableGrid(
    available: Int,
    columns: Int,
    rowCount: Int,
    headerBackground: @Composable () -> Unit,
    dividers: @Composable () -> Unit,
    cells: @Composable () -> Unit,
) {
    Layout(
        contents = listOf(headerBackground, dividers, cells),
        modifier = Modifier.semantics { collectionInfo = CollectionInfo(rowCount = rowCount + 1, columnCount = columns) },
    ) { (backgrounds, lines, cellMeasurables), _ ->
        val grid: List<List<Measurable>> = cellMeasurables.chunked(columns)
        val minimums = List(columns) { column -> grid.maxOf { it[column].minIntrinsicWidth(Constraints.Infinity) } }
        val maximums = List(columns) { column -> grid.maxOf { it[column].maxIntrinsicWidth(Constraints.Infinity) } }
        val widths = columnWidths(minimums, maximums, available)
        val width = widths.sum()

        val placeables = grid.map { row -> row.mapIndexed { column, cell -> cell.measure(Constraints.fixedWidth(widths[column])) } }
        val heights = placeables.map { row -> row.maxOf { it.height } }
        val rules = lines.map { it.measure(Constraints.fixedWidth(width)) }
        val background = backgrounds.first().measure(Constraints.fixed(width, heights.first()))
        val height = heights.sum() + rules.sumOf { it.height }

        layout(width, height) {
            background.placeRelative(0, 0)
            var y = 0

            placeables.forEachIndexed { row, cellsInRow ->
                if (row > 0) {
                    val rule = rules[row - 1]
                    rule.placeRelative(0, y)
                    y += rule.height
                }

                var x = 0
                cellsInRow.forEachIndexed { column, cell ->
                    cell.placeRelative(x, y)
                    x += widths[column]
                }

                y += heights[row]
            }
        }
    }
}
