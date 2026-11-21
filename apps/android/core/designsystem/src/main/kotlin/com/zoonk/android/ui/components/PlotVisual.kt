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
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Fill
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.scale
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalResources
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextLayoutResult
import androidx.compose.ui.text.TextMeasurer
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.drawText
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.rememberTextMeasurer
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextDirection
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.formatAmount
import com.zoonk.android.ui.theme.withTabularFigures
import com.zoonk.android.ui.theme.zoonk
import java.util.Locale
import kotlin.math.max

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
    // How much larger than 12 the reader's text size draws a 12 sp label.
    val textScale = with(density) { labelStyle.fontSize.toPx() } / (labelStyle.fontSize.value * density.density)

    ChartCard(visual.title, visual.source, modifier) {
        if (visual.series.size > 1) PlotLegend(visual, marks, surface)

        BoxWithConstraints(Modifier.fillMaxWidth()) {
            val boxWidth = constraints.maxWidth / density.density
            val drawing =
                remember(visual, boxWidth, textScale, labelStyle, nameStyle, density, locale) {
                    val text = PlotText(label = unitWidth(measurer, labelStyle), name = unitWidth(measurer, nameStyle))
                    val scale = plotTextScale(visual, boxWidth, textScale, text, locale)
                    PlotDrawing(
                        PlotGeometry(visual, boxWidth / scale, text, locale),
                        scale,
                        density.density,
                        measurer,
                        labelStyle,
                        nameStyle,
                    )
                }

            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                // TalkBack reads the ranges before the points they place.
                AxisCaption(placeChartUnit(visual.yUnit, visual.yLabel).label, reading.axes)
                Box {
                    Canvas(Modifier.fillMaxWidth().height(with(density) { (PLOT_HEIGHT * drawing.scale * density.density).toDp() })) {
                        drawPlot(drawing, marks, surface, grid, rule)
                    }
                    Column(Modifier.matchParentSize()) {
                        reading.parts.forEach { part ->
                            Box(Modifier.fillMaxWidth().weight(1f).semantics { contentDescription = part })
                        }
                    }
                }
                AxisCaption(placeChartUnit(visual.xUnit, visual.xLabel).label)
                if (drawing.layout.key.isNotEmpty()) PointKey(drawing.layout.key, Modifier.padding(top = 8.dp))
            }
        }
    }
}

/** A label's width in layout units: drawn at 12 units, whatever the reader's text size. */
private fun unitWidth(
    measurer: TextMeasurer,
    style: TextStyle,
): (String) -> Float =
    { text ->
        measurer
            .measure(text, style.copy(textDirection = TextDirection.Content), density = UNIT_DENSITY, layoutDirection = LayoutDirection.Ltr)
            .multiParagraph.maxIntrinsicWidth
    }

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

/**
 * The layout's text measured for drawing at 12 units, [unit] pixels to a layout unit; the whole drawing, its text,
 * lines and points, then grows by [scale], as main's drawing does.
 */
private class PlotDrawing(
    val layout: PlotGeometry,
    val scale: Float,
    val unit: Float,
    measurer: TextMeasurer,
    labelStyle: TextStyle,
    nameStyle: TextStyle,
) {
    private val density = Density(unit, 1f)
    private val label = { text: String -> measure(measurer, text, labelStyle) }

    val yTicks = layout.yTicks.map { it to label(it.label) }
    val references = layout.references.map { reference -> reference to reference.lines.map(label) }
    val names = layout.labels.map { it to measure(measurer, it.text, nameStyle) }
    val xTicks = layout.xTicks.map { it to label(it.label) }

    private fun measure(
        measurer: TextMeasurer,
        text: String,
        style: TextStyle,
    ) = measurer.measure(text, style.copy(textDirection = TextDirection.Content), density = density, layoutDirection = LayoutDirection.Ltr)
}

private fun DrawScope.drawPlot(
    drawing: PlotDrawing,
    marks: List<SeriesMark>,
    surface: Color,
    grid: Color,
    rule: Color,
) {
    scale(drawing.scale, pivot = Offset.Zero) { drawLayout(drawing, marks, surface, grid, rule) }
}

private fun DrawScope.drawLayout(
    drawing: PlotDrawing,
    marks: List<SeriesMark>,
    surface: Color,
    grid: Color,
    rule: Color,
) {
    val layout = drawing.layout
    val unit = drawing.unit
    val at = { x: Float, y: Float -> Offset(x * unit, y * unit) }
    val stroke = 1.dp.toPx()
    val middle = { text: TextLayoutResult, x: Float, y: Float -> Offset(x, y * unit - text.size.height / 2f) }

    drawing.yTicks.forEach { (tick, label) ->
        val y = layout.y.toPixel(tick.value)
        if (tick.line) drawLine(grid, at(layout.left, y), at(layout.plotRight, y), strokeWidth = stroke)
        drawText(label, topLeft = middle(label, (layout.left - PLOT_LABEL_GAP) * unit - label.size.width, y))
    }

    val dash = PathEffect.dashPathEffect(floatArrayOf(REFERENCE_DASH.toPx(), REFERENCE_DASH.toPx()))
    drawing.references.forEach { (reference, lines) ->
        drawLine(rule, at(layout.left, reference.y), at(layout.plotRight, reference.y), strokeWidth = stroke, pathEffect = dash)
        lines.forEachIndexed { index, line ->
            drawText(line, topLeft = middle(line, reference.x * unit, reference.top + PLOT_LINE_HEIGHT * (index + 0.5f)))
        }
    }

    layout.series.forEachIndexed { seriesIndex, points ->
        val mark = marks[seriesIndex]
        val kind = layout.visual.series[seriesIndex].mark
        val pixels = points.map { at(it.x, it.y) }
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

    // A halo in the card's color keeps a name readable where it crosses a line.
    val halo = Stroke(width = HALO_WIDTH.toPx(), join = StrokeJoin.Round)
    drawing.names.forEach { (label, text) ->
        val width = text.size.width.toFloat()
        val start =
            when (label.anchor) {
                LabelAnchor.Start -> label.x * unit
                LabelAnchor.End -> label.x * unit - width
                LabelAnchor.Middle -> label.x * unit - width / 2
            }
        val topLeft = middle(text, start, label.y)
        drawText(text, color = surface, topLeft = topLeft, drawStyle = halo)
        drawText(text, topLeft = topLeft, drawStyle = Fill)
    }

    drawing.xTicks.forEach { (tick, label) ->
        drawText(label, topLeft = Offset(tick.center * unit - label.size.width / 2f, layout.xTickY * unit - label.firstBaseline))
    }
}

/**
 * Where an axis label centered on [center] starts, kept [inset] past the y axis's numbers at [left]
 * and inside [width], so the corner where the two axes meet never crowds.
 */
internal fun axisLabelStart(
    center: Float,
    labelWidth: Float,
    left: Float,
    width: Float,
    inset: Float,
): Float {
    val start = left + inset
    return (center - labelWidth / 2).coerceIn(start, max(width - inset - labelWidth, start))
}

private val UNIT_DENSITY = Density(1f, 1f)
private val HALO_WIDTH = 3.dp
private val REFERENCE_DASH = 4.dp
