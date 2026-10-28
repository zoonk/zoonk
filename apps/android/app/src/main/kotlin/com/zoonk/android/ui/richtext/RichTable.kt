package com.zoonk.android.ui.richtext

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.focusable
import androidx.compose.foundation.gestures.scrollBy
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.input.key.KeyEvent
import androidx.compose.ui.input.key.KeyEventType
import androidx.compose.ui.input.key.key
import androidx.compose.ui.input.key.onKeyEvent
import androidx.compose.ui.input.key.type
import androidx.compose.ui.layout.Layout
import androidx.compose.ui.layout.Measurable
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalLayoutDirection
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
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import com.zoonk.android.ui.theme.withTabularFigures
import kotlinx.coroutines.launch
import kotlin.math.roundToInt

private val CELL_PADDING = 8.dp
private val EDGE_PADDING = 12.dp
private val FOCUS_RING = 2.dp
private val KEY_STEP = 48.dp

/** Compose scrolls with touch and the mouse wheel but not arrow keys. */
private fun arrowStep(
    event: KeyEvent,
    rtl: Boolean,
): Int {
    if (event.type != KeyEventType.KeyDown) return 0
    val step =
        when (event.key) {
            Key.DirectionRight -> 1
            Key.DirectionLeft -> -1
            else -> 0
        }
    return if (rtl) -step else step
}

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
    val scroll = rememberScrollState()
    var focused by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()
    val rtl = LocalLayoutDirection.current == LayoutDirection.Rtl
    val stepPx = with(LocalDensity.current) { KEY_STEP.toPx() }

    BoxWithConstraints(
        modifier
            .fillMaxWidth()
            .clip(shape)
            .border(
                if (focused) FOCUS_RING else 1.dp,
                if (focused) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.outlineVariant,
                shape,
            ),
    ) {
        val available = constraints.maxWidth

        Box(
            Modifier
                .horizontalScroll(scroll)
                .onFocusChanged { focused = it.isFocused }
                .onKeyEvent { event ->
                    val step = arrowStep(event, rtl)
                    if (step != 0) scope.launch { scroll.scrollBy(step * stepPx) }
                    step != 0
                }.focusable(enabled = scroll.maxValue > 0),
        ) {
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
        style = style.copy(textAlign = textAlign).let { if (numeric) it.withTabularFigures() else it },
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
