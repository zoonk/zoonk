package com.zoonk.android.feature.mock.result

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.size
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
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
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.feature.essay.EssayGradeCard
import com.zoonk.android.feature.essay.EssayRubric
import com.zoonk.android.feature.essay.NextStepComment
import com.zoonk.android.feature.essay.writingName
import com.zoonk.android.feature.mock.runner.EssayGrading
import com.zoonk.android.feature.mock.runner.StepDetail
import com.zoonk.android.feature.mock.runner.StepTitle
import com.zoonk.android.ui.components.OutlinedButton
import com.zoonk.android.ui.components.stepHeading
import com.zoonk.android.ui.theme.zoonk
import com.zoonk.api.models.EssayGrade
import com.zoonk.api.models.MockEssay
import com.zoonk.api.models.MockExam
import kotlinx.coroutines.delay
import kotlin.time.Duration.Companion.seconds

/** One essay's step, or two once it's graded: its grade by the exam's rubric, then the one thing to work on next. */
internal sealed interface EssayStep {
    val id: String

    data class Ungraded(
        val essay: MockEssay,
        val eyebrow: String?,
    ) : EssayStep {
        override val id = "essay-${essay.itemId}"
    }

    data class Grade(
        val essay: MockEssay,
        val grade: EssayGrade,
    ) : EssayStep {
        override val id = "essay-${essay.itemId}"
    }

    data class NextStep(
        val essay: MockEssay,
        val grade: EssayGrade,
    ) : EssayStep {
        override val id = "essay-${essay.itemId}-next"
    }
}

@Composable
internal fun essaySteps(view: MockExam): List<EssayStep> {
    val essays = view.essays
    return essays.flatMapIndexed { index, essay ->
        val grade = essay.grade
        if (grade == null || grade.zeroReason == EssayGrade.ZeroReason.TOO_SHORT) {
            val eyebrow = if (essays.size > 1) stringResource(R.string.mock_result_written_part, index + 1, essays.size) else essay.area
            listOf(EssayStep.Ungraded(essay, eyebrow))
        } else {
            listOf(EssayStep.Grade(essay, grade), EssayStep.NextStep(essay, grade))
        }
    }
}

@Composable
internal fun EssayStepContent(
    step: EssayStep,
    rubric: MockExam.EssayRubric?,
    grading: EssayGrading,
    onGrade: () -> Unit,
) {
    when (step) {
        is EssayStep.Ungraded -> UngradedEssay(step, rubric, grading, onGrade)
        is EssayStep.Grade -> EssayGradeCard(step.grade, EssayRubric.of(rubric?.value))
        is EssayStep.NextStep -> NextStepComment(step.grade)
    }
}

@Composable
private fun UngradedEssay(
    step: EssayStep.Ungraded,
    rubric: MockExam.EssayRubric?,
    grading: EssayGrading,
    onGrade: () -> Unit,
) {
    val essay = step.essay

    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        step.eyebrow?.let { Eyebrow(it) }
        StepTitle(writingName(EssayRubric.of(rubric?.value)), Modifier.stepHeading())
        if (essay.status == MockEssay.Status.BLANK) StepDetail(stringResource(R.string.mock_result_left_blank))
        if (essay.grade?.zeroReason == EssayGrade.ZeroReason.TOO_SHORT) StepDetail(stringResource(R.string.mock_result_too_short))
    }
    if (essay.status == MockEssay.Status.PENDING) PendingGrade(grading, onGrade)
}

/** Grading is started by the hand-in; here it shows going, and offers Grade it again after a limit or a failure. */
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

    val line =
        when (grading) {
            EssayGrading.Failed -> stringResource(R.string.mock_result_grading_failed)
            EssayGrading.LimitReached -> stringResource(R.string.mock_result_grading_limit)
            else -> stringResource(R.string.mock_result_not_graded)
        }
    StepDetail(line, if (grading == EssayGrading.Idle) Modifier else Modifier.semantics { liveRegion = LiveRegionMode.Assertive })
    OutlinedButton(onClick = onGrade) { Text(stringResource(R.string.mock_result_grade_it)) }
}

@Composable
internal fun Eyebrow(text: String) {
    Text(text, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.labelLarge)
}

private val SLOW_GRADING = 30.seconds
