package com.zoonk.android.ui.components

import androidx.compose.foundation.BorderStroke
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Immutable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.ui.theme.LocalMoreContrast
import com.zoonk.android.ui.theme.zoonk
import com.zoonk.android.ui.theme.zoonkType

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
            result == AnswerResult.Wrong -> BorderStroke(CHECKED, MaterialTheme.zoonk.destructive) to colors.errorContainer
            result == AnswerResult.Guess -> BorderStroke(CHECKED, colors.onSurfaceVariant) to Color.Transparent
            picked -> pickedBorder() to MaterialTheme.zoonk.selectedTint
            else -> BorderStroke(1.dp, colors.outline) to Color.Transparent
        }

    return AnswerTone(border = border, container = container, contentColor = colors.onSurface)
}

/**
 * Main's pick: the soft fill takes the line's place, so a pick is a quiet tile with its own mark. The line comes
 * back only when the device asks for more contrast.
 */
@Composable
fun pickedBorder(): BorderStroke = BorderStroke(1.dp, pickedBorderColor())

@Composable
fun pickedBorderColor(): Color = if (LocalMoreContrast.current) MaterialTheme.colorScheme.outline else Color.Transparent

/**
 * The right option says "Correct" when the learner missed it. A pick needs no word of its own: its color and the
 * verdict say it, and only a guess ([guessed]), which counts as neither, says so.
 */
@Composable
fun AnswerTag(
    picked: Boolean,
    result: AnswerResult,
    modifier: Modifier = Modifier,
    guessed: Boolean = false,
) {
    val text =
        when {
            result == AnswerResult.Guess || (picked && guessed) -> stringResource(R.string.answer_tag_your_guess)
            result == AnswerResult.Right && !picked -> stringResource(R.string.answer_tag_correct)
            else -> return
        }

    val color =
        when (result) {
            AnswerResult.Guess -> MaterialTheme.colorScheme.onSurfaceVariant
            AnswerResult.Right -> MaterialTheme.colorScheme.onTertiaryContainer
            AnswerResult.Wrong -> MaterialTheme.colorScheme.onErrorContainer
        }

    Text(text = text, modifier = modifier, color = color, style = MaterialTheme.zoonkType.tag)
}

/** Before Check, a guess says so in the words its verdict keeps. Unspoken: the option is selected. */
@Composable
fun GuessTag(modifier: Modifier = Modifier) {
    Text(
        text = stringResource(R.string.answer_tag_your_guess),
        modifier = modifier.clearAndSetSemantics {},
        color = MaterialTheme.colorScheme.onSurface,
        style = MaterialTheme.zoonkType.tag,
    )
}

private val CHECKED = 1.5.dp
