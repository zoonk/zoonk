package com.zoonk.android.feature.activities.sorting

import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.unit.dp

/** Main's `border-dashed` on a 12dp rounded card. */
internal fun Modifier.dashedOutline(color: Color) =
    drawBehind {
        drawRoundRect(
            color,
            cornerRadius = CornerRadius(12.dp.toPx()),
            style = Stroke(1.dp.toPx(), pathEffect = PathEffect.dashPathEffect(floatArrayOf(4.dp.toPx(), 4.dp.toPx()))),
        )
    }
