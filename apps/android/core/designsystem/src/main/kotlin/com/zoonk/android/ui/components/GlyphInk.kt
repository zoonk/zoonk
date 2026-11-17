package com.zoonk.android.ui.components

import android.graphics.Canvas
import androidx.annotation.DrawableRes
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.layout
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalResources
import androidx.core.content.res.ResourcesCompat
import androidx.core.graphics.createBitmap
import androidx.core.graphics.get
import kotlin.math.roundToInt

internal val LocalMarkEdge = staticCompositionLocalOf<ButtonEdge?> { null }

/** A symbol's viewport includes empty room; column edges follow its painted pixels. */
@Composable
fun Modifier.glyphInk(
    @DrawableRes id: Int,
    edge: ButtonEdge = ButtonEdge.Start,
): Modifier {
    val resources = LocalResources.current
    val configuration = LocalConfiguration.current
    val theme = LocalContext.current.theme
    val bounds =
        remember(resources, configuration, theme, id) {
            val bitmap = createBitmap(96, 96)
            val drawable = ResourcesCompat.getDrawable(resources, id, theme)!!.mutate()
            drawable.setBounds(0, 0, 96, 96)
            drawable.draw(Canvas(bitmap))
            var left = 96
            var right = 0
            for (y in 0 until 96) {
                for (x in 0 until 96) {
                    if (bitmap[x, y].ushr(24) != 0) {
                        left = minOf(left, x)
                        right = maxOf(right, x + 1)
                    }
                }
            }
            bitmap.recycle()
            if (right > left) left / 96f to (96 - right) / 96f else 0f to 0f
        }
    return layout { measurable, constraints ->
        val placeable = measurable.measure(constraints)
        val inset = (placeable.width * if (edge == ButtonEdge.Start) bounds.first else bounds.second).roundToInt()
        layout(placeable.width - inset, placeable.height) {
            placeable.placeRelative(if (edge == ButtonEdge.Start) -inset else 0, 0)
        }
    }
}
