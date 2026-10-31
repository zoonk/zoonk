package com.zoonk.android.ui.components

import androidx.compose.foundation.BorderStroke
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Immutable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.ui.theme.zoonk

/** A guess never counts (a lesson's "Guess first"), so it isn't a mistake. */
enum class AnswerResult { Guess, Right, Wrong }

@Immutable
data class AnswerTone(
    val border: BorderStroke,
    val container: Color,
    /** The words stay in the text color whatever the result. */
    val contentColor: Color,
)

/**
 * A pick is ink and checking turns it blue or pink-red, so a pick never looks right before it's
 * checked. Color is never the only cue: a checked piece shows its `AnswerTag`.
 */
@Composable
fun answerTone(
    picked: Boolean,
    result: AnswerResult?,
): AnswerTone {
    val colors = MaterialTheme.colorScheme
    val (border, container) =
        when {
            result == AnswerResult.Right -> BorderStroke(CHECKED, colors.tertiary) to colors.tertiaryContainer
            result == AnswerResult.Wrong -> BorderStroke(CHECKED, colors.error) to colors.errorContainer
            result == AnswerResult.Guess -> BorderStroke(CHECKED, colors.onSurfaceVariant) to Color.Transparent
            picked -> BorderStroke(2.dp, colors.primary) to MaterialTheme.zoonk.selectedTint
            else -> BorderStroke(1.dp, colors.outline) to Color.Transparent
        }

    return AnswerTone(border = border, container = container, contentColor = colors.onSurface)
}

/** A right pick says "Your answer", so it isn't called correct twice under its verdict. */
@Composable
fun AnswerTag(
    picked: Boolean,
    result: AnswerResult,
    modifier: Modifier = Modifier,
) {
    val text =
        when {
            result == AnswerResult.Guess -> stringResource(R.string.answer_tag_your_guess)
            picked -> stringResource(R.string.answer_tag_your_answer)
            else -> stringResource(R.string.answer_tag_correct)
        }

    val color =
        when (result) {
            AnswerResult.Guess -> MaterialTheme.colorScheme.onSurfaceVariant
            AnswerResult.Right -> MaterialTheme.colorScheme.onTertiaryContainer
            AnswerResult.Wrong -> MaterialTheme.colorScheme.onErrorContainer
        }

    Text(text = text, modifier = modifier, color = color, style = MaterialTheme.typography.labelMedium)
}

private val CHECKED = 1.5.dp
