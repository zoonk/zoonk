package com.zoonk.android.feature.plan

import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.stringResource
import com.zoonk.android.R
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.formatNumber
import kotlin.math.roundToInt

/** Main's `WeekGain`: how far preparation moved this week, a rise in the success color. */
class WeekGain(
    val text: String,
    val color: Color,
)

/** Null when preparation didn't move this week; [gain] is a share, 0.05 for 5 points. */
@Composable
fun weekGain(gain: Double): WeekGain? {
    val points = (gain * PERCENT).roundToInt()
    if (points == 0) return null
    val shown = formatNumber(points.toDouble(), currentLocale())
    return if (points > 0) {
        WeekGain(stringResource(R.string.today_week_gain, shown), MaterialTheme.colorScheme.onTertiaryContainer)
    } else {
        WeekGain(stringResource(R.string.today_week_loss, shown), MaterialTheme.colorScheme.onSurfaceVariant)
    }
}

private const val PERCENT = 100
