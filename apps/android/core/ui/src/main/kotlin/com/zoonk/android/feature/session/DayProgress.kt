package com.zoonk.android.feature.session

import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import com.zoonk.android.ui.components.MeterPart
import com.zoonk.android.ui.components.MeterParts

/**
 * Today's session as one equal part per block, so the bar, the count and the percent agree. [held]
 * adds a part for time the day keeps for lessons not on the list yet, so the bar never looks full
 * while it waits for them.
 */
@Composable
fun DayProgress(
    fills: List<MeterPart.Fill>,
    held: Boolean,
    modifier: Modifier = Modifier,
    contentDescription: String? = null,
) {
    val parts = fills.map { MeterPart(it) } + listOfNotNull(MeterPart(MeterPart.Fill.Track).takeIf { held })
    MeterParts(parts, modifier, contentDescription)
}
