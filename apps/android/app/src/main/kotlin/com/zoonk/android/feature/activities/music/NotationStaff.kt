package com.zoonk.android.feature.activities.music

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.material3.LocalContentColor
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.BlendMode
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.CompositingStrategy
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.withTransform
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.TextLayoutResult
import androidx.compose.ui.text.TextMeasurer
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.drawText
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.rememberTextMeasurer
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.zoonk.android.ui.theme.withTabularFigures
import com.zoonk.android.ui.theme.zoonk

/**
 * A tune engraved on a staff, with guitar tab under it when [showsTab]. The note or rest [playing] returns is drawn in the
 * highlight color; it's read while drawing, so following a playback redraws without recomposing. The staff grows with the
 * text size, as a page of music would. It has no semantics: the screen describes the tune.
 */
@Composable
fun NotationStaff(
    tune: AbcTune,
    showsTab: Boolean,
    modifier: Modifier = Modifier,
    playing: () -> NotationElementId? = { null },
) {
    val density = LocalDensity.current
    val measurer = rememberTextMeasurer()
    val typography = MaterialTheme.typography
    val ink = LocalContentColor.current
    val highlight = MaterialTheme.zoonk.vizAccent

    BoxWithConstraints(modifier.fillMaxWidth()) {
        val drawn =
            remember(tune, showsTab, maxWidth, density, typography) {
                val styles =
                    TextStyles(
                        chordSymbol = typography.bodySmall,
                        tabFret = typography.labelSmall.copy(fontWeight = FontWeight.SemiBold).withTabularFigures(),
                        tupletNumber = typography.labelSmall.copy(fontStyle = FontStyle.Italic),
                        endingNumber = typography.labelSmall,
                    )
                val drawing =
                    with(density) {
                        NotationDrawing.of(
                            tune = tune,
                            width = maxWidth.value,
                            space = STAFF_SPACE.toDp().value,
                            tabSpace = TAB_SPACE.toDp().value.takeIf { showsTab },
                            textHeight =
                                styles.chordSymbol.lineHeight
                                    .toDp()
                                    .value,
                        )
                    }
                DrawnNotation(drawing, prepare(drawing, measurer, styles, density))
            }

        Canvas(
            Modifier
                .fillMaxWidth()
                .height(drawn.drawing.height.dp)
                // Tab numbers clear the lines under them, showing whatever the staff sits on.
                .graphicsLayer { compositingStrategy = CompositingStrategy.Offscreen },
        ) {
            val current = playing()
            drawn.marks.forEach { (mark, element) -> draw(mark, if (element != null && element == current) highlight else ink) }
        }
    }
}

private val STAFF_SPACE = 8.sp

/** abcjs's tab lines are a staff space and a half apart. */
private val TAB_SPACE = STAFF_SPACE * 1.5f

private class TextStyles(
    val chordSymbol: TextStyle,
    val tabFret: TextStyle,
    val tupletNumber: TextStyle,
    val endingNumber: TextStyle,
)

private class DrawnNotation(
    val drawing: NotationDrawing,
    val marks: List<Pair<Drawn, NotationElementId?>>,
)

/** A mark ready to draw in pixels: paths built and texts measured once, not on every frame of a playback. */
private sealed interface Drawn {
    class Glyph(
        val glyph: MusicGlyph,
        val offset: Offset,
        val scale: Float,
    ) : Drawn

    class Box(
        val rect: Rect,
    ) : Drawn

    class Fill(
        val path: Path,
    ) : Drawn

    class Line(
        val path: Path,
        val width: Float,
    ) : Drawn

    class Text(
        val layout: TextLayoutResult,
        val topLeft: Offset,
        val clears: Rect?,
    ) : Drawn
}

private fun prepare(
    drawing: NotationDrawing,
    measurer: TextMeasurer,
    styles: TextStyles,
    density: Density,
): List<Pair<Drawn, NotationElementId?>> {
    val pixels = density.density
    val shapes = drawing.items.filterNot { it.mark is NotationDrawing.Mark.Text }
    val texts = drawing.items.filter { it.mark is NotationDrawing.Mark.Text }

    // Texts go last, so no line crosses them.
    return (shapes + texts).map { item ->
        val drawn =
            when (val mark = item.mark) {
                is NotationDrawing.Mark.Glyph -> {
                    Drawn.Glyph(mark.glyph, Offset(mark.x, mark.y) * pixels, mark.scale * pixels)
                }

                is NotationDrawing.Mark.Box -> {
                    Drawn.Box(Rect(Offset(mark.left, mark.top) * pixels, Size(mark.width, mark.height) * pixels))
                }

                is NotationDrawing.Mark.Beam -> {
                    Drawn.Fill(
                        Path().apply {
                            mark.points.forEachIndexed { index, (x, y) ->
                                if (index == 0) moveTo(x * pixels, y * pixels) else lineTo(x * pixels, y * pixels)
                            }
                            close()
                        },
                    )
                }

                is NotationDrawing.Mark.Tie -> {
                    Drawn.Line(
                        Path().apply {
                            moveTo(mark.fromX * pixels, mark.y * pixels)
                            quadraticTo((mark.fromX + mark.toX) / 2 * pixels, mark.controlY * pixels, mark.toX * pixels, mark.y * pixels)
                        },
                        mark.width * pixels,
                    )
                }

                is NotationDrawing.Mark.Bracket -> {
                    Drawn.Line(
                        Path().apply {
                            mark.points.forEachIndexed { index, (x, y) ->
                                if (index == 0) moveTo(x * pixels, y * pixels) else lineTo(x * pixels, y * pixels)
                            }
                        },
                        mark.width * pixels,
                    )
                }

                is NotationDrawing.Mark.Text -> {
                    text(mark, measurer, styles, density)
                }
            }

        drawn to item.element
    }
}

private fun text(
    mark: NotationDrawing.Mark.Text,
    measurer: TextMeasurer,
    styles: TextStyles,
    density: Density,
): Drawn.Text {
    val style =
        when (mark.kind) {
            NotationDrawing.TextKind.ChordSymbol -> styles.chordSymbol
            NotationDrawing.TextKind.TabFret -> styles.tabFret
            NotationDrawing.TextKind.TupletNumber -> styles.tupletNumber
            NotationDrawing.TextKind.EndingNumber -> styles.endingNumber
        }
    val layout = measurer.measure(mark.text, style, density = density)
    val size = Size(layout.size.width.toFloat(), layout.size.height.toFloat())
    val point = Offset(mark.x, mark.y) * density.density
    val topLeft =
        when (mark.kind) {
            NotationDrawing.TextKind.ChordSymbol -> point - Offset(0f, size.height)
            NotationDrawing.TextKind.TabFret, NotationDrawing.TextKind.TupletNumber -> point - Offset(size.width / 2, size.height / 2)
            NotationDrawing.TextKind.EndingNumber -> point
        }
    val margin = with(density) { 1.dp.toPx() }
    val clears =
        if (mark.kind ==
            NotationDrawing.TextKind.TabFret
        ) {
            Rect(topLeft - Offset(margin, 0f), Size(size.width + margin * 2, size.height))
        } else {
            null
        }

    return Drawn.Text(layout, topLeft, clears)
}

private fun DrawScope.draw(
    drawn: Drawn,
    color: Color,
) {
    when (drawn) {
        is Drawn.Glyph -> {
            withTransform({
                translate(drawn.offset.x, drawn.offset.y)
                scale(drawn.scale, drawn.scale, Offset.Zero)
            }) { drawPath(drawn.glyph.path, color) }
        }

        is Drawn.Box -> {
            drawRect(color, drawn.rect.topLeft, drawn.rect.size)
        }

        is Drawn.Fill -> {
            drawPath(drawn.path, color)
        }

        is Drawn.Line -> {
            drawPath(drawn.path, color, style = Stroke(drawn.width, cap = StrokeCap.Round))
        }

        is Drawn.Text -> {
            drawn.clears?.let { drawRect(color, it.topLeft, it.size, blendMode = BlendMode.Clear) }
            drawText(drawn.layout, color, drawn.topLeft)
        }
    }
}
