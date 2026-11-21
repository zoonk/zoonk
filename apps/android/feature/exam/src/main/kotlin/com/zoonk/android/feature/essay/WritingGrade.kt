package com.zoonk.android.feature.essay

import androidx.compose.runtime.Immutable
import com.zoonk.api.models.WritingRangeOutput
import com.zoonk.api.models.WritingResultOutput
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
)

fun WritingResultOutput.toGrade(): WritingGrade =
    when (this) {
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
                WritingPoints(value.max, value.total, value.content, value.deduction, value.rows, value.zeroReason),
                value.estimatedLines?.toInt(),
            )
        }
    }
