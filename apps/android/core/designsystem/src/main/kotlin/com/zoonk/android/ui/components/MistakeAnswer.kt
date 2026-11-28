package com.zoonk.android.ui.components

import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import com.zoonk.android.R

/**
 * What the learner answered, or the right answer, after the fact: the [AnswerOption]'s result look,
 * locked and keyed by its ✗ or ✓ (main's `AnswerPair`), around [content], the answer as its item shows it.
 */
@Composable
fun MistakeAnswer(
    right: Boolean,
    modifier: Modifier = Modifier,
    content: @Composable () -> Unit,
) {
    // Its mark is unspoken, so a screen reader hears whose answer it is.
    val yours = stringResource(R.string.answer_tag_your_answer)

    AnswerOption(
        marker = 0,
        picked = !right,
        result = if (right) AnswerResult.Right else AnswerResult.Wrong,
        onClick = {},
        modifier = if (right) modifier else modifier.semantics { stateDescription = yours },
        role = null,
        glyph = painterResource(if (right) R.drawable.ic_check else R.drawable.ic_close),
    ) { content() }
}

/** An answer shown exactly as written, such as what the learner typed. */
@Composable
fun MistakeAnswer(
    text: String,
    right: Boolean,
    modifier: Modifier = Modifier,
) = MistakeAnswer(right, modifier) { Text(text) }
