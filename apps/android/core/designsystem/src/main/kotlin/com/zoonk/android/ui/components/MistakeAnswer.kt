package com.zoonk.android.ui.components

import androidx.compose.material3.LocalTextStyle
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.AnnotatedString
import com.zoonk.android.ui.richtext.RichTextLine
import com.zoonk.android.ui.richtext.SpokenText

/** What the learner answered, or the right answer, after the fact: the [AnswerOption]'s result look, locked (main's `AnswerPair`). */
@Composable
fun MistakeAnswer(
    text: SpokenText,
    right: Boolean,
    modifier: Modifier = Modifier,
) {
    AnswerOption(
        marker = 0,
        picked = !right,
        result = if (right) AnswerResult.Right else AnswerResult.Wrong,
        onClick = {},
        modifier = modifier,
        role = null,
    ) { RichTextLine(text, Modifier, LocalTextStyle.current) }
}

/** An answer shown exactly as written, such as what the learner typed. */
@Composable
fun MistakeAnswer(
    text: String,
    right: Boolean,
    modifier: Modifier = Modifier,
) = MistakeAnswer(SpokenText(AnnotatedString(text)), right, modifier)
