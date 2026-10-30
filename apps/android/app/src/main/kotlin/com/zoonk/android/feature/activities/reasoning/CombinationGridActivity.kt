package com.zoonk.android.feature.activities.reasoning

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.listSaver
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.rememberTextMeasurer
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.feature.activities.ActivityBadge
import com.zoonk.android.feature.activities.ActivityCanvas
import com.zoonk.android.feature.activities.ActivityProps
import com.zoonk.android.feature.activities.ActivityRenderer
import com.zoonk.android.feature.activities.ActivitySelectGrid
import com.zoonk.android.feature.activities.ActivityTile
import com.zoonk.android.feature.activities.gridAnswer
import com.zoonk.android.feature.activities.gridCells
import com.zoonk.android.feature.activities.numericAnswer
import com.zoonk.android.feature.player.model.ActivityAnswer
import com.zoonk.android.feature.player.model.ActivityCheck
import com.zoonk.android.ui.theme.withTabularFigures
import com.zoonk.android.ui.theme.zoonk
import com.zoonk.api.models.PlayableLibraryStepAnyOfContent.PlayableLibraryStepAnyOfContentOneOf14Value as CombinationGridContent
import com.zoonk.api.models.PlayableLibraryStepAnyOfContentOneOfCheck.PlayableLibraryStepAnyOfContentOneOfCheckOneOf1Value as InteractionCheckValue
import com.zoonk.api.models.PlayableLibraryStepAnyOfContentOneOfCheck.PlayableLibraryStepAnyOfContentOneOfCheckOneOf2Value as NumericCheckValue
import com.zoonk.api.models.PlayableLibraryStepAnyOfContentOneOfCheck.PlayableLibraryStepAnyOfContentOneOfCheckOneOfValue as ChoiceCheckValue

val combinationGridRenderer =
    ActivityRenderer(
        badge = {
            if (CombinationGrid.of((it as CombinationGridContent).value.fields).isFillable) {
                ActivityBadge(R.string.activities_reasoning_badge_fill_square, R.drawable.ic_window)
            } else {
                ActivityBadge(R.string.activities_badge_read_chart, R.drawable.ic_show_chart)
            }
        },
        canvas = { CombinationGridActivity(it) },
    )

@Composable
private fun CombinationGridActivity(props: ActivityProps) {
    val content = (props.content as CombinationGridContent).value
    val grid = remember(content.fields) { CombinationGrid.of(content.fields) }
    val check = content.check
    val output = checkOutput(check, grid)
    val isReadOnly = !grid.isFillable
    var fill by rememberSaveable(stateSaver = FillSaver) {
        mutableStateOf(if (isReadOnly) grid.cells else initialFill(props.answer, grid.cells.size))
    }
    var activeCell by rememberSaveable { mutableStateOf(nextEmptyCell(fill, null)) }
    val editable = !props.isLocked && !isReadOnly
    val counted = if (props.isChecked) countedCells(check, output, grid.cells) else null

    fun pick(value: String) {
        val cell = activeCell ?: return
        val next = fill.mapIndexed { index, it -> if (index == cell) value else it }
        fill = next
        activeCell = nextEmptyCell(next, cell)
        if (check !is ChoiceCheckValue) props.onAnswerChange(answerFor(check, output, next))
    }

    ActivityCanvas(gap = 16.dp) {
        GridBoard(
            grid = grid,
            fill = if (props.isChecked && isReadOnly) grid.cells.map { null } else fill,
            activeCell = activeCell.takeIf { editable && !props.isChecked },
            checked = counted?.let { GridChecked(it, grid.cells) },
            onSelectCell = if (editable && !props.isChecked) ({ activeCell = it }) else null,
        )
        if (!isReadOnly || !counted.isNullOrEmpty()) {
            GridCaption(
                grid = grid,
                fill = fill,
                counted = counted?.size?.takeIf { check !is InteractionCheckValue },
                expected = if (props.isChecked && !isReadOnly) grid.cells else emptyList(),
                outputName = outputName(grid, output),
            )
        }
        if (!props.isChecked && !isReadOnly) {
            GridPalette(grid, activeCell, enabled = editable, onPick = ::pick)
        }
    }
}

private val FillSaver = listSaver<GridFill, String?>(save = { it }, restore = { it })

private fun initialFill(
    answer: ActivityAnswer?,
    size: Int,
): GridFill = answer.gridCells?.takeIf { it.size == size } ?: List(size) { null }

/** What the check counts: its `output`, or the recessive trait on a Punnett square. */
private fun checkOutput(
    check: ActivityCheck,
    grid: CombinationGrid,
): String? {
    val fallback = if (grid.isAllele) "recessive" else null
    return when (check) {
        is ChoiceCheckValue -> check.value.output ?: fallback
        is NumericCheckValue -> check.value.output ?: fallback
        else -> fallback
    }
}

/** A number check reads the share the learner's fill gives; a fill-the-square check reads the fill itself. */
private fun answerFor(
    check: ActivityCheck,
    output: String?,
    fill: GridFill,
): ActivityAnswer? =
    if (check is NumericCheckValue) {
        output?.let { fillShare(fill, it) }?.let(::numericAnswer)
    } else {
        completeFill(fill)?.let(::gridAnswer)
    }

private fun countedCells(
    check: ActivityCheck,
    output: String?,
    right: List<String>,
): Set<Int> =
    if (check is InteractionCheckValue || output == null) {
        emptySet()
    } else {
        right.indices.filter { cellMatches(right[it], output) }.toSet()
    }

private fun outputName(
    grid: CombinationGrid,
    output: String?,
): String? =
    when {
        grid.traits == null || output == null -> output
        output == "dominant" -> grid.traits.dominant
        output == "recessive" -> grid.traits.recessive
        else -> output
    }

private class GridChecked(
    val counted: Set<Int>,
    val expected: List<String>,
)

@Composable
private fun GridBoard(
    grid: CombinationGrid,
    fill: GridFill,
    activeCell: Int?,
    checked: GridChecked?,
    onSelectCell: ((Int) -> Unit)?,
) {
    val active = activeCell?.let(grid.places::getOrNull)
    val compact = grid.columns.values.size > ROOMY_COLUMNS
    val label = MaterialTheme.typography.labelMedium
    val muted = MaterialTheme.colorScheme.onSurfaceVariant
    val description = gridDescription(grid)
    val word = longestWordWidth(grid.rows.label, label)

    BoxWithConstraints(Modifier.fillMaxWidth()) {
        val base = if (compact) 48.dp else 72.dp
        val side = maxOf(base, minOf(word, maxWidth * MAX_SIDE_SHARE))
        val needed = side + (MIN_SQUARE + GAP) * grid.columns.values.size
        val scrolls = onSelectCell != null && needed > maxWidth
        Column(
            Modifier
                .then(if (scrolls) Modifier.horizontalScroll(rememberScrollState()).width(needed) else Modifier.fillMaxWidth())
                .semantics { contentDescription = description },
            verticalArrangement = Arrangement.spacedBy(GAP),
        ) {
            Row(Modifier.clearAndSetSemantics {}, horizontalArrangement = Arrangement.spacedBy(GAP)) {
                Spacer(Modifier.width(side))
                Text(grid.columns.label, Modifier.weight(1f), color = muted, textAlign = TextAlign.Center, style = label)
            }
            Row(Modifier.height(IntrinsicSize.Min).clearAndSetSemantics {}, horizontalArrangement = Arrangement.spacedBy(GAP)) {
                Box(Modifier.width(side).fillMaxHeight().padding(bottom = 4.dp), contentAlignment = Alignment.BottomCenter) {
                    Text(grid.rows.label, color = muted, textAlign = TextAlign.Center, style = label)
                }
                grid.columns.values.forEachIndexed { index, value ->
                    GridHeader(value, grid.isAllele, lit = active?.columnIndex == index, Modifier.weight(1f))
                }
            }
            grid.rows.values.forEachIndexed { rowIndex, row ->
                Row(Modifier.height(IntrinsicSize.Min), horizontalArrangement = Arrangement.spacedBy(GAP)) {
                    GridHeader(row, grid.isAllele, lit = active?.rowIndex == rowIndex, Modifier.width(side).clearAndSetSemantics {})
                    grid.places.withIndex().filter { it.value.rowIndex == rowIndex }.forEach { (index, place) ->
                        if (checked != null || onSelectCell == null) {
                            CheckedCell(
                                expected = checked?.expected?.getOrNull(index) ?: fill[index].orEmpty(),
                                learner = if (checked != null) fill[index] else null,
                                counted = checked?.counted?.contains(index) == true,
                                grid = grid,
                                compact = compact,
                            )
                        } else {
                            CellButton(
                                number = index + 1,
                                place = place,
                                value = fill[index],
                                active = activeCell == index,
                                grid = grid,
                                compact = compact,
                                onClick = { onSelectCell(index) },
                            )
                        }
                    }
                }
            }
        }
    }
}

/** The row label wraps between words, never inside one, at any font size. */
@Composable
private fun longestWordWidth(
    text: String,
    style: TextStyle,
): Dp {
    val measurer = rememberTextMeasurer()
    val density = LocalDensity.current
    return remember(text, style, density) {
        with(density) { text.split(" ").maxOf { measurer.measure(it, style).size.width }.toDp() }
    }
}

@Composable
private fun gridDescription(grid: CombinationGrid): String {
    val rows = grid.rows
    val columns = grid.columns
    return when (grid.rule) {
        GridRule.Alleles -> {
            stringResource(
                R.string.activities_reasoning_grid_punnett,
                grid.title,
                rows.label,
                rows.values.joinToString(""),
                columns.label,
                columns.values.joinToString(""),
            )
        }

        GridRule.Sum -> {
            stringResource(
                R.string.activities_reasoning_grid_sums,
                grid.title,
                rows.label,
                rows.values.joinToString(", "),
                columns.label,
                columns.values.joinToString(", "),
            )
        }

        GridRule.Product -> {
            stringResource(
                R.string.activities_reasoning_grid_products,
                grid.title,
                rows.label,
                rows.values.joinToString(", "),
                columns.label,
                columns.values.joinToString(", "),
            )
        }
    }
}

@Composable
private fun GridHeader(
    value: String,
    isAllele: Boolean,
    lit: Boolean,
    modifier: Modifier = Modifier,
) {
    val accent = MaterialTheme.zoonk.vizAccent
    val shape = RoundedCornerShape(CORNER)
    Box(
        modifier
            .fillMaxHeight()
            .heightIn(min = 48.dp)
            .clip(shape)
            .background(if (lit) accent.copy(alpha = SOFT) else MaterialTheme.colorScheme.surface)
            .border(if (lit) BorderStroke(2.dp, accent) else BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant), shape),
        contentAlignment = Alignment.Center,
    ) {
        CellValue(value, isAllele, MaterialTheme.typography.titleLarge)
    }
}

@Composable
private fun RowScope.CellButton(
    number: Int,
    place: GridCell,
    value: String?,
    active: Boolean,
    grid: CombinationGrid,
    compact: Boolean,
    onClick: () -> Unit,
) {
    val colors = MaterialTheme.colorScheme
    val accent = MaterialTheme.zoonk.vizAccent
    val description =
        if (value == null) {
            stringResource(R.string.activities_reasoning_grid_square_empty, number, place.row, place.column)
        } else {
            stringResource(R.string.activities_reasoning_grid_square, number, place.row, place.column, cellWords(value, grid.traits))
        }

    Column(
        Modifier
            .weight(1f)
            .fillMaxHeight()
            .heightIn(min = if (compact) 48.dp else ROOMY_HEIGHT)
            .drawBehind {
                val corner = CORNER.toPx()
                if (active) {
                    val ring = RING.toPx()
                    drawRoundRect(
                        accent.copy(alpha = RING_ALPHA),
                        topLeft = Offset(-ring, -ring),
                        size = Size(size.width + 2 * ring, size.height + 2 * ring),
                        cornerRadius = CornerRadius(corner + ring),
                    )
                }
                drawRoundRect(colors.surface, cornerRadius = CornerRadius(corner))
                val line = if (active) 2.dp.toPx() else 1.dp.toPx()
                drawRoundRect(
                    if (active) accent else colors.outline,
                    topLeft = Offset(line / 2, line / 2),
                    size = Size(size.width - line, size.height - line),
                    cornerRadius = CornerRadius(corner - line / 2),
                    style =
                        Stroke(
                            line,
                            pathEffect =
                                if (value == null &&
                                    !active
                                ) {
                                    PathEffect.dashPathEffect(floatArrayOf(DASH.toPx(), DASH.toPx()))
                                } else {
                                    null
                                },
                        ),
                )
            }.clip(RoundedCornerShape(CORNER))
            .selectable(selected = active, role = Role.Button, onClick = onClick)
            .clearAndSetSemantics { contentDescription = description }
            .padding(4.dp),
        verticalArrangement = Arrangement.spacedBy(2.dp, Alignment.CenterVertically),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        if (value != null) {
            CellValue(value, grid.isAllele, cellStyle(compact))
            grid.traits?.let { Trait(value, it) }
        }
    }
}

@Composable
private fun RowScope.CheckedCell(
    expected: String,
    learner: String?,
    counted: Boolean,
    grid: CombinationGrid,
    compact: Boolean,
) {
    val colors = MaterialTheme.colorScheme
    val wrong = learner != null && !sameCell(learner, expected)
    val shape = RoundedCornerShape(CORNER)
    val border =
        when {
            wrong -> colors.error.copy(alpha = MARK_ALPHA)
            learner != null -> colors.tertiary.copy(alpha = MARK_ALPHA)
            else -> colors.outlineVariant
        }
    val fill =
        when {
            counted -> MaterialTheme.zoonk.vizHighlight.copy(alpha = SOFT)
            wrong -> colors.errorContainer.copy(alpha = WRONG_ALPHA)
            else -> colors.surface
        }
    val words = cellWords(expected, grid.traits)
    val description = if (wrong) stringResource(R.string.activities_reasoning_grid_your_answer, words, learner) else words

    Column(
        Modifier
            .weight(1f)
            .fillMaxHeight()
            .heightIn(min = if (compact) 44.dp else ROOMY_HEIGHT)
            .clip(shape)
            .background(fill)
            .border(1.dp, border, shape)
            .clearAndSetSemantics { contentDescription = description }
            .padding(horizontal = 4.dp, vertical = if (compact) 4.dp else 8.dp),
        verticalArrangement = Arrangement.spacedBy(2.dp, Alignment.CenterVertically),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        CellValue(expected, grid.isAllele, cellStyle(compact))
        grid.traits?.let { Trait(expected, it) }
        if (wrong) {
            Text(
                learner,
                color = colors.error,
                style = MaterialTheme.typography.labelSmall.copy(textDecoration = TextDecoration.LineThrough),
            )
        }
    }
}

@Composable
private fun cellStyle(compact: Boolean): TextStyle =
    if (compact) MaterialTheme.typography.bodyMedium else MaterialTheme.typography.titleMedium

@Composable
private fun cellWords(
    value: String,
    traits: GridTraits?,
): String =
    if (traits == null) {
        value
    } else {
        stringResource(
            R.string.activities_reasoning_grid_value_trait,
            value,
            if (isDominantPhenotype(value)) traits.dominant else traits.recessive,
        )
    }

/** Main's `CellValue`: a genotype's dominant allele in the accent color, so its uppercase letter stands out. */
@Composable
private fun CellValue(
    value: String,
    isAllele: Boolean,
    style: TextStyle,
) {
    val accent = MaterialTheme.zoonk.vizAccent
    val text =
        remember(value, isAllele, accent) {
            buildAnnotatedString {
                value.forEach { letter ->
                    if (isAllele && letter.isUpperCase()) withStyle(SpanStyle(color = accent)) { append(letter) } else append(letter)
                }
            }
        }
    Text(text, style = style.copy(fontWeight = FontWeight.SemiBold).withTabularFigures(), textAlign = TextAlign.Center)
}

@Composable
private fun Trait(
    value: String,
    traits: GridTraits,
) {
    val dominant = isDominantPhenotype(value)
    val accent = MaterialTheme.zoonk.vizAccent
    val muted = MaterialTheme.colorScheme.onSurfaceVariant
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
        Box(
            Modifier
                .size(8.dp)
                .clip(CircleShape)
                .then(if (dominant) Modifier.background(accent) else Modifier.border(1.dp, muted, CircleShape)),
        )
        Text(if (dominant) traits.dominant else traits.recessive, color = muted, style = MaterialTheme.typography.labelSmall)
    }
}

/** Main's `GridCaption`: how far the fill has come, the right squares once checked, or what the check counted. */
@Composable
private fun GridCaption(
    grid: CombinationGrid,
    fill: GridFill,
    counted: Int?,
    expected: List<String>,
    outputName: String?,
) {
    val total = fill.size
    val text =
        when {
            counted != null && outputName != null -> {
                pluralStringResource(R.plurals.activities_reasoning_grid_counted, total, counted, total, outputName)
            }

            expected.isNotEmpty() -> {
                val right = fill.indices.count { fill[it]?.let { cell -> sameCell(cell, expected[it]) } == true }
                pluralStringResource(R.plurals.activities_reasoning_grid_right, total, right, total)
            }

            grid.traits == null -> {
                pluralStringResource(R.plurals.activities_reasoning_grid_filled, total, fill.count { it != null }, total)
            }

            else -> {
                val counts = traitCounts(fill)
                stringResource(
                    R.string.activities_reasoning_grid_traits,
                    grid.traits.dominant,
                    counts.dominant,
                    grid.traits.recessive,
                    counts.recessive,
                    total,
                )
            }
        }

    Text(
        text,
        modifier = Modifier.fillMaxWidth().semantics { liveRegion = LiveRegionMode.Polite },
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        textAlign = TextAlign.Center,
        style = MaterialTheme.typography.bodyMedium.withTabularFigures(),
    )
}

@Composable
private fun GridPalette(
    grid: CombinationGrid,
    activeCell: Int?,
    enabled: Boolean,
    onPick: (String) -> Unit,
) {
    val question =
        when {
            activeCell == null -> stringResource(R.string.activities_reasoning_grid_all_filled)
            grid.isAllele -> stringResource(R.string.activities_reasoning_grid_which_genotype, activeCell + 1)
            else -> stringResource(R.string.activities_reasoning_grid_what_goes, activeCell + 1)
        }

    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text(question, style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.Medium))
        ActivitySelectGrid(grid.options, label = question, columns = if (grid.isAllele) 3 else 4) { option ->
            ActivityTile(
                picked = false,
                result = null,
                onClick = { onPick(option) },
                modifier = Modifier.heightIn(min = 56.dp).alpha(if (activeCell == null) DISABLED_ALPHA else 1f),
                enabled = enabled && activeCell != null,
                role = Role.Button,
            ) {
                Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(2.dp)) {
                    CellValue(option, grid.isAllele, MaterialTheme.typography.bodyLarge)
                    grid.traits?.let { Trait(option, it) }
                }
            }
        }
    }
}

private const val ROOMY_COLUMNS = 3
private const val MAX_SIDE_SHARE = 0.3f
private val MIN_SQUARE: Dp = 48.dp
private val ROOMY_HEIGHT: Dp = 72.dp
private val GAP = 8.dp
private val CORNER = 12.dp
private val RING = 4.dp
private val DASH = 4.dp
private const val RING_ALPHA = 0.25f
private const val MARK_ALPHA = 0.6f
private const val WRONG_ALPHA = 0.4f
private const val SOFT = 0.16f
private const val DISABLED_ALPHA = 0.6f
