package com.zoonk.android.feature.activities

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.Layout
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.ui.components.TICK_LABEL_GAP
import com.zoonk.android.ui.format.currencyUnit
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.displayDigits
import com.zoonk.android.ui.format.formatAmount
import com.zoonk.android.ui.theme.withTabularFigures
import com.zoonk.android.ui.theme.zoonk
import kotlin.math.abs
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt

/**
 * Main's `ActivityGuessReveal`: a guess on [scale], then, once checked, the [actual] value on the
 * same scale, how far off the guess was and what [explains] it.
 */
@Composable
fun ActivityGuessReveal(
    scale: GuessScale,
    unit: String?,
    guess: Double?,
    actual: Double?,
    props: ActivityProps,
    onGuessChange: (Double) -> Unit,
    explains: @Composable ColumnScope.() -> Unit,
) {
    val locale = currentLocale()
    val format = { value: Double -> formatAmount(value, locale, currencyUnit(unit)) }
    val revealed = actual.takeIf { props.isChecked }
    val description =
        if (revealed == null) {
            stringResource(R.string.activities_guess_scale, format(scale.min), format(scale.max))
        } else {
            stringResource(R.string.activities_guess_scale_revealed, format(scale.min), format(scale.max), format(revealed))
        }

    val unitLabel = guessUnitLabel(unit)
    ActivityCanvas(description = listOfNotNull(description, unitLabel).joinToString(" ")) {
        ActivityGuessScale(scale, unit, guess, revealed, disabled = props.isLocked, onGuessChange = onGuessChange)
        if (revealed != null) {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                if (guess != null) ActivityGuessComparison(revealed, guess, props.isCorrect == true, unit)
                explains()
            }
        }
    }
}

@Composable
fun ActivityGuessScale(
    scale: GuessScale,
    unit: String?,
    guess: Double?,
    actual: Double?,
    disabled: Boolean,
    onGuessChange: (Double) -> Unit,
) {
    val locale = currentLocale()
    val format = { value: Double -> formatAmount(value, locale, currencyUnit(unit)) }
    val share = guess?.let(scale::shareOf) ?: HALF
    val actualShare = actual?.let(scale::shareOf)
    val highlight = MaterialTheme.zoonk.vizHighlight
    val guessName = stringResource(R.string.activities_guess_slider)
    val unitLabel = guessUnitLabel(unit)
    val guessValue = listOfNotNull(guess?.let(format) ?: stringResource(R.string.activities_guess_none), unitLabel).joinToString(". ")

    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
        // The real value's row holds its room from the start, so the slider the learner just dragged stays put at Check.
        val shown = actual != null && actualShare != null
        AtShare(actualShare ?: HALF, if (shown) Modifier else Modifier.alpha(0f).clearAndSetSemantics {}) {
            ScaleChip(container = highlight.copy(alpha = SOFT), content = highlight) {
                Text(
                    stringResource(R.string.activities_guess_real_value, format(actual ?: scale.max)),
                    style =
                        MaterialTheme.typography.labelLarge
                            .withTabularFigures()
                            .copy(fontWeight = FontWeight.SemiBold),
                )
            }
        }
        AtShare(share) {
            ScaleChip(container = MaterialTheme.colorScheme.surface, content = MaterialTheme.colorScheme.onSurface, outlined = true) {
                Text(
                    if (guess ==
                        null
                    ) {
                        stringResource(R.string.activities_guess_drag)
                    } else {
                        stringResource(R.string.activities_guess_yours, format(guess))
                    },
                    style = MaterialTheme.typography.labelLarge.withTabularFigures(),
                )
            }
        }
        unitLabel?.let { ActivityCanvasLabel(it) }
        ActivitySliderTrack(
            position = (share * GuessScale.POSITIONS).roundToInt(),
            positions = GuessScale.POSITIONS,
            enabled = !disabled,
            modifier =
                Modifier.semantics {
                    contentDescription = guessName
                    stateDescription = guessValue
                },
            onPositionChange = { onGuessChange(twoSignificant(scale.valueAt(it))) },
            marks = {
                if (actualShare == null) return@ActivitySliderTrack
                val trackHeight = size.height
                // The slider runs right to left in RTL; drawn marks follow it.
                val x = { at: Double -> (if (layoutDirection == LayoutDirection.Rtl) 1 - at else at).toFloat() * size.width }
                if (guess != null) {
                    val from = min(x(share), x(actualShare))
                    val to = max(x(share), x(actualShare))
                    drawRoundRect(
                        highlight.copy(alpha = SOFT),
                        Offset(from, 0f),
                        Size(to - from, trackHeight),
                        CornerRadius(trackHeight / 2),
                    )
                }
                val center = Offset(x(actualShare), trackHeight / 2)
                drawCircle(highlight.copy(alpha = SOFT), radius = DOT.toPx() + RING.toPx(), center = center)
                drawCircle(highlight, radius = DOT.toPx(), center = center)
            },
        )
        ScaleTicks(scale, unit)
    }
}

@Composable
fun ActivityGuessComparison(
    actual: Double,
    guess: Double,
    isCorrect: Boolean,
    unit: String?,
) {
    val locale = currentLocale()
    val text =
        when (val comparison = compareGuess(actual, guess, isCorrect, unit)) {
            GuessComparison.Close -> {
                stringResource(R.string.activities_guess_close)
            }

            is GuessComparison.Off -> {
                stringResource(
                    R.string.activities_guess_off_by,
                    formatAmount(
                        abs(comparison.difference),
                        locale,
                        currencyUnit(unit),
                        maximumFractionDigits = displayDigits(actual, unit),
                    ),
                )
            }

            is GuessComparison.TooBig -> {
                stringResource(R.string.activities_guess_too_big, formatAmount(comparison.times, locale))
            }

            is GuessComparison.TooSmall -> {
                stringResource(R.string.activities_guess_too_small, formatAmount(comparison.times, locale))
            }
        }
    Text(text, style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.Medium))
}

@Composable
private fun ScaleChip(
    container: Color,
    content: Color,
    outlined: Boolean = false,
    words: @Composable () -> Unit,
) {
    Surface(
        shape = CircleShape,
        color = container,
        contentColor = content,
        border = if (outlined) BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant) else null,
        modifier = Modifier.clearAndSetSemantics {},
    ) {
        Row(
            Modifier.padding(horizontal = 10.dp, vertical = 4.dp),
            horizontalArrangement = Arrangement.spacedBy(4.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) { words() }
    }
}

/** Puts [content] centered on [share] of the width, kept inside it at the ends. */
@Composable
private fun AtShare(
    share: Double,
    modifier: Modifier = Modifier,
    content: @Composable () -> Unit,
) {
    Layout(content, modifier.fillMaxWidth()) { measurables, constraints ->
        val placeable = measurables.single().measure(constraints.copy(minWidth = 0))
        val width = constraints.maxWidth
        val x = (share * width - placeable.width / 2).roundToInt().coerceIn(0, max(0, width - placeable.width))
        layout(width, placeable.height) { placeable.placeRelative(x, 0) }
    }
}

@Composable
private fun ScaleTicks(
    scale: GuessScale,
    unit: String?,
) {
    val locale = currentLocale()
    val values = (4 downTo 1).flatMap { scale.ticks(it) }.distinct()
    val labels =
        scale.tickLabels(values) { value, compact ->
            formatAmount(
                value,
                locale,
                currencyUnit(unit),
                compact = compact,
                maximumFractionDigits =
                    if (compact &&
                        currencyUnit(unit) != null
                    ) {
                        1
                    } else {
                        null
                    },
            )
        }
    Layout(
        content = {
            labels.forEach {
                Text(
                    it,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    style = MaterialTheme.typography.labelSmall.withTabularFigures(),
                )
            }
        },
        modifier = Modifier.fillMaxWidth().clearAndSetSemantics {},
    ) { measurables, constraints ->
        val placeables = measurables.map { it.measure(constraints.copy(minWidth = 0)) }
        val width = constraints.maxWidth
        layout(width, placeables.maxOfOrNull { it.height } ?: 0) {
            val shown = scale.fittedTicks(width, TICK_LABEL_GAP.toPx()) { value -> placeables[values.indexOf(value)].width }
            placeables.forEachIndexed { index, placeable ->
                if (values[index] in shown) {
                    val left =
                        (
                            scale.shareOf(
                                values[index],
                            ) * width - placeable.width / 2
                        ).toInt().coerceIn(0, maxOf(0, width - placeable.width))
                    placeable.placeRelative(left, 0)
                }
            }
        }
    }
}

private const val HALF = 0.5
private const val SOFT = 0.18f
private val DOT = 8.dp
private val RING = 4.dp

@Composable
private fun guessUnitLabel(unit: String?): String? =
    unit?.takeIf { it.isNotEmpty() && currencyUnit(it) == null }?.let { stringResource(R.string.activities_guess_in_unit, it) }
