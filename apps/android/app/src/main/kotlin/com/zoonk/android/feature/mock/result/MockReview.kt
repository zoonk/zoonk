package com.zoonk.android.feature.mock.result

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.app.AppContainer
import com.zoonk.android.data.recode
import com.zoonk.android.feature.feedback.FeedbackTarget
import com.zoonk.android.feature.feedback.ReportProblemMenu
import com.zoonk.android.feature.mock.runner.trueFalseWords
import com.zoonk.android.feature.questions.Citation
import com.zoonk.android.feature.questions.ItemCitationNote
import com.zoonk.android.feature.questions.ItemLine
import com.zoonk.android.feature.questions.ItemSet
import com.zoonk.android.feature.questions.ItemSetText
import com.zoonk.android.feature.questions.ItemText
import com.zoonk.android.feature.questions.TrueFalseWords
import com.zoonk.android.feature.questions.trueFalseLabel
import com.zoonk.android.ui.components.AnswerResult
import com.zoonk.android.ui.components.AnswerTag
import com.zoonk.android.ui.components.answerTone
import com.zoonk.android.ui.richtext.RichText
import com.zoonk.android.ui.theme.withTabularFigures
import com.zoonk.api.models.FeedbackSubmissionContext
import com.zoonk.api.models.MockExam
import com.zoonk.api.models.MockExamReviewInner

@Composable
internal fun ReviewSection(
    view: MockExam,
    app: AppContainer,
) {
    if (view.review.isEmpty()) return
    ResultSection(stringResource(R.string.mock_result_review)) { ReviewList(view, app) }
}

/** Main's `MockReviewDrawer`: the same questions in a sheet, where the score step stays short on a phone. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
internal fun ReviewSheet(
    view: MockExam,
    app: AppContainer,
    onDismiss: () -> Unit,
) {
    ModalBottomSheet(onDismissRequest = onDismiss, sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)) {
        Column(
            Modifier
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 24.dp)
                .navigationBarsPadding(),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Text(stringResource(R.string.mock_result_review), Modifier.semantics { heading() }, style = MaterialTheme.typography.titleLarge)
            ReviewList(view, app)
        }
    }
}

@Composable
private fun ReviewList(
    view: MockExam,
    app: AppContainer,
) {
    val words = view.trueFalseWords
    Column {
        view.review.forEachIndexed { index, entry ->
            if (index > 0) HorizontalDivider()
            val continued =
                entry.set != null && view.review
                    .getOrNull(index - 1)
                    ?.set
                    ?.id == entry.set?.id
            ReviewEntry(entry, continued, numbered = view.scoring != MockExam.Scoring.NET, words, app)
        }
    }
}

@Composable
private fun ReviewEntry(
    entry: MockExamReviewInner,
    continued: Boolean,
    numbered: Boolean,
    words: TrueFalseWords,
    app: AppContainer,
) {
    val number = entry.number.toInt()
    val muted = MaterialTheme.typography.bodyMedium.copy(color = MaterialTheme.colorScheme.onSurfaceVariant)

    Column(Modifier.padding(vertical = 20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(
                entry.area?.let { stringResource(R.string.mock_result_question_area, number, it) }
                    ?: stringResource(R.string.mock_result_question, number),
                Modifier.weight(1f),
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                style = MaterialTheme.typography.labelMedium.withTabularFigures(),
            )
            ReportProblemMenu(app, FeedbackTarget("mock-review", FeedbackSubmissionContext.ContentKind.ITEM, entry.itemId))
        }
        entry.set?.let { ItemSetText(it.recode<_, ItemSet>(), continued = continued) }
        entry.context?.let { ItemText(it, style = muted) }
        RichText(entry.question, style = MaterialTheme.typography.bodyLarge.copy(fontWeight = FontWeight.Medium))
        if (entry.outcome ==
            MockExamReviewInner.Outcome.PARTIAL
        ) {
            Text(stringResource(R.string.mock_result_partly_right_note), style = muted)
        }
        ReviewAnswers(entry, numbered, words)
        entry.explanation?.let { ItemText(it, style = MaterialTheme.typography.bodyMedium) }
        entry.citation?.let { ItemCitationNote(it.recode<_, Citation>()) }
    }
}

@Composable
private fun ReviewAnswers(
    entry: MockExamReviewInner,
    numbered: Boolean,
    words: TrueFalseWords,
) {
    val yours = entry.learnerAnswer
    val right = entry.correctAnswer
    val label = stringResource(R.string.mock_result_answers)

    if (yours == null) {
        Text(
            stringResource(R.string.mock_result_left_blank),
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            style = MaterialTheme.typography.bodyMedium,
        )
    }
    Column(Modifier.semantics { contentDescription = label }, verticalArrangement = Arrangement.spacedBy(10.dp)) {
        yours?.let { ReviewAnswer(it, entry, right = false, numbered, words) }
        right?.let { ReviewAnswer(it, entry, right = true, numbered, words) }
    }
}

/**
 * The review has a pick's words but not its number, so a statement's verdict shows its own mark
 * (its number where the runner numbered them) and any other answer shows how it went.
 */
@Composable
private fun ReviewAnswer(
    answer: String,
    entry: MockExamReviewInner,
    right: Boolean,
    numbered: Boolean,
    words: TrueFalseWords,
) {
    val result = if (right) AnswerResult.Right else AnswerResult.Wrong
    val tone = answerTone(picked = !right, result = result)
    val shape = RoundedCornerShape(12.dp)
    val statement = entry.format == MockExamReviewInner.Format.TRUE_FALSE && (answer == "true" || answer == "false")
    val isTrue = answer == "true"

    Row(
        Modifier
            .fillMaxWidth()
            .clip(shape)
            .background(tone.container)
            .border(tone.border, shape)
            .padding(horizontal = 14.dp, vertical = 14.dp)
            .semantics(mergeDescendants = true) {},
        horizontalArrangement = Arrangement.spacedBy(12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        when {
            statement && numbered -> {
                Text(if (isTrue) "1" else "2", style = MaterialTheme.typography.labelLarge.withTabularFigures())
            }

            else -> {
                val check = if (statement) isTrue else right
                Icon(
                    painterResource(if (check) R.drawable.ic_check else R.drawable.ic_close),
                    contentDescription = null,
                    modifier = Modifier.size(20.dp),
                    tint = if (right) MaterialTheme.colorScheme.tertiary else MaterialTheme.colorScheme.error,
                )
            }
        }
        ItemLine(if (statement) trueFalseLabel(isTrue, words) else answer, Modifier.weight(1f))
        AnswerTag(picked = !right, result = result)
    }
}
