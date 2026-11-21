package com.zoonk.android.ui.components

import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier

/**
 * What the learner answered, or the right answer, after the fact: the [AnswerOption]'s result look,
 * locked (main's `AnswerPair`), around [content], the answer as its item shows it.
 */
@Composable
fun MistakeAnswer(
    right: Boolean,
    modifier: Modifier = Modifier,
    content: @Composable () -> Unit,
) {
    AnswerOption(
        marker = 0,
        picked = !right,
        result = if (right) AnswerResult.Right else AnswerResult.Wrong,
        onClick = {},
        modifier = modifier,
        role = null,
    ) { content() }
}

/** An answer shown exactly as written, such as what the learner typed. */
@Composable
fun MistakeAnswer(
    text: String,
    right: Boolean,
    modifier: Modifier = Modifier,
) = MistakeAnswer(right, modifier) { Text(text) }
