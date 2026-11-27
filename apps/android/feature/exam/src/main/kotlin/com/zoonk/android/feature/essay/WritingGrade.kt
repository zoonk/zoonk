package com.zoonk.android.feature.essay

import androidx.compose.runtime.Immutable
import com.zoonk.api.models.WritingRangeOutput
import com.zoonk.api.models.WritingResultOutput
import com.zoonk.api.models.WritingResultOutputOneOf1
import com.zoonk.api.models.WritingResultOutputOneOf1RowsInner
import com.zoonk.api.models.WritingResultOutputOneOfCriteriaInner
import com.zoonk.api.models.WritingResultOutputOneOfErrorsInner
import com.zoonk.api.models.WritingResultOutputOneOfNextStep
import com.zoonk.api.models.WritingResultOutputOneOfProgress

/**
 * A graded written answer, one shape for both of the API's kinds: [points] is there only when the
 * notice gives a scale and its rubric passed its check; without it the answer has a level per
 * criterion and no total.
 */
@Immutable
data class WritingGrade(
    val criteria: List<WritingResultOutputOneOfCriteriaInner>,
    val errors: List<WritingResultOutputOneOfErrorsInner>,
    val ignoredFrom: Int?,
    val nextStep: WritingResultOutputOneOfNextStep?,
    val progress: WritingResultOutputOneOfProgress?,
    val points: WritingPoints?,
    /** The server's count of the sent text's lines; older grades leave it out. */
    val estimatedLines: Int? = null,
) {
    fun criterionName(id: String): String = criteria.firstOrNull { it.id == id }?.name ?: id
}

@Immutable
data class WritingPoints(
    val max: Double,
    val total: WritingRangeOutput,
    val content: WritingRangeOutput,
    /** Positive: what language errors take away. */
    val deduction: WritingRangeOutput,
    val rows: List<WritingResultOutputOneOf1RowsInner>,
    /** The notice's rule that zeroed the answer, in its words. */
    val zeroReason: String?,
    /** Which rule zeroed it; older answers leave it out. */
    val zeroKind: WritingResultOutputOneOf1.ZeroKind? = null,
    /** How many decimals this scale shows. */
    val decimals: Int,
)

sealed interface NextStep {
    data object Done : NextStep

    data object Limit : NextStep

    data object Short : NextStep

    data class Zero(
        val text: String,
        val zeroKind: WritingResultOutputOneOf1.ZeroKind?,
    ) : NextStep

    data class Criterion(
        val title: String?,
        val text: String,
        val quote: String?,
        val example: String?,
    ) : NextStep
}

/** With points, full marks on every row; with levels, every criterion complete. */
private fun WritingGrade.isComplete(): Boolean =
    points?.let { points -> points.zeroReason == null && points.rows.all { (it.range?.low ?: it.earned) >= it.max } }
        ?: criteria.all { it.level == WritingResultOutputOneOfCriteriaInner.Level.COMPLETE }

/** The answer broke a rule that scores it zero, whatever its criteria say. */
val WritingGrade.zeroed: Boolean
    get() = nextStep?.kind == WritingResultOutputOneOfNextStep.Kind.ZERO || points?.zeroReason != null

/**
 * The one thing to work on next. "Nothing left" only when every criterion is complete and every
 * line is read; a zeroed answer's step is the rule it broke; text past the limit is the step when
 * nothing else is. A quote shows only when it's in [text], where it's underlined. Older saved
 * answers have no `kind` or `title`, so the same rules read them.
 */
fun WritingGrade.nextStep(text: String): NextStep {
    val step = nextStep
    if (zeroed) {
        return NextStep.Zero(step?.text.orEmpty(), points?.zeroKind)
    }
    if (step?.kind == WritingResultOutputOneOfNextStep.Kind.SHORT) return NextStep.Short
    if (step?.kind == WritingResultOutputOneOfNextStep.Kind.LIMIT || (ignoredFrom != null && isComplete())) return NextStep.Limit
    if (step == null) {
        if (isComplete()) return NextStep.Done
        // Answers graded before the grader always named a step: the first criterion short of complete.
        val criterion = criteria.firstOrNull { it.level != WritingResultOutputOneOfCriteriaInner.Level.COMPLETE }
        return NextStep.Criterion(criterion?.name, criterion?.comment.orEmpty(), quote = null, example = null)
    }
    return NextStep.Criterion(
        title = step.title ?: criteria.firstOrNull { it.id == step.criterionId }?.name,
        text = step.text,
        quote = step.quote?.takeIf { it.isNotEmpty() && text.contains(it) },
        example = step.example,
    )
}

fun WritingResultOutput.toGrade(): WritingGrade? =
    when (this) {
        is WritingResultOutput.WritingResultOutputOneOf2Value -> {
            null
        }

        is WritingResultOutput.WritingResultOutputOneOfValue -> {
            WritingGrade(
                value.criteria,
                value.errors,
                value.ignoredFrom?.toInt(),
                value.nextStep,
                value.progress,
                points = null,
                estimatedLines = value.estimatedLines?.toInt(),
            )
        }

        is WritingResultOutput.WritingResultOutputOneOf1Value -> {
            WritingGrade(
                value.criteria,
                value.errors,
                value.ignoredFrom?.toInt(),
                value.nextStep,
                value.progress,
                WritingPoints(
                    value.max,
                    value.total,
                    value.content,
                    value.deduction,
                    value.rows,
                    value.zeroReason,
                    value.zeroKind,
                    value.decimals?.toInt() ?: 0,
                ),
                value.estimatedLines?.toInt(),
            )
        }
    }
