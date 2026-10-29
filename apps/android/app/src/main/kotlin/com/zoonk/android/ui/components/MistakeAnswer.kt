package com.zoonk.android.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp

/** Main's `MistakeAnswer`: what the learner answered, or the right answer, on its answer's tone. */
@Composable
fun MistakeAnswer(
    text: String,
    right: Boolean,
    modifier: Modifier = Modifier,
) {
    val result = if (right) AnswerResult.Right else AnswerResult.Wrong
    val tone = answerTone(picked = !right, result = result)
    val shape = RoundedCornerShape(12.dp)

    Row(
        modifier
            .fillMaxWidth()
            .clip(shape)
            .background(tone.container)
            .border(tone.border, shape)
            .padding(horizontal = 14.dp, vertical = 12.dp)
            .semantics(mergeDescendants = true) {},
        horizontalArrangement = Arrangement.spacedBy(12.dp),
        verticalAlignment = Alignment.Top,
    ) {
        Text(text, Modifier.weight(1f), color = tone.contentColor, style = MaterialTheme.typography.bodyLarge)
        AnswerTag(picked = !right, result = result)
    }
}
