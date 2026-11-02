package com.zoonk.android.ui.components

import androidx.compose.animation.core.CubicBezierEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.unit.dp

/**
 * A picture or recording still being made, in the space the made one takes so nothing moves when
 * it lands. Only its background pulses; [content] stays still.
 */
@Composable
fun MediaPending(
    modifier: Modifier = Modifier,
    content: @Composable ColumnScope.() -> Unit,
) {
    val color = MaterialTheme.colorScheme.surfaceContainerHigh
    val alpha by rememberInfiniteTransition(label = "pending media").animateFloat(
        initialValue = 1f,
        targetValue = PULSE_LOW_ALPHA,
        animationSpec = infiniteRepeatable(tween(PULSE_HALF_MS, easing = PULSE_EASING), RepeatMode.Reverse),
        label = "pending media alpha",
    )

    Column(
        modifier =
            modifier
                .clip(RoundedCornerShape(16.dp))
                .drawBehind { drawRect(color, alpha = alpha) }
                .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp, Alignment.CenterVertically),
        horizontalAlignment = Alignment.CenterHorizontally,
        content = content,
    )
}

/** Tailwind's `animate-pulse`, which main's skeletons use. */
private const val PULSE_HALF_MS = 1000
private const val PULSE_LOW_ALPHA = 0.5f
private val PULSE_EASING = CubicBezierEasing(0.4f, 0f, 0.6f, 1f)
