package com.zoonk.android.ui.components

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.tween
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.formatNumber
import com.zoonk.android.ui.theme.ZoonkMotion
import com.zoonk.android.ui.theme.withTabularFigures
import com.zoonk.android.ui.theme.zoonk
import kotlin.math.ceil

data class MomentScore(
    val answered: Int,
    val correct: Int,
)

/**
 * Main's `MomentReadouts`: how many were right and the Brain Power earned as large numbers among
 * small words, then the moment's [facts]. Shows nothing when there's nothing to tell.
 */
@Composable
fun MomentReadouts(
    brainPower: Long,
    modifier: Modifier = Modifier,
    score: MomentScore? = null,
    facts: List<String> = emptyList(),
) {
    val shownScore = score?.takeIf { it.answered > 0 }
    val earned = brainPower > 0

    if (shownScore == null && !earned && facts.isEmpty()) return

    Column(modifier, verticalArrangement = Arrangement.spacedBy(12.dp)) {
        if (shownScore != null || earned) {
            FlowRow(horizontalArrangement = Arrangement.spacedBy(32.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                shownScore?.let { ScoreReadout(it) }
                if (earned) BrainPowerReadout(brainPower)
            }
        }
        facts.forEach { fact ->
            Text(fact, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodyMedium)
        }
    }
}

@Composable
private fun ScoreReadout(score: MomentScore) {
    val locale = currentLocale()
    val number = formatNumber(score.correct.toDouble(), locale)
    val sentence = pluralStringResource(R.plurals.moment_score, score.correct, MARK, formatNumber(score.answered.toDouble(), locale))

    Readout(sentence, number, MaterialTheme.colorScheme.onSurface)
}

@Composable
private fun BrainPowerReadout(points: Long) {
    val locale = currentLocale()
    val shown = countedUp(points)
    val sentence = stringResource(R.string.moment_brain_power, MARK).replace("+$MARK", MARK)

    Readout(sentence, "+" + formatNumber(shown.toDouble(), locale), MaterialTheme.zoonk.brainText)
}

/** The sentence's words small and muted, its number large, wherever the language puts it. */
@Composable
private fun Readout(
    sentence: String,
    number: String,
    color: Color,
) {
    val words = MaterialTheme.typography.labelLarge
    val large = MaterialTheme.typography.displaySmall.withTabularFigures()
    val (before, after) = sentence.split(MARK, limit = 2).let { it.first() to it.getOrElse(1) { "" } }

    Text(
        text =
            buildAnnotatedString {
                append(before)
                withStyle(
                    SpanStyle(
                        color = color,
                        fontSize = large.fontSize,
                        fontWeight = large.fontWeight,
                        fontFeatureSettings = large.fontFeatureSettings,
                    ),
                ) {
                    append(number)
                }
                append(after)
            },
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        style = words.copy(lineHeight = large.lineHeight),
    )
}

/** Counts up once where the moment celebrates; never shows zero for points earned. */
@Composable
private fun countedUp(value: Long): Long {
    val plays = celebrates()
    val shown = remember { Animatable(if (plays) 0f else value.toFloat()) }

    LaunchedEffect(value, plays) {
        if (plays) shown.animateTo(value.toFloat(), tween(COUNT_UP_MILLIS, easing = ZoonkMotion.EaseOut)) else shown.snapTo(value.toFloat())
    }

    return ceil(shown.value).toLong().coerceIn(1, value.coerceAtLeast(1))
}

private const val MARK = "⁣"

/** Main's `--transition-duration-fill`. */
private const val COUNT_UP_MILLIS = 700
