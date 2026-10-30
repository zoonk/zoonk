package com.zoonk.android.feature.activities.math

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.text.TextMeasurer
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.drawText
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.rememberTextMeasurer
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.feature.activities.ActivityBadge
import com.zoonk.android.feature.activities.ActivityCanvas
import com.zoonk.android.feature.activities.ActivityPlaceHandle
import com.zoonk.android.feature.activities.ActivityProps
import com.zoonk.android.feature.activities.ActivityReadout
import com.zoonk.android.feature.activities.ActivityRenderer
import com.zoonk.android.feature.activities.PlaceOrientation
import com.zoonk.android.ui.components.LinearScale
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.formatAmount
import com.zoonk.android.ui.theme.withTabularFigures
import com.zoonk.android.ui.theme.zoonk
import com.zoonk.api.models.PlayableLibraryStepAnyOfContent.PlayableLibraryStepAnyOfContentOneOf2Value as AreaModelContent
import com.zoonk.api.models.PlayableLibraryStepAnyOfContentOneOf2Fields.PlayableLibraryStepAnyOfContentOneOf2FieldsOneOf1Value as BarFields
import com.zoonk.api.models.PlayableLibraryStepAnyOfContentOneOf2Fields.PlayableLibraryStepAnyOfContentOneOf2FieldsOneOfValue as GridFields
import com.zoonk.api.models.PlayableLibraryStepAnyOfContentOneOfCheck.PlayableLibraryStepAnyOfContentOneOfCheckOneOf2Value as NumericCheckValue

val areaModelRenderer =
    ActivityRenderer(
        badge = { ActivityBadge(R.string.activities_math_badge_split_it, R.drawable.ic_window) },
        canvas = { AreaModelActivity(it) },
    )

/** The splits only explore: the frame's check asks for the answer, and a numeric one hides the total until it's checked. */
@Composable
private fun AreaModelActivity(props: ActivityProps) {
    val content = (props.content as AreaModelContent).value
    val (isArea, given, fieldUnit) =
        when (val fields = content.fields) {
            is GridFields -> Triple(true, listOf(fields.value.width, fields.value.height), fields.value.unit)
            is BarFields -> Triple(false, listOf(fields.value.bar), fields.value.unit)
        }
    val locale = currentLocale()
    val starting = given.map { sideCuts(it.parts, it.total) }
    var cuts by rememberSaveable { mutableStateOf(starting.map { it.cuts }) }
    val sides = starting.zip(cuts) { side, sideCuts -> side.copy(cuts = sideCuts) }
    val values = pieces(sides.map { cutsToParts(it.cuts, it.total) })
    val total = values.sum()
    val hidesTotal = content.check is NumericCheckValue && !props.isChecked
    val unit = fieldUnit?.let { if (isArea) "$it²" else it }
    val format = { value: Double -> formatAmount(value, locale) }
    val totalText = formatAmount(total, locale, unit)
    val description =
        listOfNotNull(
            pluralStringResource(R.plurals.activities_math_area_parts, values.size, values.size, values.joinToString(", ") { format(it) }),
            if (hidesTotal) null else stringResource(R.string.activities_math_area_total, totalText),
        ).joinToString(" ")
    val onCut = { index: Int, next: List<Double> -> cuts = cuts.toMutableList().also { it[index] = next } }

    ActivityCanvas(description = description) {
        if (isArea) {
            AreaGrid(sides[0], sides[1], disabled = props.isLocked, format = format, onCut = onCut)
        } else {
            BarModel(sides[0], disabled = props.isLocked, format = format, onCut = onCut)
        }
        ActivityReadout(
            "${values.joinToString(" + ") { format(it) }} = ${if (hidesTotal) "?" else totalText}",
            Modifier.clearAndSetSemantics {},
        )
    }
}

@Composable
private fun AreaGrid(
    width: SideCuts,
    height: SideCuts,
    disabled: Boolean,
    format: (Double) -> String,
    onCut: (Int, List<Double>) -> Unit,
) {
    val density = LocalDensity.current
    val measurer = rememberTextMeasurer()
    val edgeStyle =
        MaterialTheme.typography.bodyMedium
            .withTabularFigures()
            .copy(fontWeight = FontWeight.SemiBold)
    val ink = MaterialTheme.colorScheme.onSurface
    val accent = MaterialTheme.zoonk.vizAccent
    val tones = listOf(accent.copy(alpha = SOFT), accent.copy(alpha = MEDIUM), accent.copy(alpha = STRONG))
    val widths = cutsToParts(width.cuts, width.total)
    val heights = cutsToParts(height.cuts, height.total)
    val edgeHeight = measurer.measure("0", edgeStyle).size.height
    val leftLabels = heights.maxOf { measurer.measure(format(it), edgeStyle).size.width }
    val gap = with(density) { EDGE_GAP.toPx() }
    val top = edgeHeight + gap + with(density) { PILL_LONG.toPx() / 2 }
    val left = leftLabels + gap + with(density) { PILL_SHORT.toPx() }
    val bottom = with(density) { GRID_BOTTOM.toPx() }
    val right = with(density) { GRID_RIGHT.toPx() }
    val cellStyles =
        listOf(MaterialTheme.typography.headlineSmall, MaterialTheme.typography.bodyLarge, MaterialTheme.typography.labelMedium)

    BoxWithConstraints(Modifier.fillMaxWidth()) {
        val drawnWidth = constraints.maxWidth - left - right
        val drawnHeight =
            (drawnWidth * height.total / width.total).toFloat().coerceIn(
                with(density) { MIN_GRID.toPx() },
                with(density) { MAX_GRID.toPx() },
            )
        val x = LinearScale(0.0..width.total, left to left + drawnWidth)
        val y = LinearScale(height.total..0.0, top + drawnHeight to top)

        Box(Modifier.fillMaxWidth().height(with(density) { (top + drawnHeight + bottom).toDp() })) {
            Canvas(Modifier.matchParentSize().clearAndSetSemantics {}) {
                val columns = (listOf(0.0) + width.cuts + width.total).map { x.toPixel(it) }
                val rows = (listOf(0.0) + height.cuts + height.total).map { y.toPixel(it) }
                val cellGap = CELL_GAP.toPx()
                heights.forEachIndexed { row, rowPart ->
                    widths.forEachIndexed { column, columnPart ->
                        val cell = Size(columns[column + 1] - columns[column] - cellGap, rows[row + 1] - rows[row] - cellGap)
                        val corner = Offset(columns[column] + cellGap / 2, rows[row] + cellGap / 2)
                        drawRoundRect(
                            tones[(row + column) % tones.size],
                            corner,
                            Size(maxOf(cell.width, 1f), maxOf(cell.height, 1f)),
                            CornerRadius(CELL_RADIUS.toPx()),
                        )
                        if (minOf(cell.width, cell.height) >= MIN_LABEL_CELL.toPx()) {
                            val style = cellStyle(cellStyles, minOf(cell.width, cell.height))
                            centered(
                                measurer,
                                format(columnPart * rowPart),
                                style.withTabularFigures().copy(fontWeight = FontWeight.SemiBold, color = ink),
                                corner + Offset(cell.width / 2, cell.height / 2),
                            )
                        }
                    }
                }
                widths.forEachIndexed { index, part ->
                    val label = measurer.measure(format(part), edgeStyle.copy(color = ink))
                    val middle = (columns[index] + columns[index + 1]) / 2
                    drawText(label, topLeft = Offset(middle - label.size.width / 2, top - gap - PILL_LONG.toPx() / 2 - label.size.height))
                }
                heights.forEachIndexed { index, part ->
                    val label = measurer.measure(format(part), edgeStyle.copy(color = ink))
                    val middle = (rows[index] + rows[index + 1]) / 2
                    drawText(label, topLeft = Offset(left - gap - PILL_SHORT.toPx() - label.size.width, middle - label.size.height / 2))
                }
            }
            width.cuts.forEachIndexed { index, cut ->
                CutHandle(width, index, Offset(x.toPixel(cut), top), x, PlaceOrientation.Horizontal, disabled, format) { onCut(0, it) }
            }
            height.cuts.forEachIndexed { index, cut ->
                CutHandle(height, index, Offset(left, y.toPixel(cut)), y, PlaceOrientation.Vertical, disabled, format) { onCut(1, it) }
            }
        }
    }
}

@Composable
private fun BarModel(
    bar: SideCuts,
    disabled: Boolean,
    format: (Double) -> String,
    onCut: (Int, List<Double>) -> Unit,
) {
    val density = LocalDensity.current
    val measurer = rememberTextMeasurer()
    val labelStyle =
        MaterialTheme.typography.bodyMedium
            .withTabularFigures()
            .copy(fontWeight = FontWeight.SemiBold)
    val ink = MaterialTheme.colorScheme.onSurface
    val muted = MaterialTheme.colorScheme.onSurfaceVariant
    val tones =
        listOf(MaterialTheme.zoonk.vizAccent, MaterialTheme.zoonk.vizHighlight, MaterialTheme.zoonk.vizSecondary).map {
            it.copy(alpha = SOFT)
        }
    val labelHeight = measurer.measure("0", labelStyle).size.height
    val top = labelHeight + with(density) { (BRACKET_GAP + BRACKET_TICK).toPx() }
    val thickness = with(density) { BAR_THICKNESS.toPx() }
    val parts = cutsToParts(bar.cuts, bar.total)

    BoxWithConstraints(Modifier.fillMaxWidth().height(with(density) { (top + thickness + BAR_BOTTOM.toPx()).toDp() })) {
        val side = with(density) { BAR_SIDE.toPx() }
        val x = LinearScale(0.0..bar.total, side to constraints.maxWidth - side)

        Canvas(Modifier.matchParentSize().clearAndSetSemantics {}) {
            val (left, right) = x.range
            val bracketY = top - BRACKET_GAP.toPx()
            val tick = BRACKET_TICK.toPx()
            drawPath(
                Path().apply {
                    moveTo(left, bracketY + tick)
                    lineTo(left, bracketY)
                    lineTo(right, bracketY)
                    lineTo(right, bracketY + tick)
                },
                muted,
                style = Stroke(BRACKET_WIDTH.toPx()),
            )
            val totalLabel = measurer.measure(format(bar.total), labelStyle.copy(color = ink))
            drawText(
                totalLabel,
                topLeft =
                    Offset(
                        (left + right - totalLabel.size.width) / 2,
                        bracketY - tick - totalLabel.size.height + tick,
                    ),
            )
            val edges = (listOf(0.0) + bar.cuts + bar.total).map { x.toPixel(it) }
            val partGap = CELL_GAP.toPx()
            parts.forEachIndexed { index, part ->
                val (start, end) = edges[index] to edges[index + 1]
                drawRoundRect(
                    tones[index % tones.size],
                    Offset(start + partGap / 2, top),
                    Size(maxOf(end - start - partGap, 1f), thickness),
                    CornerRadius(BAR_RADIUS.toPx()),
                )
                if (end - start >=
                    MIN_BAR_LABEL.toPx()
                ) {
                    centered(
                        measurer,
                        format(part),
                        labelStyle.copy(color = ink),
                        Offset(
                            (start + end) / 2,
                            top + thickness / 2,
                        ),
                    )
                }
            }
        }
        bar.cuts.forEachIndexed { index, cut ->
            CutHandle(
                bar,
                index,
                Offset(x.toPixel(cut), top + thickness / 2),
                x,
                PlaceOrientation.Horizontal,
                disabled,
                format,
            ) { onCut(0, it) }
        }
    }
}

@Composable
private fun CutHandle(
    side: SideCuts,
    index: Int,
    center: Offset,
    scale: LinearScale,
    orientation: PlaceOrientation,
    disabled: Boolean,
    format: (Double) -> String,
    onCut: (List<Double>) -> Unit,
) {
    val across = orientation == PlaceOrientation.Horizontal
    ActivityPlaceHandle(
        center = center,
        scale = scale,
        range = cutRange(side, index),
        value = side.cuts[index],
        label = stringResource(if (across) R.string.activities_math_area_split_width else R.string.activities_math_area_split_height),
        valueText = cutsToParts(side.cuts, side.total).joinToString(" + ") { format(it) },
        onChange = { onCut(moveCut(side, index, it)) },
        orientation = orientation,
        disabled = disabled,
    ) {
        Surface(
            modifier =
                Modifier
                    .size(
                        if (across) PILL_SHORT else PILL_LONG,
                        if (across) PILL_LONG else PILL_SHORT,
                    ).alpha(if (disabled) 0f else 1f),
            shape = RoundedCornerShape(PILL_SHORT / 2),
            color = MaterialTheme.colorScheme.surface,
            border = BorderStroke(1.dp, MaterialTheme.colorScheme.onSurfaceVariant),
        ) {}
    }
}

/** Main's cell text: big in big cells, small in small ones. */
private fun DrawScope.cellStyle(
    styles: List<TextStyle>,
    size: Float,
): TextStyle =
    when {
        size >= BIG_CELL.toPx() -> styles[0]
        size >= MEDIUM_CELL.toPx() -> styles[1]
        else -> styles[2]
    }

private fun DrawScope.centered(
    measurer: TextMeasurer,
    text: String,
    style: TextStyle,
    center: Offset,
) {
    val label = measurer.measure(text, style)
    drawText(label, topLeft = center - Offset(label.size.width / 2f, label.size.height / 2f))
}

private const val SOFT = 0.18f
private const val MEDIUM = 0.25f
private const val STRONG = 0.4f
private val EDGE_GAP = 10.dp
private val PILL_LONG = 26.dp
private val PILL_SHORT = 12.dp
private val GRID_BOTTOM = 4.dp
private val GRID_RIGHT = 8.dp
private val MIN_GRID = 140.dp
private val MAX_GRID = 260.dp
private val CELL_GAP = 2.dp
private val CELL_RADIUS = 6.dp
private val MIN_LABEL_CELL = 20.dp
private val BIG_CELL = 64.dp
private val MEDIUM_CELL = 36.dp
private val BRACKET_GAP = 12.dp
private val BRACKET_TICK = 6.dp
private val BRACKET_WIDTH = 1.5.dp
private val BAR_THICKNESS = 48.dp
private val BAR_SIDE = 8.dp
private val BAR_BOTTOM = 8.dp
private val BAR_RADIUS = 8.dp
private val MIN_BAR_LABEL = 28.dp
