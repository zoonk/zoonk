package com.zoonk.android.feature.essay

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.VerticalDivider
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.rememberTextMeasurer
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.feature.mock.result.ScoreRange
import com.zoonk.android.feature.mock.runner.StepDetail
import com.zoonk.android.feature.mock.runner.StepTitle
import com.zoonk.android.ui.components.ButtonSize
import com.zoonk.android.ui.components.Eyebrow
import com.zoonk.android.ui.components.Measure
import com.zoonk.android.ui.components.MeasureRows
import com.zoonk.android.ui.components.Meter
import com.zoonk.android.ui.components.OutlinedButton
import com.zoonk.android.ui.components.stepHeading
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.formatNumber
import com.zoonk.android.ui.theme.withTabularFigures
import com.zoonk.android.ui.theme.zoonk
import com.zoonk.api.models.EssayGrade
import com.zoonk.api.models.EssayGradeCriteriaInner

/** The rubric an essay or a mock's written part is graded by, as the API names it for both. */
enum class EssayRubric(
    private val value: String,
) {
    Ap("ap"),
    Enem("enem"),
    Oab("oab"),
    Custom("custom"),
    ;

    companion object {
        fun of(value: String?): EssayRubric = entries.firstOrNull { it.value == value } ?: Custom
    }
}

@Composable
internal fun writingName(rubric: EssayRubric): String =
    stringResource(if (rubric == EssayRubric.Enem) R.string.essay_your_essay else R.string.essay_your_answer)

@Composable
internal fun EssayGradeCard(
    grade: EssayGrade,
    rubric: EssayRubric,
    onComments: (() -> Unit)? = null,
) {
    val locale = currentLocale()

    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Column(Modifier.semantics(mergeDescendants = true) { heading() }.stepHeading(), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Eyebrow(writingName(rubric))
            ScoreRange(stringResource(R.string.essay_range, formatNumber(grade.range.low, locale), formatNumber(grade.range.high, locale)))
        }
        StepDetail(stringResource(R.string.essay_scale, formatNumber(grade.total.maxScore, locale)))
    }
    CriteriaRows(grade, rubric)
    if (onComments != null) {
        OutlinedButton(onClick = onComments, size = ButtonSize.Small) { Text(stringResource(R.string.essay_see_comments)) }
    }
}

@Composable
internal fun CriteriaRows(
    grade: EssayGrade,
    rubric: EssayRubric,
) {
    val locale = currentLocale()
    MeasureRows(
        grade.criteria.map { criterion ->
            val shown = shownScore(criterion, rubric, grade)
            Measure(
                name = criterionName(criterion),
                share = if (criterion.maxScore > 0) (criterion.score / criterion.maxScore).toFloat() else 0f,
                value = stringResource(R.string.essay_score_of, formatNumber(shown.first, locale), formatNumber(shown.second, locale)),
            )
        },
    )
}

/** A custom rubric's criteria each read on the total's scale, so three read "10 of 10", never "3.34 · 3.33 · 3.33". */
private fun shownScore(
    criterion: EssayGradeCriteriaInner,
    rubric: EssayRubric,
    grade: EssayGrade,
): Pair<Double, Double> {
    if (rubric != EssayRubric.Custom || criterion.maxScore <= 0) return criterion.score to criterion.maxScore
    return criterion.score / criterion.maxScore * grade.total.maxScore to grade.total.maxScore
}

/** "Next step", a muted label inside the title block over the criterion's name. */
@Composable
private fun NextStepLabel() {
    Text(
        stringResource(R.string.essay_next_step),
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        style = MaterialTheme.typography.bodyMedium,
    )
}

@Composable
internal fun NextStepComment(grade: EssayGrade) {
    val nextStep = grade.nextStep
    if (nextStep == null) {
        Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
            NextStepLabel()
            StepTitle(stringResource(R.string.essay_nothing_left), Modifier.stepHeading())
        }
        StepDetail(stringResource(R.string.essay_full_marks))
        return
    }
    val criterion = grade.criteria.firstOrNull { it.id == nextStep.criterionId }

    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        NextStepLabel()
        StepTitle(criterion?.let { criterionName(it) } ?: stringResource(R.string.essay_what_to_rewrite), Modifier.stepHeading())
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
            stringResource(R.string.essay_for_example, it),
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            style = MaterialTheme.typography.bodyMedium,
        )
    }
}

@Composable
internal fun criterionName(criterion: EssayGradeCriteriaInner): String =
    when (criterion.id) {
        "c1" -> stringResource(R.string.essay_criterion_formal_writing)
        "c2" -> stringResource(R.string.essay_criterion_topic)
        "c3" -> stringResource(R.string.essay_criterion_argument)
        "c4" -> stringResource(R.string.essay_criterion_cohesion)
        "c5" -> stringResource(R.string.essay_criterion_intervention)
        "addressing-and-parties" -> stringResource(R.string.essay_criterion_addressing)
        "facts" -> stringResource(R.string.essay_criterion_facts)
        "legal-basis" -> stringResource(R.string.essay_criterion_legal_basis)
        "requests" -> stringResource(R.string.essay_criterion_requests)
        "closing-and-form" -> stringResource(R.string.essay_criterion_closing)
        else -> criterion.name
    }
