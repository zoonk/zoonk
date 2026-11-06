package com.zoonk.android.feature.player

import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawWithCache
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Canvas
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.ImageShader
import androidx.compose.ui.graphics.Paint
import androidx.compose.ui.graphics.ShaderBrush
import androidx.compose.ui.graphics.TileMode
import androidx.compose.ui.unit.dp
import com.zoonk.android.ui.theme.LocalMoreContrast
import kotlin.math.roundToInt

/**
 * A knowledge lesson's dotted paper (concept 2's "Lousa"): a quiet grid of dots behind its reading
 * screens and its map, drawn as one repeated tile. Questions keep a plain page, which reads as the
 * learner's turn. More contrast leaves the page plain, so nothing competes with the text.
 */
@Composable
internal fun Modifier.dottedPaper(): Modifier {
    if (LocalMoreContrast.current) return this
    val dot = MaterialTheme.colorScheme.outlineVariant

    return drawWithCache {
        val step = DOT_SPACING.toPx().roundToInt().coerceAtLeast(1)
        val tile = ImageBitmap(step, step)
        Canvas(tile).drawCircle(Offset(step / 2f, step / 2f), DOT_RADIUS.toPx(), Paint().apply { color = dot })
        val paper = ShaderBrush(ImageShader(tile, TileMode.Repeated, TileMode.Repeated))
        onDrawBehind { drawRect(paper) }
    }
}

private val DOT_SPACING = 20.dp
private val DOT_RADIUS = 1.2.dp
