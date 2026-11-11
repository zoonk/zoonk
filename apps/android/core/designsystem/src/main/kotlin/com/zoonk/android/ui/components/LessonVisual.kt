package com.zoonk.android.ui.components

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedCard
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalResources
import androidx.compose.ui.res.stringResource
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
import androidx.compose.ui.unit.Constraints
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.formatAmount
import com.zoonk.android.ui.format.moneyUnit
import com.zoonk.android.ui.theme.withTabularFigures
import com.zoonk.android.ui.theme.zoonk
import kotlinx.serialization.ExperimentalSerializationApi
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonClassDiscriminator
import java.util.Locale
import kotlin.math.abs
import kotlin.math.ceil
import kotlin.math.max
import kotlin.math.min

@Composable
fun LessonVisual(
    visual: LessonVisual,
    modifier: Modifier = Modifier,
) {
    when (visual) {
        is LessonVisual.Chart -> ChartVisual(visual, modifier)
        is LessonVisual.Timeline -> TimelineVisual(visual, modifier)
    }
}

@Composable
private fun ChartVisual(
    visual: LessonVisual.Chart,
    modifier: Modifier,
) {
    OutlinedCard(modifier.fillMaxWidth()) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Text(text = visual.title, style = MaterialTheme.typography.titleSmall)
            if (visual.series.size > 1) Legend(visual.series)
            Plot(visual)
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

/**
 * Core's `placeChartUnit`: a unit past its target is shown once beside the value label, not after every number,
 * except that money keeps its currency on each number.
 */
private val LessonVisual.Chart.numberUnit: String?
    get() = unit?.let { if (it.length <= UNIT_TARGET) it else moneyUnit(it)?.currency }

private val LessonVisual.Chart.unitLabel: String
    get() = unit?.takeIf { it.length > UNIT_TARGET }?.let { "$valueLabel (${moneyUnit(it)?.rest ?: it})" } ?: valueLabel

@Composable
private fun Legend(series: List<LessonVisual.Chart.Series>) {
    val tones = seriesTones()

    FlowRow(
        modifier = Modifier.clearAndSetSemantics {},
        horizontalArrangement = Arrangement.spacedBy(16.dp),
        verticalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        series.forEachIndexed { index, entry ->
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                val tone = tones[index % tones.size]
                Box(Modifier.size(10.dp).drawBehind { drawRoundRect(tone, cornerRadius = CornerRadius(2.dp.toPx())) })
                Text(text = entry.name, style = MaterialTheme.typography.bodySmall)
            }
        }
    }
}

@Composable
private fun seriesTones(): List<Color> = MaterialTheme.zoonk.let { listOf(it.vizAccent, it.vizSecondary, it.vizHighlight) }

@Composable
private fun Plot(visual: LessonVisual.Chart) {
    val locale = currentLocale()
    val density = LocalDensity.current
    val measurer = rememberTextMeasurer()
    val labelStyle =
        MaterialTheme.typography.bodySmall
            .withTabularFigures()
            .copy(color = MaterialTheme.colorScheme.onSurfaceVariant)
    val valueStyle = labelStyle.copy(color = MaterialTheme.colorScheme.onSurface, fontWeight = FontWeight.Medium)
    val grid = MaterialTheme.zoonk.vizGrid
    val tones = seriesTones()
    val summary = chartSummary(visual, locale)

    BoxWithConstraints(Modifier.fillMaxWidth()) {
        val width = constraints.maxWidth.toFloat()
        val layout =
            remember(visual, width, labelStyle, valueStyle, density, locale) {
                plotLayout(visual, width, ChartText(measurer, labelStyle, valueStyle, density, locale))
            }
        val sideways = layout is SidewaysLayout

        Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
            AxisCaption(if (sideways) visual.categoryLabel else visual.unitLabel, TextAlign.Start)
            if (layout != null) {
                Canvas(
                    Modifier
                        .fillMaxWidth()
                        .height(with(density) { layout.height.toDp() })
                        .semantics { contentDescription = summary },
                ) {
                    when (layout) {
                        is UprightLayout -> {
                            drawGrid(layout, grid)
                            if (visual.chart == LessonVisual.Chart.Kind.Bar) drawBars(layout, tones) else drawLines(layout, tones)
                            drawCategories(layout)
                        }

                        is SidewaysLayout -> {
                            drawSideways(layout, grid, tones)
                        }
                    }
                }
            }
            AxisCaption(if (sideways) visual.unitLabel else visual.categoryLabel, TextAlign.Center)
        }
    }
}

@Composable
private fun AxisCaption(
    text: String,
    align: TextAlign,
) {
    Text(
        text = text,
        modifier = Modifier.fillMaxWidth().clearAndSetSemantics {},
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        style = MaterialTheme.typography.bodySmall,
        textAlign = align,
    )
}

/** What TalkBack reads in place of the drawing: every value, as main's hidden table gives it. */
@Composable
private fun chartSummary(
    visual: LessonVisual.Chart,
    locale: Locale,
): String {
    val resources = LocalResources.current

    return remember(visual, locale, resources) {
        val rows =
            visual.categories.mapIndexed { index, category ->
                val values =
                    visual.series.joinToString(", ") { series ->
                        val value = formatAmount(series.values.getOrElse(index) { 0.0 }, locale, visual.unit)
                        if (visual.series.size > 1) resources.getString(R.string.visual_chart_series_value, series.name, value) else value
                    }
                resources.getString(R.string.visual_chart_point, category, values)
            }
        resources.getString(R.string.visual_chart_summary, visual.valueLabel, visual.categoryLabel, rows.joinToString("; "))
    }
}

private class ChartText(
    private val measurer: TextMeasurer,
    private val label: TextStyle,
    private val value: TextStyle,
    val density: Density,
    val locale: Locale,
) {
    fun label(text: String): TextLayoutResult = measure(text, label)

    fun value(text: String): TextLayoutResult = measure(text, value)

    fun wrappedLabel(
        text: String,
        width: Float,
    ): TextLayoutResult = measure(text, label.copy(textAlign = TextAlign.Left), Constraints(maxWidth = width.toInt()))

    // The plot reads left to right in every language, as main's does; each label keeps its own direction.
    private fun measure(
        text: String,
        style: TextStyle,
        constraints: Constraints = Constraints(),
    ) = measurer.measure(
        text,
        style.copy(textDirection = TextDirection.Content),
        constraints = constraints,
        density = density,
        layoutDirection = LayoutDirection.Ltr,
    )
}

private sealed interface PlotLayout {
    val height: Float
}

private fun plotLayout(
    visual: LessonVisual.Chart,
    width: Float,
    text: ChartText,
): PlotLayout? {
    if (visual.categories.isEmpty() || visual.series.isEmpty()) return null

    val axis = ValueAxis(visual, text)
    val gap = with(text.density) { LABEL_GAP.toPx() }
    val left = (axis.ticks.maxOfOrNull { it.second.size.width } ?: 0) + gap
    val right = width - with(text.density) { PLOT_END.toPx() }
    val band = max(right - left, 1f) / visual.categories.size
    val labelWidth = { line: String -> text.label(line).size.width + gap }

    val categoryLines =
        if (visual.chart == LessonVisual.Chart.Kind.Bar) {
            uprightBarLabels(band, visual.categories, labelWidth)?.let { CategoryLabels(it, 1) }
        } else {
            categoryLabels(band, visual.categories, labelWidth)
        }

    return categoryLines?.let { UprightLayout(visual, text, axis, left, right, it) } ?: SidewaysLayout(visual, width, text, axis)
}

private class ValueAxis(
    visual: LessonVisual.Chart,
    text: ChartText,
) {
    private val values = visual.series.flatMap { it.values }
    private val wholeNumbers = values.all { it == Math.floor(it) }

    val domain =
        niceDomain(visual.axisStart?.let { values + it } ?: values, includeZero = visual.chart == LessonVisual.Chart.Kind.Bar).let { nice ->
            visual.axisStart?.let { it..nice.endInclusive } ?: nice
        }

    /** Where bars start: zero, or a cropped axis's start. */
    val origin = max(domain.start, 0.0)

    val ticks =
        niceTicks(domain).filter { !wholeNumbers || it == Math.floor(it) }.map {
            it to text.label(formatAmount(it, text.locale, visual.numberUnit, compact = true))
        }

    val valueLabels = visual.series.map { series -> series.values.map { text.value(formatAmount(it, text.locale, visual.numberUnit)) } }
}

private class UprightLayout(
    val visual: LessonVisual.Chart,
    text: ChartText,
    axis: ValueAxis,
    val left: Float,
    val right: Float,
    val categoryLines: CategoryLabels,
) : PlotLayout {
    private val gap = with(text.density) { LABEL_GAP.toPx() }
    val ticks = axis.ticks
    val band = max(right - left, 1f) / visual.categories.size

    private val lineHeight =
        text
            .label("0")
            .size.height
            .toFloat()
    val top = lineHeight + gap

    // Grows with the font, so a large font's axis labels don't crowd each other.
    private val plotHeight = max(with(text.density) { PLOT_HEIGHT.toPx() }, lineHeight * PLOT_LINES)
    val bottom = top + plotHeight

    val categoryLayouts = categoryLines.lines.map { lines -> lines.map(text::label) }

    /** Below the lowest axis label, which is centered on the plot's bottom line. */
    val categoriesTop = bottom + max(gap, lineHeight / 2)

    override val height = categoriesTop + lineHeight * (categoryLines.lines.maxOfOrNull { it.size } ?: 1)

    val y = LinearScale(axis.domain, bottom to top)
    val origin = axis.origin

    val group = band * GROUP_SHARE
    val barWidth = group / visual.series.size

    val valueLabels: List<List<TextLayoutResult>>? =
        axis.valueLabels.takeIf { labels ->
            val room = if (visual.chart == LessonVisual.Chart.Kind.Bar) barWidth + gap else band
            (visual.chart == LessonVisual.Chart.Kind.Bar || visual.series.size == 1) && labels.flatten().all { it.size.width <= room }
        }

    fun center(index: Int): Float = left + band * index + band / 2
}

/** Bars on their side, each full name above its category's bars, for names that don't fit under upright bars. */
private class SidewaysLayout(
    val visual: LessonVisual.Chart,
    val width: Float,
    text: ChartText,
    axis: ValueAxis,
) : PlotLayout {
    private val gap = with(text.density) { LABEL_GAP.toPx() }
    private val barGap = with(text.density) { SIDEWAYS_BAR_GAP.toPx() }
    val names = visual.categories.map { text.wrappedLabel(it, width) }

    val valueLabels: List<List<TextLayoutResult>>? =
        axis.valueLabels.takeIf { labels -> (labels.flatten().maxOfOrNull { it.size.width } ?: 0) + gap <= width * VALUE_SHARE }

    // Grows with the font, so a large font's value labels beside neighboring bars don't overlap.
    val thickness = max(with(text.density) { SIDEWAYS_BAR.toPx() }, (valueLabels?.flatten()?.maxOf { it.size.height } ?: 0) - barGap)

    val origin = axis.origin
    val x = LinearScale(axis.domain, valueRoom(axis))

    private val nameGap = with(text.density) { SIDEWAYS_NAME_GAP.toPx() }
    private val rowGap = with(text.density) { SIDEWAYS_ROW_GAP.toPx() }
    private val barsHeight = thickness * visual.series.size + barGap * (visual.series.size - 1)

    val barTops =
        names
            .runningFold(0f) { top, name -> top + name.size.height + nameGap + barsHeight + rowGap }
            .zip(names) { top, name -> top + name.size.height + nameGap }

    val plotBottom = barTops.last() + barsHeight

    val ticks =
        axis.ticks.map { (tick, label) ->
            val at = x.toPixel(tick)
            SidewaysTick(at, (at - label.size.width / 2f).coerceIn(0f, max(width - label.size.width, 0f)), label)
        }

    /** Every tick keeps its gridline, but only every [tickStep]th is labeled, so a large font's labels don't touch. */
    val tickStep =
        (1..max(ticks.size, 1)).first { step ->
            ticks
                .filterIndexed { index, _ -> index % step == 0 }
                .zipWithNext { a, b ->
                    b.labelLeft >=
                        a.labelLeft + a.label.size.width + gap
                }.all { it }
        }

    val ticksTop = plotBottom + gap

    override val height = ticksTop + (axis.ticks.maxOfOrNull { it.second.size.height } ?: 0)

    /**
     * The value scale's pixel range, narrowed so every value label fits past its bar's end: on the left by the widest
     * label of a bar running left, on the right just enough for the label that would reach farthest.
     */
    private fun valueRoom(axis: ValueAxis): Pair<Float, Float> {
        val labels = valueLabels ?: return 0f to width
        val ends =
            visual.series.flatMapIndexed {
                series,
                entry,
                ->
                entry.values.mapIndexed { index, value -> value to labels[series][index] }
            }
        val start = ends.filter { (value, _) -> value < origin }.maxOfOrNull { (_, label) -> label.size.width + gap } ?: 0f
        val span = axis.domain.endInclusive - axis.domain.start
        val length =
            ends
                .filter { (value, _) -> value >= origin && span > 0 }
                .fold(width - start) { length, (value, label) ->
                    val share = ((value - axis.domain.start) / span).toFloat()
                    if (share > 0) min(length, (width - start - gap - label.size.width) / share) else length
                }
        return start to start + max(length, 1f)
    }

    fun barTop(
        index: Int,
        series: Int,
    ): Float = barTops[index] + (thickness + barGap) * series
}

private class SidewaysTick(
    val at: Float,
    val labelLeft: Float,
    val label: TextLayoutResult,
)

private fun DrawScope.drawGrid(
    layout: UprightLayout,
    color: Color,
) {
    val gap = LABEL_GAP.toPx()
    layout.ticks.forEach { (tick, label) ->
        val y = layout.y.toPixel(tick)
        drawLine(color, Offset(layout.left, y), Offset(layout.right, y), strokeWidth = 1.dp.toPx())
        drawText(label, topLeft = Offset(layout.left - gap - label.size.width, y - label.size.height / 2f))
    }
}

private fun DrawScope.drawBars(
    layout: UprightLayout,
    tones: List<Color>,
) {
    val gap = LABEL_GAP.toPx()
    val zero = layout.y.toPixel(layout.origin)
    val radius = CornerRadius(BAR_RADIUS.toPx())

    layout.visual.series.forEachIndexed { seriesIndex, series ->
        series.values.forEachIndexed { index, value ->
            val x = layout.center(index) - layout.group / 2 + layout.barWidth * seriesIndex
            val top = layout.y.toPixel(value)
            val barTop = min(zero, top)
            drawRoundRect(
                color = tones[seriesIndex % tones.size],
                topLeft = Offset(x + BAR_INSET.toPx(), barTop),
                size = Size(max(layout.barWidth - 2 * BAR_INSET.toPx(), 1f), max(abs(zero - top), 1f)),
                cornerRadius = radius,
            )
            layout.valueLabels?.getOrNull(seriesIndex)?.getOrNull(index)?.let { label ->
                drawText(label, topLeft = Offset(x + layout.barWidth / 2 - label.size.width / 2f, barTop - gap - label.size.height))
            }
        }
    }
}

private fun DrawScope.drawLines(
    layout: UprightLayout,
    tones: List<Color>,
) {
    val gap = LABEL_GAP.toPx()
    val dot = DOT_RADIUS.toPx()

    layout.visual.series.forEachIndexed { seriesIndex, series ->
        val tone = tones[seriesIndex % tones.size]
        val points = series.values.mapIndexed { index, value -> Offset(layout.center(index), layout.y.toPixel(value)) }
        val path =
            Path().apply {
                points.forEachIndexed { index, point ->
                    if (index ==
                        0
                    ) {
                        moveTo(point.x, point.y)
                    } else {
                        lineTo(point.x, point.y)
                    }
                }
            }

        drawPath(path, tone, style = Stroke(width = LINE_WIDTH.toPx(), join = StrokeJoin.Round))
        points.forEachIndexed { index, point ->
            drawCircle(tone, dot, point)
            layout.valueLabels?.getOrNull(seriesIndex)?.getOrNull(index)?.let { label ->
                drawText(label, topLeft = Offset(point.x - label.size.width / 2f, point.y - dot - gap - label.size.height))
            }
        }
    }
}

private fun DrawScope.drawCategories(layout: UprightLayout) {
    layout.categoryLayouts.forEachIndexed { index, lines ->
        if (index % layout.categoryLines.step != 0) return@forEachIndexed
        var y = layout.categoriesTop
        lines.forEach { line ->
            val x = (layout.center(index) - line.size.width / 2f).coerceIn(0f, max(size.width - line.size.width, 0f))
            drawText(line, topLeft = Offset(x, y))
            y += line.size.height
        }
    }
}

private fun DrawScope.drawSideways(
    layout: SidewaysLayout,
    grid: Color,
    tones: List<Color>,
) {
    val gap = LABEL_GAP.toPx()
    val zero = layout.x.toPixel(layout.origin)
    val radius = CornerRadius(BAR_RADIUS.toPx())

    layout.ticks.forEachIndexed { index, tick ->
        drawLine(grid, Offset(tick.at, 0f), Offset(tick.at, layout.plotBottom), strokeWidth = 1.dp.toPx())
        if (index % layout.tickStep == 0) drawText(tick.label, topLeft = Offset(tick.labelLeft, layout.ticksTop))
    }

    layout.names.forEachIndexed { index, name ->
        drawText(name, topLeft = Offset(0f, layout.barTops[index] - SIDEWAYS_NAME_GAP.toPx() - name.size.height))
    }

    layout.visual.series.forEachIndexed { seriesIndex, series ->
        layout.names.indices.forEach { index ->
            val value = series.values.getOrNull(index) ?: return@forEach
            val top = layout.barTop(index, seriesIndex)
            val end = layout.x.toPixel(value)
            drawRoundRect(
                color = tones[seriesIndex % tones.size],
                topLeft = Offset(min(zero, end), top),
                size = Size(max(abs(end - zero), 1f), layout.thickness),
                cornerRadius = radius,
            )
            layout.valueLabels?.getOrNull(seriesIndex)?.getOrNull(index)?.let { label ->
                val x = if (value < layout.origin) min(zero, end) - gap - label.size.width else max(zero, end) + gap
                drawText(label, topLeft = Offset(x, top + layout.thickness / 2 - label.size.height / 2f))
            }
        }
    }
}

/** Which categories show their label (every [step]th) and how each breaks into lines. */
data class CategoryLabels(
    val lines: List<List<String>>,
    val step: Int,
)

/**
 * A line chart's axis is ordered, so its names can skip: each wraps at a space or hyphen to fit its
 * point's band, and when a word is wider than a band only every few names show, each with the room of
 * the ones it skips (main's `getCategoryLabels`).
 */
fun categoryLabels(
    band: Float,
    categories: List<String>,
    width: (String) -> Float,
): CategoryLabels {
    val widestWord = categories.flatMap(::labelWords).maxOfOrNull { width(it.trim()) } ?: band
    val step = ceil(widestWord / band).toInt().coerceAtLeast(1)
    return CategoryLabels(categories.map { wrapLabel(it, band * step, width) }, step)
}

/**
 * Each bar's name wrapped to stand under it, or null when one can't: a word wider than the bar, or more
 * than two lines. Every bar must keep its name, so such a chart lays its bars on their side instead.
 */
fun uprightBarLabels(
    band: Float,
    categories: List<String>,
    width: (String) -> Float,
): List<List<String>>? {
    if (categories.flatMap(::labelWords).any { width(it.trim()) > band }) return null
    return categories.map { wrapLabel(it, band, width) }.takeIf { labels -> labels.all { it.size <= UPRIGHT_NAME_LINES } }
}

private val LABEL_BREAK = Regex("(?<=[\\s-])")

private fun labelWords(label: String): List<String> = label.split(LABEL_BREAK).filter(String::isNotEmpty)

private fun wrapLabel(
    label: String,
    room: Float,
    width: (String) -> Float,
): List<String> =
    labelWords(label)
        .fold(emptyList<String>()) { lines, word ->
            val line = lines.lastOrNull()
            if (line != null && width((line + word).trim()) <= room) lines.dropLast(1) + (line + word) else lines + word
        }.map(String::trim)

@Composable
private fun TimelineVisual(
    visual: LessonVisual.Timeline,
    modifier: Modifier,
) {
    val accent = MaterialTheme.zoonk.vizAccent
    val line = MaterialTheme.zoonk.vizGrid
    val dateStyle = MaterialTheme.typography.bodyMedium.withTabularFigures()
    val dotCenter = with(LocalDensity.current) { dateStyle.lineHeight.toPx() / 2 }

    OutlinedCard(modifier.fillMaxWidth()) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
            Text(text = visual.title, style = MaterialTheme.typography.titleSmall)

            Column {
                visual.events.forEachIndexed { index, event ->
                    val last = index == visual.events.lastIndex

                    Row(Modifier.height(IntrinsicSize.Min).semantics(mergeDescendants = true) {}) {
                        Box(
                            Modifier.width(TIMELINE_DOT).fillMaxHeight().drawBehind {
                                val x = size.width / 2
                                if (!last) drawLine(line, Offset(x, dotCenter), Offset(x, size.height), strokeWidth = 2.dp.toPx())
                                drawCircle(accent, radius = size.width / 2, center = Offset(x, dotCenter))
                            },
                        )
                        Column(Modifier.padding(start = 12.dp, bottom = if (last) 0.dp else 16.dp)) {
                            Text(text = event.date, color = accent, style = dateStyle, fontWeight = FontWeight.SemiBold)
                            Text(text = event.label, style = MaterialTheme.typography.bodyLarge)
                            event.detail?.let {
                                Text(
                                    text = it,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                                    style = MaterialTheme.typography.bodyMedium,
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}

private val LABEL_GAP = 6.dp
private val PLOT_END = 8.dp
private val PLOT_HEIGHT = 160.dp
private const val PLOT_LINES = 6
private const val UNIT_TARGET = 12
private val BAR_RADIUS = 3.dp
private val LINE_WIDTH = 2.dp
private val DOT_RADIUS = 3.5.dp
private val TIMELINE_DOT = 12.dp

private const val GROUP_SHARE = 0.68f
private val BAR_INSET = 1.dp

private const val UPRIGHT_NAME_LINES = 2
private val SIDEWAYS_BAR = 14.dp
private val SIDEWAYS_BAR_GAP = 2.dp
private val SIDEWAYS_NAME_GAP = 4.dp
private val SIDEWAYS_ROW_GAP = 12.dp
private const val VALUE_SHARE = 1 / 3f
