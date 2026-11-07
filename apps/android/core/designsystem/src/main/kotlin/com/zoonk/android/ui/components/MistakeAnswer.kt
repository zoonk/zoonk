package com.zoonk.android.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import com.zoonk.android.ui.theme.ZoonkRadius

@Composable
fun MistakeAnswer(
    text: String,
    right: Boolean,
    modifier: Modifier = Modifier,
) {
    val result = if (right) AnswerResult.Right else AnswerResult.Wrong
    val tone = answerTone(picked = !right, result = result)
    val shape = RoundedCornerShape(ZoonkRadius.option)

    TagBesideOrUnder(
        modifier =
            modifier
                .fillMaxWidth()
                .clip(shape)
                .background(tone.container)
                .border(tone.border, shape)
                .padding(horizontal = 14.dp, vertical = 12.dp)
                .semantics(mergeDescendants = true) {},
        content = { Text(text, color = tone.contentColor, style = MaterialTheme.typography.bodyLarge) },
        tag = { AnswerTag(picked = !right, result = result) },
    )
}
