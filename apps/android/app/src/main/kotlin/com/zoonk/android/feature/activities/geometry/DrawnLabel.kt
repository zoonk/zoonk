package com.zoonk.android.feature.activities.geometry

import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Fill
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.text.TextLayoutResult
import androidx.compose.ui.text.drawText
import androidx.compose.ui.unit.dp

internal enum class LabelAnchor { Start, Middle, End }

/** Main's haloed drawing label: centered on [at]'s line and ringed in [halo], so it reads over the marks under it. */
internal fun DrawScope.drawLabel(
    text: TextLayoutResult,
    at: Offset,
    color: Color,
    halo: Color,
    anchor: LabelAnchor = LabelAnchor.Middle,
) {
    val width = text.size.width.toFloat()
    val left =
        when (anchor) {
            LabelAnchor.Start -> at.x
            LabelAnchor.Middle -> at.x - width / 2
            LabelAnchor.End -> at.x - width
        }
    val topLeft = Offset(left, at.y - text.size.height / 2f)
    drawText(text, halo, topLeft, drawStyle = Stroke(HALO_WIDTH.toPx(), join = StrokeJoin.Round))
    // Without a style, drawText keeps the paint's last one, so the text would be stroked like its halo.
    drawText(text, color, topLeft, drawStyle = Fill)
}

private val HALO_WIDTH = 4.dp
