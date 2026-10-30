package com.zoonk.android.ui.components

import androidx.compose.foundation.ScrollState
import androidx.compose.foundation.horizontalScroll
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.graphics.BlendMode
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.CompositingStrategy
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import kotlin.math.min

/**
 * Main's `scroll-fade-x`: scrolls sideways and fades the start or end only while there's more to
 * scroll that way, each fade growing over the first stretch of scroll toward it.
 */
fun Modifier.fadingHorizontalScroll(state: ScrollState): Modifier =
    graphicsLayer(compositingStrategy = CompositingStrategy.Offscreen)
        .drawWithContent {
            drawContent()
            val width = size.width
            val fade = min(width * FADE_SHARE, FADE_WIDTH.toPx())
            val reveal = REVEAL.toPx()
            val start = fade * min(1f, state.value / reveal)
            val end = fade * min(1f, (state.maxValue - state.value) / reveal)
            if (width <= 0f || (start <= 0f && end <= 0f)) return@drawWithContent
            val (left, right) = if (layoutDirection == LayoutDirection.Rtl) end to start else start to end
            drawRect(
                Brush.horizontalGradient(
                    0f to Color.Transparent,
                    left / width to Color.Black,
                    (width - right) / width to Color.Black,
                    1f to Color.Transparent,
                ),
                blendMode = BlendMode.DstIn,
            )
        }.horizontalScroll(state)

private const val FADE_SHARE = 0.12f
private val FADE_WIDTH = 40.dp
private val REVEAL = 96.dp
