package com.zoonk.android.ui.components

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp

/**
 * One band per CEFR level, A1 to C2, filled up to [score] (0 for A1 to 5 for C2, in half steps).
 * Hidden from TalkBack, since the level's label beside it says it.
 */
@Composable
fun LevelBar(
    score: Double,
    modifier: Modifier = Modifier,
) {
    val track = MaterialTheme.colorScheme.surfaceContainerHighest
    val fill = MaterialTheme.colorScheme.tertiary
    val rtl = LocalLayoutDirection.current == LayoutDirection.Rtl

    Canvas(modifier.fillMaxWidth().height(BAR_HEIGHT).clearAndSetSemantics {}) {
        val gap = BAND_GAP.toPx()
        val radius = CornerRadius(BAND_CORNER.toPx())
        val width = (size.width - gap * (BAND_COUNT - 1)) / BAND_COUNT

        repeat(BAND_COUNT) { band ->
            val offset = band * (width + gap)
            val left = if (rtl) size.width - offset - width else offset
            drawRoundRect(track, Offset(left, 0f), Size(width, size.height), radius)
            val filled = width * bandFill(band, score)
            if (filled > 0f) {
                drawRoundRect(fill, Offset(if (rtl) left + width - filled else left, 0f), Size(filled, size.height), radius)
            }
        }
    }
}

/** A plain level fills half of its band and a plus all of it, so B1 is half of the B1 band and C2 the whole bar. */
internal fun levelShare(score: Double): Double = if (score >= MAX_SCORE) 1.0 else ((score + HALF_BAND) / BAND_COUNT).coerceAtLeast(0.0)

internal fun bandFill(
    band: Int,
    score: Double,
): Float = (levelShare(score) * BAND_COUNT - band).coerceIn(0.0, 1.0).toFloat()

private const val BAND_COUNT = 6
private const val MAX_SCORE = BAND_COUNT - 1.0
private const val HALF_BAND = 0.5
private val BAR_HEIGHT = 4.dp
private val BAND_GAP = 3.dp
private val BAND_CORNER = 2.dp
