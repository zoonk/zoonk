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

/**
 * How a checked answer turned out: the right answer, the learner's wrong pick, or their pick on a
 * guess that never counts (a lesson's "Guess first"), which isn't a mistake.
 */
enum class AnswerResult { Guess, Right, Wrong }

/**
 * An answer piece's line, fill and words (`answerTone`), for a `Surface(color = container,
 * contentColor = contentColor, border = border)`.
 */
@Immutable
data class AnswerTone(
    val border: BorderStroke,
    val container: Color,
    /** The words stay in the text color whatever the result: only the line and fill change. */
    val contentColor: Color,
)

/**
 * The look of an answer piece (an option, a word tile, a match item), the same everywhere: the
 * stronger line at rest, the learner's 2dp ink ring and faint tint when picked, and once checked
 * a blue (right) or pink-red (wrong) ring on its tint, so checking always changes a pick's color
 * while its words stay in `onSurface`. A guess keeps a quiet ring with no tint. Color is never the
 * only cue: a checked piece shows its `AnswerTag`.
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

/**
 * The word a checked answer piece shows in its result's color: "Correct" on the right answer the
 * learner didn't pick, "Your answer" on their pick (right or wrong, so a right pick isn't called
 * correct twice under its verdict) and "Your guess" on a guess.
 */
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
