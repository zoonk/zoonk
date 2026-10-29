package com.zoonk.android.feature.activities

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.ui.components.AnswerResult
import com.zoonk.android.ui.components.niceDomain
import com.zoonk.android.ui.components.niceTicks
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.formatAmount
import com.zoonk.android.ui.format.formatNumber
import com.zoonk.android.ui.format.fractionDigitsFor
import com.zoonk.android.ui.theme.zoonk
import com.zoonk.api.models.PlayableLibraryStepAnyOfContentOneOf10Fields
import com.zoonk.api.models.PlayableLibraryStepAnyOfContentOneOf10Fields.Statistic
import java.util.Locale
import kotlin.math.abs
import kotlin.math.floor
import com.zoonk.api.models.PlayableLibraryStepAnyOfContent.PlayableLibraryStepAnyOfContentOneOf10Value as ChartReaderContent
import com.zoonk.api.models.PlayableLibraryStepAnyOfContentOneOfCheck.PlayableLibraryStepAnyOfContentOneOfCheckOneOf2Value as NumericCheckValue

private typealias ChartFields = PlayableLibraryStepAnyOfContentOneOf10Fields

val chartReaderRenderer =
    ActivityRenderer(
        badge = { ActivityBadge(R.string.activities_badge_read_chart, R.drawable.ic_show_chart) },
        canvas = { ChartReaderActivity(it) },
        showsData = { true },
    )

@Composable
private fun ChartReaderActivity(props: ActivityProps) {
    val content = (props.content as ChartReaderContent).value
    val fields = content.fields
    val locale = currentLocale()
    var selected by rememberSaveable { mutableStateOf(emptyList<String>()) }
    val numeric = content.check as? NumericCheckValue
    val targetId = numeric?.let { it.value.output ?: fields.spans.firstOrNull()?.id }
    val xs = fields.points.map { it.x }
    val xDomain = xs.min()..xs.max()
    val yDomain = niceDomain(fields.points.map { it.y }, includeZero = false)
    val plainX = xs.all { it == floor(it) && abs(it) < PLAIN_NUMBER_LIMIT }
    val formatX = { value: Double -> formatNumber(value, locale, fractionDigitsFor(value), grouping = !plainX) }
    val shown = fields.spans.filter { it.id in selected || (props.isChecked && props.expected.numericValue != null && it.id == targetId) }
    val measures = shown.mapNotNull { span -> measureSpan(fields, span.id)?.let { span to formatMeasure(fields, it, locale) } }
    val accent = MaterialTheme.zoonk.vizSecondary
    val description =
        listOf(
            stringResource(
                R.string.activities_chart_description,
                fields.yLabel,
                fields.xLabel,
                formatAmount(pointAt(fields, xDomain.start), locale, fields.yUnit),
                formatX(xDomain.start),
                formatAmount(pointAt(fields, xDomain.endInclusive), locale, fields.yUnit),
                formatX(xDomain.endInclusive),
            ),
        ) + measures.map { (span, measure) -> stringResource(R.string.activities_chart_span, span.label, measure) }

    ActivityCanvas(description = description.joinToString(" ")) {
        Text(fields.yLabel, style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.Medium))
        val ink = MaterialTheme.colorScheme.onSurface
        val ring = MaterialTheme.colorScheme.surface
        ActivityPlot(
            xDomain = xDomain,
            yDomain = yDomain,
            yTicks = niceTicks(yDomain, AXIS_TICKS),
            xTicks = niceTicks(xDomain, AXIS_TICKS),
            formatY = { formatAmount(it, locale, compact = true) },
            formatX = formatX,
        ) {
            shown.forEach { band(it.from, it.to, accent.copy(alpha = SOFT)) }
            line(fields.points.map { it.x to it.y }, ink, width = LINE_WIDTH)
            measures.forEach { (span, measure) ->
                dot(span.from, pointAt(fields, span.from), accent, ring, radius = ENDPOINT_RADIUS)
                dot(span.to, pointAt(fields, span.to), accent, ring, radius = ENDPOINT_RADIUS)
                label(measure, (span.from + span.to) / 2, maxOf(pointAt(fields, span.from), pointAt(fields, span.to)), accent)
            }
        }
        ActivityCanvasLabel(fields.xLabel)
        Text(
            stringResource(R.string.activities_chart_tap_span),
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            style = MaterialTheme.typography.bodyMedium,
        )
        ActivitySelectGrid(fields.spans, label = stringResource(R.string.activities_chart_spans)) { span ->
            ActivityTile(
                picked = span.id in selected,
                result = AnswerResult.Right.takeIf { props.isChecked && span.id == targetId },
                enabled = !props.isLocked,
                onClick = {
                    selected = if (span.id in selected) selected - span.id else selected + span.id
                    if (numeric != null) props.onAnswerChange(selected.lastOrNull()?.let { measureSpan(fields, it) }?.let(::numericAnswer))
                },
            ) { Text(span.label) }
        }
    }
}

private fun pointAt(
    fields: ChartFields,
    x: Double,
): Double = fields.points.find { it.x == x }?.y ?: 0.0

/** Core's `measureSpan`: a span's change, percent change or change per x unit. */
internal fun measureSpan(
    fields: ChartFields,
    spanId: String,
): Double? {
    val span = fields.spans.find { it.id == spanId } ?: return null
    val start = fields.points.find { it.x == span.from }?.y ?: return null
    val end = fields.points.find { it.x == span.to }?.y ?: return null
    return when (fields.statistic) {
        Statistic.CHANGE -> end - start
        Statistic.RATE_PER_UNIT -> (end - start) / (span.to - span.from)
        Statistic.PERCENT_CHANGE -> if (start == 0.0) null else (end - start) / start * PERCENT
    }
}

@Composable
private fun formatMeasure(
    fields: ChartFields,
    value: Double,
    locale: Locale,
): String {
    val signed = { unit: String? -> formatAmount(value, locale, unit, signed = true) }
    return when (fields.statistic) {
        Statistic.PERCENT_CHANGE -> signed("%")
        Statistic.CHANGE -> signed(fields.yUnit)
        Statistic.RATE_PER_UNIT -> stringResource(R.string.activities_chart_rate, signed(fields.yUnit), fields.xLabel)
    }
}

private const val AXIS_TICKS = 3
private const val PERCENT = 100
private const val PLAIN_NUMBER_LIMIT = 10_000
private const val SOFT = 0.16f
private val LINE_WIDTH = 2.dp
private val ENDPOINT_RADIUS = 4.5.dp
