package com.zoonk.android.ui.components

import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
import java.util.Locale
import kotlin.math.abs
import kotlin.math.max
import kotlin.math.min

/**
 * Main's `plot-layout`, in layout units for 12-unit labels: a larger text size scales the whole drawing by
 * [plotTextScale]. [label] measures a label's text and [name] a point's name, drawn in medium weight.
 */
class PlotText(
    val label: (String) -> Float,
    val name: (String) -> Float,
) {
    fun labelWidth(text: String) = label(text) + PLOT_LABEL_GAP
}

class PlotTick(
    val value: Double,
    val label: String,
    val line: Boolean,
)

class PlacedTick(
    val value: Double,
    val label: String,
    val center: Float,
)

/** [top] is the first line's top and [x] where the text starts; a numbered line's name is in the key. */
class ReferenceMark(
    val label: String,
    val lines: List<String>,
    val top: Float,
    val x: Float,
    val y: Float,
)

private data class PlannedMark(
    val label: String,
    val lines: List<String>,
    val top: Float,
    val y: Float,
    val offset: Float,
)

private class ReferencePlan(
    val key: List<KeyEntry>,
    val marks: List<PlannedMark>,
    val width: Float,
)

private class Gutters(
    visual: LessonVisual.Plot,
    text: PlotText,
    locale: Locale,
) {
    val axes = plotAxes(visual)
    val yLabels = formatTicks(axes.second.ticks, locale, unit = placeChartUnit(visual.yUnit, visual.yLabel).numberUnit)
    val left = max(PLOT_LEFT, yLabels.maxOfOrNull(text::labelWidth) ?: 0f)
    private val names = visual.references.map { it.label }
    val longest = names.maxOfOrNull(text::labelWidth) ?: 0f
    val widestWord = widestWord(names, text::labelWidth)
}

private fun widestWord(
    labels: List<String>,
    width: (String) -> Float,
) = labels.flatMap(::labelWords).maxOfOrNull { width(it.trim()) } ?: 0f

/**
 * The drawing's text grows with the reader's text size until the plot area would get narrower than [MIN_PLOT_WIDTH],
 * counting reference names wrapped as narrow as their widest word; the text around the drawing keeps growing.
 * [boxWidth] is in dp.
 */
fun plotTextScale(
    visual: LessonVisual.Plot,
    boxWidth: Float,
    textScale: Float,
    text: PlotText,
    locale: Locale,
): Float {
    val gutters = Gutters(visual, text, locale)
    val named = visual.references.isNotEmpty()
    val fixed = gutters.left + (if (named) REFERENCE_INSET else PLOT_RIGHT) + MIN_PLOT_WIDTH
    val minWidth =
        if (named) min(fixed + gutters.longest, max(fixed / (1 - MAX_GUTTER_SHARE), fixed + gutters.widestWord)) else fixed
    return min(textScale, max(boxWidth / minWidth, 1f))
}

/** A bare line marks its end with its series' shape only when there are other series to tell it from. */
internal fun drawsDot(
    mark: LessonVisual.Plot.Mark,
    index: Int,
    pointCount: Int,
    seriesCount: Int,
) = mark != LessonVisual.Plot.Mark.Line || (seriesCount > 1 && index == pointCount - 1)

class PlotGeometry(
    val visual: LessonVisual.Plot,
    width: Float,
    text: PlotText,
    locale: Locale,
) {
    private val gutters = Gutters(visual, text, locale)
    private val axes = gutters.axes
    val left = gutters.left
    val plotBottom = PLOT_HEIGHT - PLOT_BOTTOM
    val y = LinearScale(axes.second.domain, plotBottom to PLOT_TOP)
    private val plan = planReferences(left, text, visual.references, width, y)
    val plotRight = max(width - plan.width, left + 1)
    val x = LinearScale(axes.first.domain, left to plotRight)

    val series = visual.series.map { series -> series.points.map { Offset(x.toPixel(it.x), y.toPixel(it.y)) } }

    private val points =
        pointLabels(
            named =
                visual.series.flatMapIndexed { seriesIndex, entry ->
                    entry.points.mapIndexedNotNull { index, point -> point.label?.let { series[seriesIndex][index] to it } }
                },
            scene =
                LabelScene(
                    bounds = Rect(left, 0f, if (plan.marks.isNotEmpty()) plotRight else width, plotBottom),
                    dots =
                        series.flatMapIndexed { seriesIndex, pixels ->
                            pixels.filterIndexed { index, _ -> drawsDot(visual.series[seriesIndex].mark, index, pixels.size, series.size) }
                        },
                    segments = segments(),
                ),
            width = text.name,
            firstMarker = plan.key.size + 1,
        )

    val labels = points.labels
    val key = plan.key + points.key

    val references = plan.marks.map { ReferenceMark(it.label, it.lines, it.top, plotRight + REFERENCE_INSET + it.offset, it.y) }

    /** A gridline that would sit under a reference line is left out, so the line keeps its dashes. */
    val yTicks =
        axes.second.ticks.mapIndexed { index, value ->
            PlotTick(value, gutters.yLabels[index], plan.marks.all { abs(it.y - y.toPixel(value)) >= GRID_SNAP })
        }

    val xTickY = plotBottom + AXIS_LABEL_OFFSET

    /**
     * Each number sits centered under its value. The first or last one is left out when it would reach the y axis's
     * numbers or past the drawing's edge, and the rest thin out evenly when they would touch.
     */
    val xTicks =
        axes.first.ticks
            .zip(formatTicks(axes.first.ticks, locale, xAxis = true, unit = placeChartUnit(visual.xUnit, visual.xLabel).numberUnit))
            .map { (value, label) ->
                val center = x.toPixel(value)
                val half = text.label(label) / 2
                Triple(PlacedTick(value, label, center), center - half, center + half)
            }.filter { (_, start, end) -> start >= left - PLOT_LABEL_GAP + CORNER_CLEARANCE && end <= width }
            .let { placed ->
                val kept = fittingTickIndices(placed.map { (_, start, end) -> start to end }, PLOT_LABEL_GAP)
                placed.filterIndexed { index, _ -> index in kept }.map { it.first }
            }

    private fun segments(): List<Pair<Offset, Offset>> {
        val lines =
            series.flatMapIndexed { index, pixels ->
                if (visual.series[index].mark == LessonVisual.Plot.Mark.Points) emptyList() else pixels.zipWithNext()
            }
        return lines + plan.marks.map { Offset(x.range.first, it.y) to Offset(x.range.second, it.y) }
    }
}

private fun planReferences(
    left: Float,
    text: PlotText,
    references: List<LessonVisual.Plot.Reference>,
    width: Float,
    y: LinearScale,
): ReferencePlan {
    if (references.isEmpty()) return ReferencePlan(emptyList(), emptyList(), PLOT_RIGHT)
    val available = width - left - REFERENCE_INSET - MIN_PLOT_WIDTH
    return nameReferences(available, text, references, width, y) ?: numberReferences(text, references, y)
}

private fun blockHeight(lines: List<String>) = lines.size * PLOT_LINE_HEIGHT

/**
 * Names sit past the plot's right edge, level with their lines and clear of a point drawn on that edge. A name wraps
 * to a share of the width, never inside a word and never taking the plot below its narrowest; it can't be named there
 * when even its widest word doesn't fit, or when names stacked apart would sit off their lines by more than half a line.
 */
private fun nameReferences(
    available: Float,
    text: PlotText,
    references: List<LessonVisual.Plot.Reference>,
    width: Float,
    y: LinearScale,
): ReferencePlan? {
    val names = references.map { it.label }
    val widestWord = widestWord(names, text::labelWidth)
    if (widestWord > available) return null

    val longest = names.maxOf(text::labelWidth)
    val room = minOf(longest, max(width * MAX_GUTTER_SHARE, widestWord), available)
    val marks =
        references.map { reference ->
            val lines = wrapLabel(reference.label, room, text::labelWidth)
            val lineY = y.toPixel(reference.y)
            PlannedMark(reference.label, lines, lineY - blockHeight(lines) / 2, lineY, 0f)
        }
    val stacked = stackReferences(marks, y.range.first)
    if (stacked.any { abs(it.top + blockHeight(it.lines) / 2 - it.y) > MAX_NAME_SHIFT }) return null

    return ReferencePlan(emptyList(), stacked, REFERENCE_INSET + stacked.flatMap { it.lines }.maxOf(text::labelWidth))
}

private fun stackReferences(
    marks: List<PlannedMark>,
    bottom: Float,
): List<PlannedMark> {
    val stacked =
        marks.sortedBy { it.y }.fold(emptyList<PlannedMark>()) { placed, mark ->
            val floor = placed.lastOrNull()?.let { it.top + blockHeight(it.lines) + REFERENCE_SPACING } ?: 0f
            placed + mark.copy(top = max(mark.top, floor))
        }
    val overflow = stacked.lastOrNull()?.let { it.top + blockHeight(it.lines) - bottom } ?: 0f
    return if (overflow > 0) stacked.map { it.copy(top = it.top - overflow) } else stacked
}

/**
 * Each line carries a number, from the top line down, level with its line; numbers of lines closer than a line of
 * text sit side by side instead of stacking off their lines.
 */
private fun numberReferences(
    text: PlotText,
    references: List<LessonVisual.Plot.Reference>,
    y: LinearScale,
): ReferencePlan {
    val markerWidth = text.labelWidth(references.size.toString())
    val columns = mutableListOf<Float>()
    val marks =
        references
            .map { it.label to y.toPixel(it.y) }
            .sortedBy { it.second }
            .mapIndexed { index, (label, lineY) ->
                val free = columns.indexOfFirst { lineY - it >= PLOT_LINE_HEIGHT }
                val column = if (free == -1) columns.size else free
                if (column == columns.size) columns += lineY else columns[column] = lineY
                PlannedMark(label, listOf("${index + 1}"), lineY - PLOT_LINE_HEIGHT / 2, lineY, column * markerWidth)
            }

    return ReferencePlan(marks.map { KeyEntry(it.lines.first(), it.label) }, marks, REFERENCE_INSET + columns.size * markerWidth)
}

const val PLOT_HEIGHT = 208f
const val PLOT_LABEL_GAP = 6f
const val PLOT_LINE_HEIGHT = 14f

/** The narrowest plot area that still keeps its x numbers and its points' names readable. */
const val MIN_PLOT_WIDTH = 72f
private const val PLOT_TOP = 22f
private const val PLOT_BOTTOM = 26f
private const val PLOT_LEFT = 48f
private const val PLOT_RIGHT = 8f
private const val AXIS_LABEL_OFFSET = 16f
private const val REFERENCE_INSET = PLOT_DOT_ROOM + PLOT_LABEL_GAP
private const val MAX_GUTTER_SHARE = 0.3f
private const val REFERENCE_SPACING = 2f
private const val MAX_NAME_SHIFT = PLOT_LINE_HEIGHT / 2
private const val CORNER_CLEARANCE = 2f
private const val GRID_SNAP = 1f
