package com.zoonk.android.feature.stats

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
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
 * Main's `BeltRack`: every belt in order in equal columns, those earned tied and the rest folded, the
 * current one ringed and named under it (every belt named where the row has room), then a key to the two shapes.
 */
@Composable
internal fun BeltRack(current: Belt) {
    val ink = MaterialTheme.colorScheme.onSurface
    val earned = stringResource(R.string.stats_belt_earned)
    val coming = stringResource(R.string.stats_belt_coming)
    val now = stringResource(R.string.stats_belt_current)

    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        BoxWithConstraints {
            val namesAll = maxWidth >= NAMED_RACK_WIDTH

            Row(Modifier.fillMaxWidth()) {
                Belt.entries.forEach { entry ->
                    val name = stringResource(entry.label)
                    val tied = entry <= current

                    Column(
                        Modifier.weight(1f).clearAndSetSemantics {
                            contentDescription = name
                            stateDescription =
                                when {
                                    entry == current -> now
                                    tied -> earned
                                    else -> coming
                                }
                        },
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.spacedBy(6.dp),
                    ) {
                        Box(
                            Modifier
                                .size(RACK_WIDTH, RACK_HEIGHT)
                                .then(if (entry == current) Modifier.border(1.5.dp, ink, RoundedCornerShape(ZoonkRadius.sm)) else Modifier),
                            contentAlignment = Alignment.Center,
                        ) {
                            RackBelt(entry, tied, Modifier.fillMaxSize(RACK_FILL))
                        }
                        if (namesAll || entry == current) {
                            Text(
                                stringResource(entry.shortLabel),
                                color =
                                    when {
                                        entry == current -> ink
                                        tied -> MaterialTheme.colorScheme.onSurfaceVariant
                                        else -> MaterialTheme.zoonk.faint
                                    },
                                style = MaterialTheme.typography.labelSmall,
                                fontWeight = if (entry == current) FontWeight.Medium else null,
                                maxLines = 1,
                                softWrap = false,
                            )
                        }
                    }
                }
            }
        }

        Row(Modifier.clearAndSetSemantics {}, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            RackKey(earned, tied = true)
            RackKey(coming, tied = false)
        }
    }
}

@Composable
private fun RackKey(
    label: String,
    tied: Boolean,
) {
    Row(horizontalArrangement = Arrangement.spacedBy(4.dp), verticalAlignment = Alignment.CenterVertically) {
        RackBelt(Belt.Gray, tied, Modifier.size(KEY_SIZE))
        Text(label, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodySmall)
    }
}

/** Main's rack belt: tied once earned, folded until then; white and black keep an outline where the page would swallow them. */
@Composable
private fun RackBelt(
    belt: Belt,
    tied: Boolean,
    modifier: Modifier = Modifier,
) {
    val dark = MaterialTheme.colorScheme.background.luminance() < HALF
    val fill = if (belt == Belt.Black && dark) Color.Black else belt.color
    val outline =
        when {
            belt == Belt.White && !dark -> MaterialTheme.colorScheme.onSurface.copy(alpha = HALF)
            belt == Belt.Black && dark -> Color.White.copy(alpha = HALF)
            else -> null
        }
    val shapes = if (tied) TIED else FOLDED
    val box = if (tied) TIED_BOX else FOLDED_BOX

    Canvas(modifier) {
        val scale = minOf(size.width / box.width, size.height / box.height)
        translate((size.width - box.width * scale) / 2, (size.height - box.height * scale) / 2) {
            scale(scale, pivot = Offset.Zero) {
                translate(-box.left, -box.top) {
                    outline?.let { color -> shapes.forEach { drawPath(it, color, style = Stroke(RACK_OUTLINE)) } }
                    shapes.forEach { drawPath(it, fill) }
                }
            }
        }
    }
}

/** A belt's one-word name under it in the rack, as main's: "Yellow". */
private val Belt.shortLabel: Int
    get() =
        when (this) {
            Belt.White -> R.string.stats_belt_white
            Belt.Yellow -> R.string.stats_belt_yellow
            Belt.Orange -> R.string.stats_belt_orange
            Belt.Green -> R.string.stats_belt_green
            Belt.Blue -> R.string.stats_belt_blue
            Belt.Purple -> R.string.stats_belt_purple
            Belt.Brown -> R.string.stats_belt_brown
            Belt.Red -> R.string.stats_belt_red
            Belt.Gray -> R.string.stats_belt_gray
            Belt.Black -> R.string.stats_belt_black
        }

private fun polygon(vararg points: Float) =
    Path().apply {
        moveTo(points[0], points[1])
        for (i in 2 until points.size step 2) lineTo(points[i], points[i + 1])
        close()
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

/** Main's rack shapes and the boxes they're drawn in, so a tied belt and a folded one stand at one height. */
private val TIED =
    listOf(
        polygon(18.6f, 12.5f, 22.4f, 12.5f, 16.6f, 27.6f, 12.2f, 27.6f),
        polygon(21.6f, 12.5f, 25.4f, 12.5f, 31.8f, 27.6f, 27.4f, 27.6f),
        roundRect(1.5f, 6f, 41f, 8f, 2f),
        roundRect(17f, 3.5f, 10f, 13f, 3f),
    )
private val TIED_BOX = Rect(0f, 0f, 44f, 30f)
private val FOLDED =
    listOf(
        roundRect(5f, 7.5f, 34f, 7f, 2f),
        roundRect(5f, 15.5f, 34f, 7f, 2f),
        roundRect(31f, 7.5f, 8f, 15f, 2f),
    )
private val FOLDED_BOX = Rect(3.5f, 0f, 40.5f, 30f)
private const val RACK_OUTLINE = 3f
private const val RACK_FILL = 0.8f
private val RACK_WIDTH = 32.dp
private val RACK_HEIGHT = 26.dp
private val KEY_SIZE = 20.dp

/** Wide enough for every belt's one-word name under it, as main shows them from `md`. */
private val NAMED_RACK_WIDTH = 480.dp

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
