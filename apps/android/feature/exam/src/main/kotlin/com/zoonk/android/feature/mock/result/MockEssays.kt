package com.zoonk.android.feature.mock.result

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.size
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ProvideTextStyle
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.feature.essay.WritingResultView
import com.zoonk.android.feature.essay.toGrade
import com.zoonk.android.feature.mock.runner.EssayGrading
import com.zoonk.android.feature.mock.runner.StepDetail
import com.zoonk.android.feature.mock.runner.StepTitle
import com.zoonk.android.ui.components.OutlinedButton
import com.zoonk.android.ui.components.stepHeading
import com.zoonk.api.models.MockEssay
import com.zoonk.api.models.MockExam
import kotlinx.coroutines.delay
import kotlin.time.Duration.Companion.seconds

/** One essay's step: its result once it's graded, read as a practice answer's is. */
internal data class EssayStep(
    val essay: MockEssay,
) {
    val id = "essay-${essay.itemId}"
}

internal fun essaySteps(view: MockExam): List<EssayStep> = view.essays.map(::EssayStep)

@Composable
internal fun EssayStepContent(
    step: EssayStep,
    grading: EssayGrading,
    onGrade: () -> Unit,
) {
    val essay = step.essay
    val grade = remember(essay.grade) { essay.grade?.toGrade() }
    val writing = essay.writing
    if (grade != null && writing != null) {
        WritingResultView(
            grade,
            writing,
            essay.text.orEmpty(),
            eyebrow = writing.title,
            note = if (essay.unsure) ({ EssayUnsure() }) else null,
        )
        return
    }

    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        StepTitle(writing?.title ?: stringResource(R.string.essay_written_answer), Modifier.stepHeading())
        if (essay.status == MockEssay.Status.BLANK) StepDetail(stringResource(R.string.mock_result_left_blank))
        if (essay.unsure) EssayUnsure()
    }
    if (essay.status == MockEssay.Status.PENDING) PendingGrade(grading, onGrade)
}

/** Not sure, as the review's rows show it, on an essay the learner marked. */
@Composable
private fun EssayUnsure() {
    ProvideTextStyle(MaterialTheme.typography.bodyLarge.copy(color = MaterialTheme.colorScheme.onSurfaceVariant)) {
        UnsureFacts("", unsure = true)
    }
}

/** Grading is started by the hand-in; here it shows going, and offers Grade it again while it can still go through. */
@Composable
private fun PendingGrade(
    grading: EssayGrading,
    onGrade: () -> Unit,
) {
    if (grading == EssayGrading.Grading) {
        var slow by remember { mutableStateOf(false) }
        LaunchedEffect(Unit) {
            delay(SLOW_GRADING)
            slow = true
        }
        Row(
            Modifier.semantics(mergeDescendants = true) { liveRegion = LiveRegionMode.Polite },
            horizontalArrangement = Arrangement.spacedBy(12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            CircularProgressIndicator(Modifier.size(18.dp), color = MaterialTheme.colorScheme.onSurfaceVariant, strokeWidth = 2.dp)
            StepDetail(stringResource(if (slow) R.string.mock_result_grading_slow else R.string.mock_result_grading))
        }
        return
    }

    val failed = grading == EssayGrading.Failed
    StepDetail(
        stringResource(if (failed) R.string.mock_result_grading_failed else R.string.mock_result_not_graded),
        if (failed) Modifier.semantics { liveRegion = LiveRegionMode.Assertive } else Modifier,
    )
    OutlinedButton(onClick = onGrade) { Text(stringResource(R.string.mock_result_grade_it)) }
}

private val SLOW_GRADING = 30.seconds
