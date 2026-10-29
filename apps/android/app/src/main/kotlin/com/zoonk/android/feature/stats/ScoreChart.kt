package com.zoonk.android.feature.stats

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.drawText
import androidx.compose.ui.text.rememberTextMeasurer
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.ui.components.LinearScale
import com.zoonk.android.ui.format.DateStyle
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.formatDate
import com.zoonk.android.ui.format.formatNumber
import com.zoonk.android.ui.theme.withTabularFigures
import com.zoonk.api.models.CurrentUserScoreResponseScore
import kotlinx.datetime.toJavaLocalDate

/**
 * Main's weekly score trend: one line in the score's blue on a fixed 0–100 scale, weeks along the
 * bottom with as many labels as fit. TalkBack reads main's hidden caption: the score, then each week.
 */
@Composable
internal fun ScoreChart(
    score: CurrentUserScoreResponseScore,
    modifier: Modifier = Modifier,
) {
    val locale = currentLocale()
    val newest =
        score.dataPoints
            .lastOrNull()
            ?.date
            ?.toJavaLocalDate()
    val weeks =
        score.dataPoints.map {
            formatDate(
                it.date.toJavaLocalDate(),
                locale,
                DateStyle.Day,
                today =
                    newest ?: it.date.toJavaLocalDate(),
            )
        }
    val points =
        score.dataPoints.mapIndexed { index, point ->
            pluralStringResource(
                R.plurals.stats_score_week,
                point.totalAnswers.toInt(),
                weeks[index],
                metricPercent(point.score, locale),
                formatNumber(point.totalAnswers.toDouble(), locale),
            )
        }
    val summary =
        stringResource(
            R.string.stats_score_trend,
            pluralStringResource(
                R.plurals.stats_score_across,
                score.totalAnswers.toInt(),
                metricPercent(score.score, locale),
                formatNumber(score.totalAnswers.toDouble(), locale),
            ),
            points.joinToString("; "),
        )

    val measurer = rememberTextMeasurer()
    val labelStyle =
        MaterialTheme.typography.labelSmall
            .withTabularFigures()
            .copy(color = MaterialTheme.colorScheme.onSurfaceVariant)
    val grid = MaterialTheme.colorScheme.outlineVariant
    val line = MaterialTheme.colorScheme.tertiary
    val ticks = remember(measurer, labelStyle, locale) { PERCENT_TICKS.map { measurer.measure(formatNumber(it, locale), labelStyle) } }
    val weekLabels = remember(measurer, labelStyle, weeks) { weeks.map { measurer.measure(it, labelStyle) } }

    Canvas(modifier.fillMaxWidth().height(CHART_HEIGHT).semantics { contentDescription = summary }) {
        val gap = 8.dp.toPx()
        val labelHeight = weekLabels.maxOfOrNull { it.size.height } ?: 0
        val left = (ticks.maxOf { it.size.width } + gap)
        val bottom = size.height - labelHeight - gap
        val top = ticks.first().size.height / 2f
        val y = LinearScale(0.0..PERCENT, bottom to top)
        val x = LinearScale(0.0..(weeks.size - 1).coerceAtLeast(1).toDouble(), left + START_PAD.toPx() to size.width - END_PAD.toPx())

        PERCENT_TICKS.forEachIndexed { index, tick ->
            val at = y.toPixel(tick)
            drawLine(grid, Offset(left, at), Offset(size.width, at), strokeWidth = 1.dp.toPx())
            drawText(ticks[index], topLeft = Offset(left - gap - ticks[index].size.width, at - ticks[index].size.height / 2f))
        }

        // Recharts' `preserveStartEnd` with a minimum gap: the first and last week, and those between that fit.
        var lastEnd = Float.NEGATIVE_INFINITY
        val lastStart = x.toPixel((weeks.size - 1).toDouble()) - weekLabels.last().size.width / 2f
        weekLabels.forEachIndexed { index, label ->
            val start = x.toPixel(index.toDouble()) - label.size.width / 2f
            val isEdge = index == 0 || index == weekLabels.lastIndex
            if (isEdge || (start >= lastEnd + MIN_LABEL_GAP.toPx() && start + label.size.width + MIN_LABEL_GAP.toPx() <= lastStart)) {
                drawText(label, topLeft = Offset(start, bottom + gap))
                lastEnd = start + label.size.width
            }
        }

        val path = Path()
        score.dataPoints.forEachIndexed { index, point ->
            val at = Offset(x.toPixel(index.toDouble()), y.toPixel(point.score.coerceIn(0.0, PERCENT)))
            if (index == 0) path.moveTo(at.x, at.y) else path.lineTo(at.x, at.y)
            drawCircle(line, radius = DOT.toPx(), center = at)
        }
        drawPath(path, line, style = Stroke(width = 2.dp.toPx()))
    }
}

private const val PERCENT = 100.0
private val PERCENT_TICKS = listOf(0.0, 25.0, 50.0, 75.0, 100.0)
private val CHART_HEIGHT = 220.dp
private val START_PAD = 16.dp
private val END_PAD = 24.dp
private val MIN_LABEL_GAP = 24.dp
private val DOT = 2.5.dp
