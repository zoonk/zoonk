package com.zoonk.android.feature.questions

import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.rememberUpdatedState

/**
 * Main's match keys on a hardware keyboard: the number keys pick cards down the left column, then the right (the tenth
 * with 0). [take] gives the keys to the board while it shows; [tap] taps a card and says whether it could.
 */
@Composable
fun MatchNumberKeys(
    take: (((Int) -> Boolean)?) -> Unit,
    count: Int,
    tap: (MatchSpot) -> Boolean,
) {
    val latestTap by rememberUpdatedState(tap)
    DisposableEffect(take, count) {
        take { index ->
            when (index) {
                in 0 until count -> latestTap(MatchSpot(MatchSide.Left, index))
                in count until count * 2 -> latestTap(MatchSpot(MatchSide.Right, index - count))
                else -> false
            }
        }
        onDispose { take(null) }
    }
}
