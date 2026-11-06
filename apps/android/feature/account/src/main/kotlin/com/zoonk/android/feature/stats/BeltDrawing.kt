package com.zoonk.android.feature.stats

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.wrapContentWidth
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.geometry.RoundRect
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.scale
import androidx.compose.ui.graphics.drawscope.translate
import androidx.compose.ui.graphics.luminance
import androidx.compose.ui.layout.layout
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.zoonk.android.R
import com.zoonk.android.ui.components.Belt
import com.zoonk.android.ui.components.color
import com.zoonk.android.ui.components.rankBar
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.formatNumber
import com.zoonk.android.ui.theme.GeistMono
import com.zoonk.android.ui.theme.ZoonkRadius
import com.zoonk.android.ui.theme.zoonk

/**
 * Main's `BeltDrawing`, for the eye only (the words above it name the belt and level): the belt in
 * its color with its stitching, its dark rank bar holding the ten levels as stripes (those reached
 * white, the next filling with Brain Power by [share]) over their numbers, and its tail.
 */
@Composable
internal fun BeltDrawing(
    belt: Belt,
    level: Int,
    share: Float?,
    modifier: Modifier = Modifier,
) {
    val locale = currentLocale()
    val ink = MaterialTheme.colorScheme.onSurface
    val faint = MaterialTheme.zoonk.faint
    val dark = MaterialTheme.colorScheme.background.luminance() < HALF
    val color = if (belt == Belt.Black) Color.Black else belt.color
    val edge =
        when {
            belt == Belt.White -> ink.copy(alpha = WHITE_EDGE_ALPHA)
            belt == Belt.Black && dark -> Color.White.copy(alpha = BLACK_EDGE_ALPHA)
            else -> Color.Transparent
        }
    val stitch = if (belt in LIGHT_BELTS) Color.Black.copy(alpha = LIGHT_STITCH_ALPHA) else Color.White.copy(alpha = DARK_STITCH_ALPHA)

    Column(modifier.fillMaxWidth().clearAndSetSemantics {}, verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Row(Modifier.fillMaxWidth().height(BELT_HEIGHT)) {
            Box(Modifier.weight(BAND_SHARE).fillMaxHeight().drawBehind { band(color, edge, stitch, 0.dp, 8.dp, rounded = false) })
            Row(
                Modifier
                    .weight(RANK_SHARE)
                    .fillMaxHeight()
                    .drawBehind { drawRect(belt.rankBar) }
                    .padding(horizontal = TICKS_INSET),
                horizontalArrangement = Arrangement.SpaceBetween,
            ) {
                repeat(LEVELS_PER_BELT) { index ->
                    RankStripe(reached = index < level, share = share.takeIf { index == level })
                }
            }
            Box(Modifier.weight(TAIL_SHARE).fillMaxHeight().drawBehind { band(color, edge, stitch, 8.dp, 10.dp, rounded = true) })
        }

        Row(Modifier.fillMaxWidth()) {
            Spacer(Modifier.weight(BAND_SHARE))
            Row(Modifier.weight(RANK_SHARE).padding(horizontal = TICKS_INSET), horizontalArrangement = Arrangement.SpaceBetween) {
                repeat(LEVELS_PER_BELT) { index ->
                    val current = index + 1 == level
                    Box(Modifier.width(TICK_WIDTH), contentAlignment = Alignment.Center) {
                        Text(
                            formatNumber(index + 1.0, locale),
                            modifier = Modifier.wrapContentWidth(unbounded = true),
                            color = if (current) ink else faint,
                            fontFamily = GeistMono,
                            fontSize = 10.sp,
                            lineHeight = 10.sp,
                            fontWeight = if (current) FontWeight.SemiBold else FontWeight.Normal,
                            maxLines = 1,
                            softWrap = false,
                        )
                    }
                }
            }
            Spacer(Modifier.weight(TAIL_SHARE))
        }
    }
}

/** A part of the belt in its color, hairlines along it for white (and for black in the dark), stitched from [stitchStart] to [stitchEnd] before its end. */
private fun DrawScope.band(
    color: Color,
    edge: Color,
    stitch: Color,
    stitchStart: Dp,
    stitchEnd: Dp,
    rounded: Boolean,
) {
    val hairline = 1.dp.toPx()
    val rtl = layoutDirection == LayoutDirection.Rtl
    val radius = if (rounded) ZoonkRadius.sm.toPx() else 0f
    val end = CornerRadius(radius)
    val path =
        Path().apply {
            addRoundRect(
                RoundRect(
                    rect = Rect(Offset.Zero, size),
                    topLeft = if (rtl) end else CornerRadius.Zero,
                    topRight = if (rtl) CornerRadius.Zero else end,
                    bottomRight = if (rtl) CornerRadius.Zero else end,
                    bottomLeft = if (rtl) end else CornerRadius.Zero,
                ),
            )
        }
    drawPath(path, color)
    if (edge != Color.Transparent) {
        if (rounded) {
            drawPath(path, edge, style = Stroke(hairline))
        } else {
            drawLine(edge, Offset(0f, hairline / 2), Offset(size.width, hairline / 2), hairline)
            drawLine(edge, Offset(0f, size.height - hairline / 2), Offset(size.width, size.height - hairline / 2), hairline)
        }
    }

    val from = if (rtl) stitchEnd.toPx() else stitchStart.toPx()
    val to = size.width - if (rtl) stitchStart.toPx() else stitchEnd.toPx()
    val dash = PathEffect.dashPathEffect(floatArrayOf(3.dp.toPx(), 3.dp.toPx()))
    listOf(size.height * STITCH_AT, size.height * (1 - STITCH_AT)).forEach { y ->
        drawLine(stitch, Offset(from, y), Offset(to, y), hairline, pathEffect = dash)
    }
}

/** Main's `RankStripe`: a reached level white, one ahead dark with a faint edge, the next one's edge brighter and filling from the bottom. */
@Composable
private fun RankStripe(
    reached: Boolean,
    share: Float?,
) {
    val brain = MaterialTheme.zoonk.brain

    Canvas(Modifier.width(TICK_WIDTH).fillMaxHeight().padding(vertical = 2.5.dp)) {
        val radius = CornerRadius(1.dp.toPx())
        if (reached) {
            drawRoundRect(Color.White, cornerRadius = radius)
            return@Canvas
        }
        drawRoundRect(Color.Black.copy(alpha = HALF), cornerRadius = radius)
        share?.let {
            val height = size.height * it.coerceIn(0f, 1f)
            drawRect(brain, Offset(0f, size.height - height), Size(size.width, height))
        }
        val ring = 1.dp.toPx()
        drawRoundRect(
            Color.White.copy(alpha = if (share == null) RING_ALPHA else NEXT_RING_ALPHA),
            Offset(ring / 2, ring / 2),
            Size(size.width - ring, size.height - ring),
            radius,
            style = Stroke(ring),
        )
    }
}

/**
 * Main's `BeltRack`: every belt in order, those earned tied and the rest folded, the current one
 * ringed, with the first and last belts named under the row.
 */
@Composable
internal fun BeltRack(current: Belt) {
    val ink = MaterialTheme.colorScheme.onSurface
    val faint = MaterialTheme.zoonk.faint
    val earned = stringResource(R.string.stats_belt_earned)
    val now = stringResource(R.string.stats_belt_current)

    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Row(Modifier.fillMaxWidth()) {
            Belt.entries.forEach { entry ->
                val name = stringResource(entry.label)
                Box(Modifier.weight(1f), contentAlignment = Alignment.Center) {
                    Box(
                        Modifier
                            .size(RACK_WIDTH, RACK_HEIGHT)
                            .then(if (entry == current) Modifier.border(1.5.dp, ink, RoundedCornerShape(ZoonkRadius.sm)) else Modifier)
                            .clearAndSetSemantics {
                                contentDescription = name
                                when {
                                    entry == current -> stateDescription = now
                                    entry < current -> stateDescription = earned
                                    else -> Unit
                                }
                            },
                        contentAlignment = Alignment.Center,
                    ) {
                        RackBelt(entry, tied = entry <= current)
                    }
                }
            }
        }

        Row(Modifier.fillMaxWidth().clearAndSetSemantics {}, horizontalArrangement = Arrangement.SpaceBetween) {
            Text(stringResource(Belt.entries.first().label), color = faint, style = MaterialTheme.typography.bodySmall)
            Text(stringResource(Belt.entries.last().label), color = faint, style = MaterialTheme.typography.bodySmall)
        }
    }
}

/** Main's rack belt: tied once earned, folded until then; white and black keep an outline where the page would swallow them. */
@Composable
private fun RackBelt(
    belt: Belt,
    tied: Boolean,
) {
    val dark = MaterialTheme.colorScheme.background.luminance() < HALF
    val fill = if (belt == Belt.Black && dark) Color.Black else belt.color
    val outline =
        when {
            belt == Belt.White && !dark -> MaterialTheme.colorScheme.onSurface.copy(alpha = HALF)
            belt == Belt.Black && dark -> Color.White.copy(alpha = HALF)
            else -> null
        }

    Canvas(Modifier.size(RACK_WIDTH * RACK_SHARE, RACK_HEIGHT * RACK_SHARE)) {
        val scale = minOf(size.width / RACK_BOX_WIDTH, size.height / RACK_BOX_HEIGHT)
        translate((size.width - RACK_BOX_WIDTH * scale) / 2, (size.height - RACK_BOX_HEIGHT * scale) / 2) {
            scale(scale, pivot = Offset.Zero) {
                val shapes = if (tied) TIED else FOLDED
                outline?.let { color -> shapes.forEach { drawPath(it, color, style = Stroke(RACK_OUTLINE)) } }
                shapes.forEach { drawPath(it, fill) }
            }
        }
    }
}

/** Reaches [amount] past its column's start, as main's belt reaches its panel's edge. */
internal fun Modifier.bleedStart(amount: Dp): Modifier =
    layout { measurable, constraints ->
        val extra = amount.roundToPx()
        val placeable =
            measurable.measure(
                constraints.copy(minWidth = constraints.minWidth + extra, maxWidth = constraints.maxWidth + extra),
            )
        layout(placeable.width - extra, placeable.height) { placeable.placeRelative(-extra, 0) }
    }

private fun roundRect(
    x: Float,
    y: Float,
    width: Float,
    height: Float,
    radius: Float,
) = Path().apply {
    addRoundRect(RoundRect(x, y, x + width, y + height, CornerRadius(radius)))
}

private fun polygon(vararg points: Float) =
    Path().apply {
        moveTo(points[0], points[1])
        for (index in 2 until points.size step 2) lineTo(points[index], points[index + 1])
        close()
    }

/** Main's shapes, in its 44 × 30 box. */
private val TIED =
    listOf(
        polygon(18.6f, 12.5f, 22.4f, 12.5f, 16.6f, 27.6f, 12.2f, 27.6f),
        polygon(21.6f, 12.5f, 25.4f, 12.5f, 31.8f, 27.6f, 27.4f, 27.6f),
        roundRect(1.5f, 6f, 41f, 8f, 2f),
        roundRect(17f, 3.5f, 10f, 13f, 3f),
    )
private val FOLDED =
    listOf(
        roundRect(5f, 7.5f, 34f, 7f, 2f),
        roundRect(5f, 15.5f, 34f, 7f, 2f),
        roundRect(31f, 7.5f, 8f, 15f, 2f),
    )
private const val RACK_BOX_WIDTH = 44f
private const val RACK_BOX_HEIGHT = 30f
private const val RACK_OUTLINE = 3f
private const val RACK_SHARE = 0.8f
private val RACK_WIDTH = 32.dp
private val RACK_HEIGHT = 26.dp

/** Main's belt on a phone: band, rank bar and tail at 36 : 52 : 12. */
private const val BAND_SHARE = 36f
private const val RANK_SHARE = 52f
private const val TAIL_SHARE = 12f
private val BELT_HEIGHT = 32.dp
private val TICKS_INSET = 10.dp
private val TICK_WIDTH = 4.dp
private const val STITCH_AT = 0.27f

private val LIGHT_BELTS = setOf(Belt.White, Belt.Yellow, Belt.Orange, Belt.Green)
private const val LIGHT_STITCH_ALPHA = 0.15f
private const val DARK_STITCH_ALPHA = 0.25f
private const val WHITE_EDGE_ALPHA = 0.4f
private const val BLACK_EDGE_ALPHA = 0.35f
private const val RING_ALPHA = 0.15f
private const val NEXT_RING_ALPHA = 0.35f
private const val HALF = 0.5f
private const val LEVELS_PER_BELT = 10
