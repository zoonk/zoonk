package com.zoonk.android.feature.writing

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.ui.components.MeterPart
import com.zoonk.android.ui.components.MeterParts
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.formatNumber
import com.zoonk.android.ui.theme.withTabularFigures
import java.util.Locale
import kotlin.math.ceil
import kotlin.math.floor
import kotlin.math.pow

/**
 * A range of points in its scale's [decimals], both ends alike ("12.0–17.5", never "12–17.5"), its
 * low end rounded down and its high end up, so it never claims more than the grade has; one number
 * when both ends round alike.
 */
@Composable
fun pointsRange(
    low: Double,
    high: Double,
    decimals: Int,
): String {
    // A zeroed score is "0", never "0.0" or "0–0".
    if (low == 0.0 && high == 0.0) return formatNumber(0.0, currentLocale())
    val (from, to) = rangeEnds(low, high, decimals, currentLocale())
    return if (from == to) from else stringResource(R.string.essay_range, from, to)
}

/** What language errors take away, as a range like the rest: "−0.3 to −0.6", never "−0.3–0.6". */
@Composable
fun deductionRange(
    low: Double,
    high: Double,
    decimals: Int,
): String {
    val (from, to) = rangeEnds(low, high, decimals, currentLocale())
    return when {
        high <= 0 -> formatNumber(0.0, currentLocale())
        from == to -> stringResource(R.string.essay_minus, from)
        else -> stringResource(R.string.essay_minus_range, from, to)
    }
}

private fun rangeEnds(
    low: Double,
    high: Double,
    decimals: Int,
    locale: Locale,
): Pair<String, String> {
    val step = 10.0.pow(decimals)
    // 0.3 × 10 is 3.0000000000000004 in floating point, which must still round to 3; zero stays zero, never "−0".
    val shownLow = floor(low * step + FLOAT_SLACK) / step + 0.0
    val shownHigh = ceil(high * step - FLOAT_SLACK) / step + 0.0
    return formatPoints(shownLow, locale, decimals) to formatPoints(shownHigh, locale, decimals)
}

/** A score on its scale with exactly its [decimals]; a fixed amount, such as a question's worth, as it is. */
fun formatPoints(
    value: Double,
    locale: Locale,
    decimals: Int? = null,
): String =
    formatNumber(
        value,
        locale,
        maximumFractionDigits = decimals ?: MAX_FIXED_DECIMALS,
        minimumFractionDigits = decimals ?: 0,
    )

/** Where a minimum falls on a scale, as a share of it: a percent as is, points against [max]. */
fun minimumShare(
    percent: Boolean,
    value: Double,
    max: Double?,
): Double? =
    when {
        percent -> value / PERCENT
        max != null && max > 0 -> value / max
        else -> null
    }?.coerceIn(0.0, 1.0)

/** A block's one number: the range large, its scale small beside it ("54–61 of 100"). */
@Composable
fun PointsReadout(
    low: Double,
    high: Double,
    max: Double,
    decimals: Int,
    modifier: Modifier = Modifier,
) {
    // The range keeps its dash at the number's size; only the scale beside it is small.
    val large =
        MaterialTheme.typography.displaySmall
            .withTabularFigures()
            .copy(fontWeight = FontWeight.SemiBold)
    val scale =
        SpanStyle(
            fontSize = MaterialTheme.typography.titleMedium.fontSize,
            fontWeight = FontWeight.Medium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
    val range = pointsRange(low, high, decimals)
    val ofMax = stringResource(R.string.essay_of_max, formatPoints(max, currentLocale(), decimals))
    Text(
        buildAnnotatedString {
            append(range)
            append(" ")
            withStyle(scale) { append(ofMax) }
        },
        modifier,
        style = large,
    )
}

/**
 * The range on its scale: what it surely reaches solid, what it may reach lighter, and the rest as
 * track; [minimumShare] stands over it as a tick. With no [low] and [high] it's a dashed outline, so an
 * unmeasured part never reads as zero.
 */
@Composable
fun RangeMeter(
    low: Double?,
    high: Double?,
    max: Double,
    modifier: Modifier = Modifier,
    minimumShare: Double? = null,
) {
    if (low == null || high == null || max <= 0) {
        Box(
            modifier
                .fillMaxWidth()
                .height(METER_HEIGHT)
                .border(1.dp, MaterialTheme.colorScheme.outlineVariant, RoundedCornerShape(METER_HEIGHT)),
        )
        return
    }
    val green = MaterialTheme.colorScheme.tertiary
    val surely = (low / max).toFloat().coerceIn(0f, 1f)
    val maybe = (high / max).toFloat().coerceIn(surely, 1f)
    val parts =
        listOfNotNull(
            MeterPart(MeterPart.Fill.Solid(green), surely).takeIf { surely > 0f },
            MeterPart(MeterPart.Fill.Solid(green.copy(alpha = MAYBE_ALPHA)), maybe - surely).takeIf { maybe > surely },
            MeterPart(MeterPart.Fill.Track, 1f - maybe).takeIf { maybe < 1f },
        )

    BoxWithConstraints(modifier.fillMaxWidth().height(TICK_HEIGHT), contentAlignment = Alignment.CenterStart) {
        MeterParts(parts)
        minimumShare?.let {
            val at = maxWidth * it.toFloat().coerceIn(0f, 1f)
            Box(
                Modifier
                    .offset(x = at - TICK_WIDTH / 2)
                    .size(TICK_WIDTH, TICK_HEIGHT)
                    .clip(RoundedCornerShape(TICK_WIDTH))
                    .background(MaterialTheme.colorScheme.onSurface),
            )
        }
    }
}

/** "17–19 of 30" at a row's end, or what stands for it while it isn't measured, or is graded by level. */
@Composable
fun PointsValue(
    low: Double?,
    high: Double?,
    max: Double?,
    decimals: Int,
    modifier: Modifier = Modifier,
    levels: Boolean = false,
) {
    val measured = low != null && high != null && max != null
    Text(
        when {
            low != null && high != null && max != null -> {
                stringResource(R.string.essay_points_of, pointsRange(low, high, decimals), formatPoints(max, currentLocale(), decimals))
            }

            levels -> {
                stringResource(R.string.essay_graded_by_level)
            }

            else -> {
                stringResource(R.string.essay_not_measured)
            }
        },
        modifier,
        color = if (measured) MaterialTheme.colorScheme.onSurface else MaterialTheme.colorScheme.onSurfaceVariant,
        style = if (measured) MaterialTheme.typography.labelMedium.withTabularFigures() else MaterialTheme.typography.bodySmall,
    )
}

private const val MAX_FIXED_DECIMALS = 2
private const val PERCENT = 100.0
private const val FLOAT_SLACK = 1e-9
private val METER_HEIGHT = 6.dp
private val TICK_HEIGHT = 14.dp
private val TICK_WIDTH = 2.dp
private const val MAYBE_ALPHA = 0.4f
