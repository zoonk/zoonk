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
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.ui.components.MeterPart
import com.zoonk.android.ui.components.MeterParts
import com.zoonk.android.ui.components.Readout
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.formatNumber
import com.zoonk.android.ui.theme.withTabularFigures
import java.util.Locale

/**
 * A range of points, one number when both ends round alike ("29.8", never "29.79–29.8"), and both
 * ends with the same decimals ("12.0–17.5", never "12–17.5").
 */
@Composable
fun pointsRange(
    low: Double,
    high: Double,
): String {
    val (from, to) = rangeEnds(low, high, currentLocale())
    return if (from == to) from else stringResource(R.string.essay_range, from, to)
}

/** What language errors take away, as a range like the rest: "−0.3 to −0.6", never "−0.3–0.6". */
@Composable
fun deductionRange(
    low: Double,
    high: Double,
): String {
    val (from, to) = rangeEnds(low, high, currentLocale())
    return when {
        high <= 0 -> from
        from == to -> stringResource(R.string.essay_minus, from)
        else -> stringResource(R.string.essay_minus_range, from, to)
    }
}

private fun rangeEnds(
    low: Double,
    high: Double,
    locale: Locale,
): Pair<String, String> {
    val decimals = if (listOf(low, high).any { Math.round(it * TENTHS) % TENTHS != 0L }) 1 else 0
    return formatNumber(low, locale, maximumFractionDigits = decimals, minimumFractionDigits = decimals) to
        formatNumber(high, locale, maximumFractionDigits = decimals, minimumFractionDigits = decimals)
}

fun formatPoints(
    value: Double,
    locale: Locale,
): String = formatNumber(value, locale, maximumFractionDigits = 1)

/** A block's one number: the range large, its scale small beside it ("54–61 of 100"). */
@Composable
fun PointsReadout(
    low: Double,
    high: Double,
    max: Double,
    modifier: Modifier = Modifier,
) {
    Readout(
        stringResource(R.string.essay_points_of, pointsRange(low, high), formatPoints(max, currentLocale())),
        modifier,
        style = MaterialTheme.typography.displaySmall,
    )
}

/**
 * The range on its scale: what it surely reaches solid, what it may reach lighter, and the rest as
 * track; [minimum] stands over it as a tick. With no [low] and [high] it's a dashed outline, so an
 * unmeasured part never reads as zero.
 */
@Composable
fun RangeMeter(
    low: Double?,
    high: Double?,
    max: Double,
    modifier: Modifier = Modifier,
    minimum: Double? = null,
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
        minimum?.let {
            val at = maxWidth * (it / max).toFloat().coerceIn(0f, 1f)
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

/** "17–19 of 30" at a row's end, or what stands for it while it isn't measured. */
@Composable
fun PointsValue(
    low: Double?,
    high: Double?,
    max: Double?,
    modifier: Modifier = Modifier,
) {
    val measured = low != null && high != null && max != null
    Text(
        if (low != null && high != null && max != null) {
            stringResource(R.string.essay_points_of, pointsRange(low, high), formatPoints(max, currentLocale()))
        } else {
            stringResource(R.string.essay_not_measured)
        },
        modifier,
        color = if (measured) MaterialTheme.colorScheme.onSurface else MaterialTheme.colorScheme.onSurfaceVariant,
        style = if (measured) MaterialTheme.typography.labelMedium.withTabularFigures() else MaterialTheme.typography.bodySmall,
    )
}

private const val TENTHS = 10
private val METER_HEIGHT = 6.dp
private val TICK_HEIGHT = 14.dp
private val TICK_WIDTH = 2.dp
private const val MAYBE_ALPHA = 0.4f
