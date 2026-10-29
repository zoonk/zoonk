package com.zoonk.android.feature.mock.result

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.VerticalDivider
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
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.feature.mock.runner.EssayGrading
import com.zoonk.android.feature.mock.runner.StepDetail
import com.zoonk.android.feature.mock.runner.StepTitle
import com.zoonk.android.ui.components.Meter
import com.zoonk.android.ui.components.OutlinedButton
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.formatNumber
import com.zoonk.android.ui.theme.withTabularFigures
import com.zoonk.android.ui.theme.zoonk
import com.zoonk.api.models.EssayGrade
import com.zoonk.api.models.EssayGradeCriteriaInner
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
        is EssayStep.Grade -> EssayGradeCard(step.grade, rubric)
        is EssayStep.NextStep -> NextStepComment(step.grade)
    }
}

@Composable
private fun writingName(rubric: MockExam.EssayRubric?): String =
    stringResource(if (rubric == MockExam.EssayRubric.ENEM) R.string.mock_result_your_essay else R.string.mock_result_your_answer)

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
        StepTitle(writingName(rubric))
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
            CircularProgressIndicator(Modifier.size(18.dp), strokeWidth = 2.dp)
            Text(
                stringResource(if (slow) R.string.mock_result_grading_slow else R.string.mock_result_grading),
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                style = MaterialTheme.typography.bodyMedium,
            )
        }
        return
    }

    val line =
        when (grading) {
            EssayGrading.Failed -> stringResource(R.string.mock_result_grading_failed)
            EssayGrading.LimitReached -> stringResource(R.string.mock_result_grading_limit)
            else -> stringResource(R.string.mock_result_not_graded)
        }
    Text(
        line,
        if (grading == EssayGrading.Idle) Modifier else Modifier.semantics { liveRegion = LiveRegionMode.Assertive },
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        style = MaterialTheme.typography.bodyLarge,
    )
    OutlinedButton(onClick = onGrade) { Text(stringResource(R.string.mock_result_grade_it)) }
}

@Composable
private fun EssayGradeCard(
    grade: EssayGrade,
    rubric: MockExam.EssayRubric?,
) {
    val locale = currentLocale()

    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Column(Modifier.semantics(mergeDescendants = true) { heading() }, verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text(writingName(rubric), color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.titleMedium)
            ScoreRange(
                stringResource(R.string.mock_result_range, formatNumber(grade.range.low, locale), formatNumber(grade.range.high, locale)),
            )
        }
        StepDetail(stringResource(R.string.mock_result_essay_scale, formatNumber(grade.total.maxScore, locale)))
    }
    CriteriaRows(grade, rubric)
}

@Composable
private fun CriteriaRows(
    grade: EssayGrade,
    rubric: MockExam.EssayRubric?,
) {
    val locale = currentLocale()
    val label = stringResource(R.string.mock_result_criteria)

    Column(Modifier.semantics { contentDescription = label }) {
        grade.criteria.forEach { criterion ->
            val next = criterion.id == grade.nextStep?.criterionId
            val shown = shownScore(criterion, rubric, grade)
            Row(
                Modifier.fillMaxWidth().height(IntrinsicSize.Min).semantics(mergeDescendants = true) {},
                horizontalArrangement = Arrangement.spacedBy(12.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    criterionName(criterion),
                    Modifier.weight(1f).padding(vertical = 12.dp),
                    style = MaterialTheme.typography.bodyMedium,
                    fontWeight = if (next) FontWeight.SemiBold else null,
                )
                Meter(
                    share = if (criterion.maxScore > 0) (criterion.score / criterion.maxScore).toFloat() else 0f,
                    modifier = Modifier.width(METER_WIDTH),
                    color = if (next) MaterialTheme.zoonk.warning else MaterialTheme.colorScheme.tertiary,
                )
                Text(
                    stringResource(R.string.mock_result_score_of, formatNumber(shown.first, locale), formatNumber(shown.second, locale)),
                    style = MaterialTheme.typography.labelMedium.withTabularFigures(),
                )
            }
        }
    }
}

/** A custom rubric's criteria each read on the total's scale, so three read "10 of 10", never "3.34 · 3.33 · 3.33". */
private fun shownScore(
    criterion: EssayGradeCriteriaInner,
    rubric: MockExam.EssayRubric?,
    grade: EssayGrade,
): Pair<Double, Double> {
    val custom = rubric == null || rubric == MockExam.EssayRubric.CUSTOM
    if (!custom || criterion.maxScore <= 0) return criterion.score to criterion.maxScore
    return criterion.score / criterion.maxScore * grade.total.maxScore to grade.total.maxScore
}

@Composable
private fun NextStepComment(grade: EssayGrade) {
    val nextStep = grade.nextStep
    if (nextStep == null) {
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Eyebrow(stringResource(R.string.mock_result_next_step))
            StepTitle(stringResource(R.string.mock_result_nothing_left))
            StepDetail(stringResource(R.string.mock_result_full_marks))
        }
        return
    }
    val criterion = grade.criteria.firstOrNull { it.id == nextStep.criterionId }

    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Eyebrow(stringResource(R.string.mock_result_next_step))
        StepTitle(criterion?.let { criterionName(it) } ?: stringResource(R.string.mock_result_what_to_rewrite))
    }
    criterion?.quote?.let { quote ->
        Row(Modifier.height(IntrinsicSize.Min), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            VerticalDivider(Modifier.fillMaxHeight(), thickness = 2.dp, color = MaterialTheme.zoonk.warning)
            Text(quote, fontStyle = FontStyle.Italic, style = MaterialTheme.typography.bodyLarge)
        }
    }
    Text(nextStep.text, style = MaterialTheme.typography.bodyLarge)
    criterion?.example?.let {
        Text(
            stringResource(R.string.mock_result_for_example, it),
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            style = MaterialTheme.typography.bodyMedium,
        )
    }
}

@Composable
private fun criterionName(criterion: EssayGradeCriteriaInner): String =
    when (criterion.id) {
        "c1" -> stringResource(R.string.mock_result_criterion_formal_writing)
        "c2" -> stringResource(R.string.mock_result_criterion_topic)
        "c3" -> stringResource(R.string.mock_result_criterion_argument)
        "c4" -> stringResource(R.string.mock_result_criterion_cohesion)
        "c5" -> stringResource(R.string.mock_result_criterion_intervention)
        "addressing-and-parties" -> stringResource(R.string.mock_result_criterion_addressing)
        "facts" -> stringResource(R.string.mock_result_criterion_facts)
        "legal-basis" -> stringResource(R.string.mock_result_criterion_legal_basis)
        "requests" -> stringResource(R.string.mock_result_criterion_requests)
        "closing-and-form" -> stringResource(R.string.mock_result_criterion_closing)
        else -> criterion.name
    }

@Composable
internal fun Eyebrow(text: String) {
    Text(text, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.labelLarge)
}

private val SLOW_GRADING = 30.seconds
private val METER_WIDTH = 72.dp
