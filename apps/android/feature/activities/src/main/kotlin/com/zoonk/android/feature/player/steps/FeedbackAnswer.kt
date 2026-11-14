package com.zoonk.android.feature.player.steps

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.ui.richtext.RichInlineText
import com.zoonk.android.ui.theme.withTabularFigures

/** Main's `FeedbackAnswerLabel` and `FeedbackAnswerValue`: a muted label, then an answer in the right answer's color. */
@Composable
fun FeedbackAnswer(
    label: String,
    answer: String,
    after: String = "",
    tabular: Boolean = false,
) {
    val style = MaterialTheme.typography.bodyMedium
    val value =
        (if (tabular) style.withTabularFigures() else style).copy(
            color = MaterialTheme.colorScheme.onTertiaryContainer,
            fontWeight = FontWeight.Medium,
        )
    FlowRow(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
        if (label.isNotEmpty()) Text(label, color = MaterialTheme.colorScheme.onSurfaceVariant, style = style)
        RichInlineText(text = answer, style = value)
        if (after.isNotEmpty()) Text(after, color = MaterialTheme.colorScheme.onSurfaceVariant, style = style)
    }
}

/** Main's `RightAnswerLine`: "Right answer:" before the answer after a miss, one message so each language places the answer. */
@Composable
fun RightAnswerLine(
    answer: String,
    tabular: Boolean = false,
) {
    val (before, after) =
        stringResource(R.string.questions_right_answer, ANSWER_MARK).split(ANSWER_MARK).let {
            it.first() to
                it.getOrElse(1) { "" }
        }
    FeedbackAnswer(before.trim(), answer, after.trim(), tabular)
}

private const val ANSWER_MARK = "\uE000"
