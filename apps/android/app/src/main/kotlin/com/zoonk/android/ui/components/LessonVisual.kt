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
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.formatAmount
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

/** Main's `LessonVisual`, which questions, sets, mocks and lesson steps share. */
@OptIn(ExperimentalSerializationApi::class)
@Serializable
@JsonClassDiscriminator("kind")
sealed interface LessonVisual {
    @Serializable
    @SerialName("chart")
    data class Chart(
        val chart: Kind,
        val title: String,
        val categoryLabel: String,
        val valueLabel: String,
        val categories: List<String>,
        val series: List<Series>,
        val unit: String? = null,
        val axisStart: Double? = null,
        val source: String? = null,
    ) : LessonVisual {
        @Serializable
        enum class Kind {
            @SerialName("bar")
            Bar,

            @SerialName("line")
            Line,
        }

        @Serializable
        data class Series(
            val name: String,
            val values: List<Double>,
        )
    }

    @Serializable
    @SerialName("timeline")
    data class Timeline(
        val title: String,
        val events: List<Event>,
    ) : LessonVisual {
        @Serializable
        data class Event(
            val date: String,
            val label: String,
            val detail: String? = null,
        )
    }
}

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
    val quiet = MaterialTheme.typography.bodySmall
    val muted = MaterialTheme.colorScheme.onSurfaceVariant

    OutlinedCard(modifier.fillMaxWidth()) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Text(text = visual.title, style = MaterialTheme.typography.titleSmall)
            if (visual.series.size > 1) Legend(visual.series)

            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text(text = visual.valueLabel, modifier = Modifier.clearAndSetSemantics {}, color = muted, style = quiet)
                ChartCanvas(visual)
                Text(
                    text = visual.categoryLabel,
                    modifier = Modifier.fillMaxWidth().clearAndSetSemantics {},
                    color = muted,
                    style = quiet,
                    textAlign = TextAlign.Center,
                )
            }

            visual.source?.let { Text(text = stringResource(R.string.visual_source, it), color = muted, style = quiet) }
        }
    }
}

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
private fun ChartCanvas(visual: LessonVisual.Chart) {
    if (visual.categories.isEmpty() || visual.series.isEmpty()) return

    val locale = currentLocale()
    val density = LocalDensity.current
    val measurer = rememberTextMeasurer()
    val labelStyle =
        MaterialTheme.typography.bodySmall
            .withTabularFigures()
            .copy(color = MaterialTheme.colorScheme.onSurfaceVariant)
    val valueStyle = labelStyle.copy(color = MaterialTheme.colorScheme.onSurface, fontWeight = FontWeight.Medium)
    val grid = MaterialTheme.colorScheme.outlineVariant
    val tones = seriesTones()
    val summary = chartSummary(visual, locale)

    BoxWithConstraints(Modifier.fillMaxWidth()) {
        val width = constraints.maxWidth.toFloat()
        val layout =
            remember(visual, width, labelStyle, valueStyle, density, locale) {
                ChartLayout(visual, width, ChartText(measurer, labelStyle, valueStyle, density, locale))
            }

        Canvas(
            Modifier
                .fillMaxWidth()
                .height(with(density) { layout.height.toDp() })
                .semantics { contentDescription = summary },
        ) {
            drawGrid(layout, grid)
            if (visual.chart == LessonVisual.Chart.Kind.Bar) drawBars(layout, tones) else drawLines(layout, tones)
            drawCategories(layout)
        }
    }
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

    // The plot reads left to right in every language, as main's does; each label keeps its own direction.
    private fun measure(
        text: String,
        style: TextStyle,
    ) = measurer.measure(text, style.copy(textDirection = TextDirection.Content), density = density, layoutDirection = LayoutDirection.Ltr)
}

private class ChartLayout(
    val visual: LessonVisual.Chart,
    width: Float,
    text: ChartText,
) {
    private val gap = with(text.density) { LABEL_GAP.toPx() }
    private val values = visual.series.flatMap { it.values }
    private val wholeNumbers = values.all { it == Math.floor(it) }

    private val domain =
        niceDomain(visual.axisStart?.let { values + it } ?: values, includeZero = visual.chart == LessonVisual.Chart.Kind.Bar).let { nice ->
            visual.axisStart?.let { it..nice.endInclusive } ?: nice
        }

    val ticks =
        niceTicks(domain).filter { !wholeNumbers || it == Math.floor(it) }.map {
            it to text.label(formatAmount(it, text.locale, visual.unit, compact = true))
        }

    val left = (ticks.maxOfOrNull { it.second.size.width } ?: 0) + gap
    val right = width - with(text.density) { PLOT_END.toPx() }
    private val lineHeight =
        text
            .label("0")
            .size.height
            .toFloat()
    val top = lineHeight + gap

    // Grows with the font, so a large font's axis labels don't crowd each other.
    private val plotHeight = max(with(text.density) { PLOT_HEIGHT.toPx() }, lineHeight * PLOT_LINES)
    val bottom = top + plotHeight
    val band = max(right - left, 1f) / visual.categories.size

    val categoryLines: CategoryLabels =
        categoryLabels(band, visual.categories) { line -> text.label(line).size.width + gap }

    val categoryLayouts = categoryLines.lines.map { lines -> lines.map(text::label) }

    /** Below the lowest axis label, which is centered on the plot's bottom line. */
    val categoriesTop = bottom + max(gap, lineHeight / 2)

    val height = categoriesTop + lineHeight * (categoryLines.lines.maxOfOrNull { it.size } ?: 1)

    val y = LinearScale(domain, bottom to top)

    val group = band * GROUP_SHARE
    val barWidth = group / visual.series.size

    val valueLabels: List<List<TextLayoutResult>>? =
        visual.series
            .map { series -> series.values.map { text.value(formatAmount(it, text.locale, visual.unit)) } }
            .takeIf { labels ->
                val room = if (visual.chart == LessonVisual.Chart.Kind.Bar) barWidth + gap else band
                (visual.chart == LessonVisual.Chart.Kind.Bar || visual.series.size == 1) && labels.flatten().all { it.size.width <= room }
            }

    fun center(index: Int): Float = left + band * index + band / 2
}

private fun DrawScope.drawGrid(
    layout: ChartLayout,
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
    layout: ChartLayout,
    tones: List<Color>,
) {
    val gap = LABEL_GAP.toPx()
    val zero = layout.y.toPixel(max(layout.y.domain.start, 0.0))
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
    layout: ChartLayout,
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

private fun DrawScope.drawCategories(layout: ChartLayout) {
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

/** Which categories show their label (every [step]th) and how each breaks into lines. */
data class CategoryLabels(
    val lines: List<List<String>>,
    val step: Int,
)

/**
 * One line each when they fit their band, else two broken at the space or hyphen nearest the
 * middle, else every few labels so none overlap (main's `getCategoryLabels`).
 */
fun categoryLabels(
    band: Float,
    categories: List<String>,
    width: (String) -> Float,
): CategoryLabels {
    val fits = { labels: List<List<String>> -> labels.all { lines -> lines.all { width(it) <= band } } }
    val single = categories.map { listOf(it) }
    val split = categories.map(::splitLabel)

    return when {
        fits(single) -> CategoryLabels(single, 1)
        fits(split) -> CategoryLabels(split, 1)
        else -> CategoryLabels(single, ceil((categories.maxOfOrNull(width) ?: band) / band).toInt().coerceAtLeast(1))
    }
}

private fun splitLabel(label: String): List<String> {
    val middle = label.length / 2f
    val at =
        label.indices
            .filter { label[it].isWhitespace() || label[it] == '-' }
            .minByOrNull { abs(it - middle) } ?: return listOf(label)
    val end = if (label[at] == '-') at + 1 else at
    return listOf(label.substring(0, end), label.substring(at + 1))
}

@Composable
private fun TimelineVisual(
    visual: LessonVisual.Timeline,
    modifier: Modifier,
) {
    val accent = MaterialTheme.zoonk.vizAccent
    val line = MaterialTheme.colorScheme.outlineVariant
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
private val BAR_RADIUS = 3.dp
private val LINE_WIDTH = 2.dp
private val DOT_RADIUS = 3.5.dp
private val TIMELINE_DOT = 12.dp

private const val GROUP_SHARE = 0.68f
private val BAR_INSET = 1.dp
