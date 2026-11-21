package com.zoonk.android.ui.components

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedCard
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalResources
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextLayoutResult
import androidx.compose.ui.text.drawText
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.rememberTextMeasurer
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.toSize
import com.zoonk.android.R
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.formatAmount
import com.zoonk.android.ui.theme.withTabularFigures
import com.zoonk.android.ui.theme.zoonk
import java.util.Locale
import kotlin.math.abs
import kotlin.math.max
import kotlin.math.min

/** Main's `PlotVisualView`: numbers on both axes, each point where its values put it. */
@Composable
internal fun PlotVisual(
    visual: LessonVisual.Plot,
    modifier: Modifier,
) {
    val locale = currentLocale()
    val density = LocalDensity.current
    val measurer = rememberTextMeasurer()
    val labelStyle =
        MaterialTheme.typography.bodySmall
            .withTabularFigures()
            .copy(color = MaterialTheme.colorScheme.onSurfaceVariant)
    val nameStyle = labelStyle.copy(color = MaterialTheme.colorScheme.onSurface, fontWeight = FontWeight.Medium)
    val marks = seriesMarks(visual.series.size)
    val surface = CardDefaults.outlinedCardColors().containerColor
    val grid = MaterialTheme.zoonk.vizGrid
    val rule = MaterialTheme.colorScheme.onSurfaceVariant
    val reading = plotReading(visual, locale)

    OutlinedCard(modifier.fillMaxWidth()) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Text(text = visual.title, style = MaterialTheme.typography.titleSmall)
            if (visual.series.size > 1) PlotLegend(visual, marks, surface)

            BoxWithConstraints(Modifier.fillMaxWidth()) {
                val width = constraints.maxWidth.toFloat()
                val layout =
                    remember(visual, width, labelStyle, nameStyle, density, locale) {
                        PlotGeometry(visual, width, ChartText(measurer, labelStyle, nameStyle, density, locale))
                    }

                Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    // The ranges are read first, before the points they place.
                    AxisCaption(axisTitle(visual.yLabel, visual.yUnit), TextAlign.Start, reading.axes)
                    Box {
                        Canvas(Modifier.fillMaxWidth().height(with(density) { layout.height.toDp() })) {
                            drawPlot(layout, marks, surface, grid, rule)
                        }
                        Column(Modifier.matchParentSize()) {
                            reading.parts.forEach { part ->
                                Box(Modifier.fillMaxWidth().weight(1f).semantics { contentDescription = part })
                            }
                        }
                    }
                    AxisCaption(axisTitle(visual.xLabel, visual.xUnit), TextAlign.Center)
                    if (layout.key.isNotEmpty()) PointKey(layout.key, Modifier.padding(top = 8.dp))
                }
            }

            visual.source?.let {
                Text(
                    text = stringResource(R.string.visual_source, it),
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    style = MaterialTheme.typography.bodySmall,
                )
            }
        }
    }
}

private fun axisTitle(
    label: String,
    unit: String?,
) = if (unit.isNullOrEmpty()) label else "$label ($unit)"

/** Large numbers shorten to "12K"; others keep every digit, and x drops grouping so years don't read as "2,024". */
private fun isLarge(values: List<Double>) = values.maxOfOrNull { abs(it) }?.let { it >= COMPACT_FROM } == true

/** Main's `drawsDot`: a dotted series draws every point; a bare line draws its shape once, at its end, beside others. */
internal fun drawsDot(
    mark: LessonVisual.Plot.Mark,
    index: Int,
    pointCount: Int,
    seriesCount: Int,
) = mark != LessonVisual.Plot.Mark.Line || (seriesCount > 1 && index == pointCount - 1)

@Composable
private fun PlotLegend(
    visual: LessonVisual.Plot,
    marks: List<SeriesMark>,
    surface: Color,
) {
    FlowRow(
        modifier = Modifier.clearAndSetSemantics {},
        horizontalArrangement = Arrangement.spacedBy(16.dp),
        verticalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        visual.series.forEachIndexed { index, series ->
            val mark = marks[index]
            val dotted = series.mark == LessonVisual.Plot.Mark.Points
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                Box(
                    Modifier.size(width = if (dotted) 10.dp else 16.dp, height = 10.dp).drawBehind {
                        if (!dotted) {
                            drawPath(
                                Path().apply {
                                    moveTo(0f, center.y)
                                    lineTo(size.width, center.y)
                                },
                                mark.color,
                                style = seriesLine(mark),
                            )
                        }
                        drawSeriesPoint(mark, center, surface)
                    },
                )
                Text(text = series.name, style = MaterialTheme.typography.bodySmall)
            }
        }
    }
}

/** The numbers that stand for names that didn't fit beside their dots, each with its name. */
@Composable
private fun PointKey(
    key: List<KeyEntry>,
    modifier: Modifier,
) {
    Column(modifier.clearAndSetSemantics {}, verticalArrangement = Arrangement.spacedBy(4.dp)) {
        key.forEach { entry ->
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(
                    text = entry.marker,
                    modifier = Modifier.width(16.dp),
                    style = MaterialTheme.typography.bodySmall.withTabularFigures(),
                    fontWeight = FontWeight.Medium,
                    textAlign = TextAlign.End,
                )
                Text(text = entry.label, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodySmall)
            }
        }
    }
}

/** What TalkBack reads for the drawing: the ranges, then each series' points with named ones on their own, then the reference lines. */
private class PlotReading(
    val axes: String,
    val parts: List<String>,
)

@Composable
private fun plotReading(
    visual: LessonVisual.Plot,
    locale: Locale,
): PlotReading {
    val resources = LocalResources.current

    return remember(visual, locale, resources) {
        val (x, y) = plotAxes(visual)
        val groupX = isLarge(visual.series.flatMap { series -> series.points.map { it.x } })
        val xValue = { value: Double -> formatAmount(value, locale, visual.xUnit, grouping = groupX) }
        val yValue = { value: Double -> formatAmount(value, locale, visual.yUnit) }
        val point = { shown: LessonVisual.Plot.Point ->
            resources.getString(R.string.visual_plot_point, visual.xLabel, xValue(shown.x), visual.yLabel, yValue(shown.y))
        }
        val named = { name: String, text: String -> resources.getString(R.string.visual_chart_point, name, text) }

        val series =
            visual.series.flatMap { series ->
                val inSeries = { text: String -> if (visual.series.size > 1) named(series.name, text) else text }
                val unnamed = series.points.filter { it.label == null }
                val plain = unnamed.takeIf { it.isNotEmpty() }?.joinToString("; ", transform = point)
                listOfNotNull(plain?.let(inSeries)) +
                    series.points.mapNotNull { it.label?.let { label -> inSeries(named(label, point(it))) } }
            }
        val references =
            visual.references.takeIf { it.isNotEmpty() }?.let { lines ->
                resources.getString(R.string.visual_plot_references, lines.joinToString("; ") { named(it.label, yValue(it.y)) })
            }

        PlotReading(
            axes =
                listOf(
                    resources.getString(
                        R.string.visual_plot_horizontal_axis,
                        visual.xLabel,
                        xValue(x.domain.start),
                        xValue(x.domain.endInclusive),
                    ),
                    resources.getString(
                        R.string.visual_plot_vertical_axis,
                        visual.yLabel,
                        yValue(y.domain.start),
                        yValue(y.domain.endInclusive),
                    ),
                ).joinToString(". "),
            parts = series + listOfNotNull(references),
        )
    }
}

private class PlotTick(
    val value: Double,
    val label: TextLayoutResult,
)

private class ReferenceMark(
    val y: Float,
    val label: TextLayoutResult,
    val top: Float,
)

private class PlacedName(
    val label: PointLabel,
    val text: TextLayoutResult,
)

/** Main's `getPlotLayout`, in pixels: the plot's box, its scales and where every tick, line and name goes. */
private class PlotGeometry(
    val visual: LessonVisual.Plot,
    width: Float,
    text: ChartText,
) {
    val gap = with(text.density) { CHART_LABEL_GAP.toPx() }
    private val unit = with(text.density) { 1.dp.toPx() }
    private val axes = plotAxes(visual)
    private val points = visual.series.flatMap { it.points }
    private val compactX = isLarge(points.map { it.x })
    private val compactY = isLarge(points.map { it.y } + visual.references.map { it.y })

    private val lineHeight =
        text
            .label("0")
            .size.height
            .toFloat()
    private val top = lineHeight + gap

    // Grows with the font, so a large font's axis labels don't crowd each other.
    val bottom = top + max(with(text.density) { CHART_PLOT_HEIGHT.toPx() }, lineHeight * CHART_PLOT_LINES)
    val ticksTop = bottom + max(gap, lineHeight / 2)
    val height = ticksTop + lineHeight

    val yTicks = axes.second.ticks.map { PlotTick(it, text.label(formatAmount(it, text.locale, compact = compactY))) }
    val left = (yTicks.maxOfOrNull { it.label.size.width } ?: 0) + gap

    /** Reference names sit past the plot's right edge, so they never cover the data. */
    private val room =
        visual.references
            .maxOfOrNull {
                text
                    .label(it.label)
                    .size.width
                    .toFloat()
            }?.let { min(it, width * MAX_GUTTER_SHARE) } ?: 0f
    val plotRight = max(width - if (room > 0) room + gap else with(text.density) { CHART_PLOT_END.toPx() }, left + 1)

    val x = LinearScale(axes.first.domain, left to plotRight)
    val y = LinearScale(axes.second.domain, bottom to top)

    val series = visual.series.map { series -> series.points.map { Offset(x.toPixel(it.x), y.toPixel(it.y)) } }

    val references =
        stackReferences(visual.references.map { reference -> y.toPixel(reference.y) to text.wrappedLabel(reference.label, room) })

    private val labeled =
        pointLabels(
            named =
                visual.series.flatMapIndexed { seriesIndex, entry ->
                    entry.points.mapIndexedNotNull { index, point -> point.label?.let { series[seriesIndex][index] to it } }
                },
            scene =
                LabelScene(
                    bounds = Rect(left, 0f, if (room > 0) plotRight else width, bottom),
                    dots =
                        series.flatMapIndexed { seriesIndex, pixels ->
                            pixels.filterIndexed { index, _ -> drawsDot(visual.series[seriesIndex].mark, index, pixels.size, series.size) }
                        },
                    segments = segments(),
                ),
            size = { text.value(it).size.toSize() },
            unit = unit,
        )

    val key = labeled.key
    val names = labeled.labels.map { PlacedName(it, text.value(it.text)) }

    val xTicks: List<Pair<Float, TextLayoutResult>> =
        axes.first.ticks
            .map { tick ->
                val label = text.label(formatAmount(tick, text.locale, compact = compactX, grouping = compactX))
                val half = label.size.width / 2f
                x.toPixel(tick).coerceIn(half, max(width - half, half)) to label
            }.let { ticks ->
                val kept =
                    fittingTickIndices(
                        ticks.map { (center, label) ->
                            center - label.size.width / 2f to
                                center + label.size.width / 2f
                        },
                        unit * 4,
                    )
                ticks.filterIndexed { index, _ -> index in kept }
            }

    private fun segments(): List<Pair<Offset, Offset>> {
        val lines =
            series.flatMapIndexed { index, pixels ->
                if (visual.series[index].mark == LessonVisual.Plot.Mark.Points) emptyList() else pixels.zipWithNext()
            }
        return lines + references.map { Offset(left, it.y) to Offset(plotRight, it.y) }
    }

    /** Stacks names top to bottom so close lines don't overlap, then lifts them back inside the chart. */
    private fun stackReferences(marks: List<Pair<Float, TextLayoutResult>>): List<ReferenceMark> {
        val spacing = REFERENCE_SPACING * unit
        val stacked =
            marks.sortedBy { it.first }.fold(emptyList<ReferenceMark>()) { placed, (lineY, label) ->
                val floor = placed.lastOrNull()?.let { it.top + it.label.size.height + spacing } ?: 0f
                placed + ReferenceMark(lineY, label, max(lineY - label.size.height / 2f, floor))
            }
        val overflow = stacked.lastOrNull()?.let { it.top + it.label.size.height - height } ?: 0f
        return if (overflow > 0) stacked.map { ReferenceMark(it.y, it.label, it.top - overflow) } else stacked
    }
}

private fun DrawScope.drawPlot(
    layout: PlotGeometry,
    marks: List<SeriesMark>,
    surface: Color,
    grid: Color,
    rule: Color,
) {
    val stroke = 1.dp.toPx()

    layout.yTicks.forEach { tick ->
        val y = layout.y.toPixel(tick.value)
        drawLine(grid, Offset(layout.left, y), Offset(layout.plotRight, y), strokeWidth = stroke)
        drawText(tick.label, topLeft = Offset(layout.left - layout.gap - tick.label.size.width, y - tick.label.size.height / 2f))
    }

    val dash = PathEffect.dashPathEffect(floatArrayOf(REFERENCE_DASH.toPx(), REFERENCE_DASH.toPx()))
    layout.references.forEach { reference ->
        drawLine(rule, Offset(layout.left, reference.y), Offset(layout.plotRight, reference.y), strokeWidth = stroke, pathEffect = dash)
        drawText(reference.label, topLeft = Offset(layout.plotRight + layout.gap, reference.top))
    }

    layout.series.forEachIndexed { seriesIndex, pixels ->
        val mark = marks[seriesIndex]
        val kind = layout.visual.series[seriesIndex].mark
        if (kind != LessonVisual.Plot.Mark.Points && pixels.size > 1) {
            val path =
                Path().apply {
                    moveTo(pixels.first().x, pixels.first().y)
                    pixels.drop(1).forEach { lineTo(it.x, it.y) }
                }
            drawPath(path, mark.color, style = seriesLine(mark))
        }
        pixels.forEachIndexed { index, point ->
            if (drawsDot(kind, index, pixels.size, layout.series.size)) drawSeriesPoint(mark, point, surface)
        }
    }

    layout.names.forEach { name ->
        val box = boxOf(name.label, name.text.size.toSize())
        drawText(name.text, topLeft = Offset(box.left, box.top))
    }

    layout.xTicks.forEach { (center, label) ->
        drawText(label, topLeft = Offset(center - label.size.width / 2f, layout.ticksTop))
    }
}

private const val COMPACT_FROM = 10_000
private const val MAX_GUTTER_SHARE = 0.3f
private const val REFERENCE_SPACING = 2
private val REFERENCE_DASH = 4.dp
