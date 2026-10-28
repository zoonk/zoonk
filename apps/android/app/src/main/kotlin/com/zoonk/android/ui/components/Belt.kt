package com.zoonk.android.ui.components

import androidx.annotation.StringRes
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.size
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.ReadOnlyComposable
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
import com.zoonk.android.ui.theme.withTabularFigures
import com.zoonk.android.ui.theme.zoonk

/** The ten belts in order, each with its full name ("Yellow belt"), as `@zoonk/utils/belt-level`. */
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

/** A belt's color: its full color in every scheme, the learner's identity. */
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

/**
 * The learner's belt as a dot in its color, with a hairline so white and black never vanish into
 * the page. Decorative: the words beside it, or the caller's description, name the belt.
 */
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

/**
 * The learner's belt and level as the top bar's level button and the account row show them: the
 * belt's dot and the level's number, read by TalkBack as "Yellow belt, level 3". The button around
 * it says where it goes (`onClickLabel`).
 */
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

private const val BELT_DOT_SHARE = 0.45f

/** Enough edge for white on a light page and black on a dark one, quiet on every other belt. */
private const val EDGE_ALPHA = 0.25f
