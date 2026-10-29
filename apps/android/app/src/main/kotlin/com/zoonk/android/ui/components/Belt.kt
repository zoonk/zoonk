package com.zoonk.android.ui.components

import androidx.annotation.StringRes
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.size
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.ReadOnlyComposable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.formatNumber
import com.zoonk.android.ui.theme.ZoonkMotion
import com.zoonk.android.ui.theme.withTabularFigures
import com.zoonk.android.ui.theme.zoonk

enum class Belt(
    @param:StringRes val label: Int,
) {
    White(R.string.belt_white),
    Yellow(R.string.belt_yellow),
    Orange(R.string.belt_orange),
    Green(R.string.belt_green),
    Blue(R.string.belt_blue),
    Purple(R.string.belt_purple),
    Brown(R.string.belt_brown),
    Red(R.string.belt_red),
    Gray(R.string.belt_gray),
    Black(R.string.belt_black),
}

/** Full strength in every scheme: a belt is the learner's identity, not a meaning. */
val Belt.color: Color
    @Composable
    @ReadOnlyComposable
    get() =
        with(MaterialTheme.zoonk) {
            when (this@color) {
                Belt.White -> beltWhite
                Belt.Yellow -> beltYellow
                Belt.Orange -> beltOrange
                Belt.Green -> beltGreen
                Belt.Blue -> beltBlue
                Belt.Purple -> beltPurple
                Belt.Brown -> beltBrown
                Belt.Red -> beltRed
                Belt.Gray -> beltGray
                Belt.Black -> beltBlack
            }
        }

@Composable
fun BeltDot(
    belt: Belt,
    modifier: Modifier = Modifier,
) {
    val color = belt.color
    val edge = MaterialTheme.colorScheme.onSurface.copy(alpha = EDGE_ALPHA)

    Canvas(modifier.size(markSize() * BELT_DOT_SHARE)) {
        val hairline = 1.dp.toPx()
        drawCircle(color)
        drawCircle(edge, radius = (size.minDimension - hairline) / 2, style = Stroke(hairline))
    }
}

/** Read as "Yellow belt, level 3"; the button around it says where it goes (`onClickLabel`). */
@Composable
fun BeltLevel(
    belt: Belt,
    level: Int,
    modifier: Modifier = Modifier,
) {
    val name = stringResource(belt.label)
    val number = formatNumber(level.toDouble(), currentLocale())
    val description = stringResource(R.string.belt_level, name, number)

    Row(
        modifier = modifier.clearAndSetSemantics { contentDescription = description },
        horizontalArrangement = Arrangement.spacedBy(6.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        BeltDot(belt)
        Text(
            text = number,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            style = MaterialTheme.typography.labelLarge.withTabularFigures(),
        )
    }
}

/**
 * A belt's ten levels, those reached in its color; with [fillsLast] the level just reached fills in
 * after [delayMillis], when the screen celebrates.
 */
@Composable
fun BeltTicks(
    belt: Belt,
    level: Int,
    modifier: Modifier = Modifier,
    fillsLast: Boolean = false,
    delayMillis: Int = 0,
) {
    // A white tick would vanish on the page, so it's ink.
    val color = if (belt == Belt.White) MaterialTheme.colorScheme.onSurface.copy(alpha = WHITE_TICK_ALPHA) else belt.color
    val animates = fillsLast && celebrates()
    val last = remember { Animatable(if (animates) 0f else 1f) }
    LaunchedEffect(animates) {
        if (animates) last.animateTo(1f, tween(ZoonkMotion.BEAT_MILLIS * 2, delayMillis, ZoonkMotion.EaseOut))
    }

    MeterParts(
        parts =
            List(LEVELS_PER_BELT) { index ->
                when {
                    index == level - 1 && fillsLast -> MeterPart(MeterPart.Fill.Solid(color, last.value))
                    index < level -> MeterPart(MeterPart.Fill.Solid(color))
                    else -> MeterPart(MeterPart.Fill.Track)
                }
            },
        modifier = modifier,
    )
}

private const val LEVELS_PER_BELT = 10
private const val WHITE_TICK_ALPHA = 0.7f

private const val BELT_DOT_SHARE = 0.45f

/** Enough edge for white on a light page and black on a dark one. */
private const val EDGE_ALPHA = 0.25f
