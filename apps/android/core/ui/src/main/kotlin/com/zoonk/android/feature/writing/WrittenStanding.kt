package com.zoonk.android.feature.writing

import androidx.annotation.DrawableRes
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.size
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.theme.zoonk
import com.zoonk.api.models.WrittenPartPoints
import com.zoonk.api.models.WrittenPartPointsMinimum

/** The part's minimum, unless its unit is one this version can't place: then it reads as having none. */
fun WrittenPartPoints.readableMinimum(): WrittenPartPointsMinimum? =
    minimum?.takeIf { it.unit != WrittenPartPointsMinimum.Unit.UNKNOWN_DEFAULT_OPEN_API }

fun WrittenPartPoints.minimumPoints(): Double? {
    val minimum = readableMinimum() ?: return null
    if (minimum.unit != WrittenPartPointsMinimum.Unit.PERCENT) return minimum.value
    return max?.let { minimum.value / PERCENT * it }
}

/**
 * A written part's estimate against its own minimum, as Main's `WrittenStandingLine` says it. Each verdict is
 * "likely": it comes from how closely graders' marks match the board's, never a promise, so it never says by how
 * much; the estimate beside it shows the gap. Without one, an estimate beside a minimum would read as a pass, so the
 * line says it can't tell.
 */
@Composable
fun WrittenStandingLine(part: WrittenPartPoints) {
    if (part.range == null) return
    val minimum = part.minimumPoints() ?: return
    val points = formatPoints(minimum, currentLocale())
    val muted = MaterialTheme.colorScheme.onSurfaceVariant

    when (part.standing) {
        WrittenPartPoints.Standing.MET -> {
            StandingLine(
                stringResource(R.string.plan_written_above_minimum, points),
                muted,
                R.drawable.ic_check,
                MaterialTheme.colorScheme.tertiary,
            )
        }

        WrittenPartPoints.Standing.BELOW -> {
            val error = MaterialTheme.colorScheme.error
            StandingLine(stringResource(R.string.plan_written_likely_below, points), error, R.drawable.ic_close, error)
        }

        WrittenPartPoints.Standing.OVERLAPS -> {
            val warning = MaterialTheme.zoonk.warningText
            StandingLine(stringResource(R.string.plan_written_close_to_minimum, points), warning, R.drawable.ic_warning, warning)
        }

        WrittenPartPoints.Standing.UNMEASURED -> {
            StandingLine(stringResource(R.string.plan_written_cant_say, points), muted)
        }

        WrittenPartPoints.Standing.UNKNOWN_DEFAULT_OPEN_API, null -> {}
    }
}

@Composable
private fun StandingLine(
    text: String,
    color: Color,
    @DrawableRes icon: Int? = null,
    tint: Color = color,
) {
    Row(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
        icon?.let { Icon(painterResource(it), null, Modifier.size(14.dp), tint = tint) }
        Text(text, color = color, style = MaterialTheme.typography.bodySmall)
    }
}

private const val PERCENT = 100.0
