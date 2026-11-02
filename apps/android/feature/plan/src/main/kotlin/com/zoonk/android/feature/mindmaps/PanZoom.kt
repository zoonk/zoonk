package com.zoonk.android.feature.mindmaps

import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import kotlin.math.min

/** Main's `pan-zoom.ts`: [x] and [y] are pixels from the frame's middle, the map fitted at scale 1. */
data class PanZoom(
    val scale: Float = 1f,
    val x: Float = 0f,
    val y: Float = 0f,
) {
    companion object {
        val FIT = PanZoom()

        /** Small print reads at about four times the fitted size; further only blurs. */
        const val MAX_SCALE = 5f
        const val ZOOM_STEP = 1.6f
        const val DOUBLE_TAP_SCALE = 2.5f
    }
}

fun fitSide(frame: Size): Float = min(frame.width, frame.height).coerceAtLeast(0f)

fun PanZoom.clamped(frame: Size): PanZoom {
    val scale = scale.coerceIn(1f, PanZoom.MAX_SCALE)
    val side = fitSide(frame) * scale
    val maxX = ((side - frame.width) / 2).coerceAtLeast(0f)
    val maxY = ((side - frame.height) / 2).coerceAtLeast(0f)
    return PanZoom(scale, x.coerceIn(-maxX, maxX), y.coerceIn(-maxY, maxY))
}

/** Keeps the spot under [point] (from the frame's middle) where it is. */
fun PanZoom.zoomAt(
    frame: Size,
    point: Offset,
    scale: Float,
): PanZoom {
    val next = scale.coerceIn(1f, PanZoom.MAX_SCALE)
    val ratio = next / this.scale
    return PanZoom(next, point.x - (point.x - x) * ratio, point.y - (point.y - y) * ratio).clamped(frame)
}

fun PanZoom.panBy(
    frame: Size,
    delta: Offset,
): PanZoom = copy(x = x + delta.x, y = y + delta.y).clamped(frame)
