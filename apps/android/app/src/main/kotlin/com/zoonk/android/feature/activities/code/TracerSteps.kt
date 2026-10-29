package com.zoonk.android.feature.activities.code

import com.zoonk.android.feature.activities.assignmentAnswer
import com.zoonk.android.feature.player.model.ActivityAnswer
import java.math.BigDecimal
import kotlin.math.abs
import com.zoonk.api.models.PlayableLibraryStepAnyOfContentOneOf17FieldsPausesInner as Pause
import com.zoonk.api.models.PlayableLibraryStepAnyOfContentOneOf17FieldsTraceInner as TraceStep
import com.zoonk.api.models.PlayableLibraryStepAnyOfContentOneOf17FieldsTraceInnerValuesInnerValue as TraceValue

/** A watched variable at a step: [previous] is its value one step before, null when it had none. */
data class WatchedValue(
    val name: String,
    val value: String?,
    val previous: String?,
    val changed: Boolean,
)

private const val PLAIN_MIN = 1e-6
private const val PLAIN_MAX = 1e21

/** JavaScript's `String(number)` for the numbers a trace holds, which the JVM writes as "3.0" or "1.2E7". */
internal fun jsNumberText(value: Double): String =
    when {
        value == 0.0 -> {
            "0"
        }

        abs(value) < PLAIN_MIN || abs(value) >= PLAIN_MAX -> {
            value
                .toString()
                .replace("E", "e")
                .replace(Regex("""e(\d)"""), "e+$1")
                .replace(".0e", "e")
        }

        else -> {
            BigDecimal(value.toString()).stripTrailingZeros().toPlainString()
        }
    }

internal val TraceValue.text: String
    get() =
        when (this) {
            is TraceValue.StringValue -> value
            is TraceValue.DoubleValue -> jsNumberText(value)
            is TraceValue.BooleanValue -> value.toString()
        }

private fun valueAt(
    trace: List<TraceStep>,
    name: String,
    step: Int,
): String? =
    trace
        .take(step + 1)
        .flatMap { it.propertyValues.filter { entry -> entry.name == name } }
        .lastOrNull()
        ?.value
        ?.text

/** Main's `watchedValues`: a value carries forward until a step changes it. */
internal fun watchedValues(
    step: Int,
    trace: List<TraceStep>,
    watch: List<String>,
): List<WatchedValue> =
    watch.map { name ->
        val value = if (step < 0) null else valueAt(trace, name, step)
        val previous = if (step < 1) null else valueAt(trace, name, step - 1)
        WatchedValue(name, value, previous, changed = previous != null && value != previous)
    }

/** Before the first line when the first line itself is a pause. */
internal fun firstStep(pauses: List<Pause>): Int = if (pauses.any { it.step == 0L }) -1 else 0

/** The pause stepping forward from [step] reaches, by its index: the first one there still without a prediction. */
internal fun upcomingPause(
    pauses: List<Pause>,
    predictions: Map<String, String>,
    step: Int,
): IndexedValue<Pause>? = blockingPause(pauses, predictions, step) ?: pauses.withIndex().firstOrNull { it.value.step == step + 1L }

/** The upcoming pause while it has no prediction, which holds the learner at [step]. */
internal fun blockingPause(
    pauses: List<Pause>,
    predictions: Map<String, String>,
    step: Int,
): IndexedValue<Pause>? = pauses.withIndex().firstOrNull { it.value.step == step + 1L && it.index.toString() !in predictions }

/** Main's `tracerAnswer`: an answer once every pause has a prediction. */
internal fun tracerAnswer(
    pauses: List<Pause>,
    predictions: Map<String, String>,
): ActivityAnswer? {
    val keys = pauses.indices.map(Int::toString)
    return if (keys.all { it in predictions }) assignmentAnswer(keys.associateWith { predictions.getValue(it) }) else null
}
