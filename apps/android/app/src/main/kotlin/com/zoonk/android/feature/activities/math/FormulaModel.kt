package com.zoonk.android.feature.activities.math

import com.zoonk.android.feature.activities.ActivityExpression
import com.zoonk.android.ui.components.niceDomain
import com.zoonk.api.models.PlayableLibraryStepAnyOfContentOneOfFields
import com.zoonk.api.models.PlayableLibraryStepAnyOfContentOneOfFieldsOutputsInner
import com.zoonk.api.models.PlayableLibraryStepAnyOfContentOneOfFieldsVariablesInner
import kotlin.math.max

internal typealias FormulaFields = PlayableLibraryStepAnyOfContentOneOfFields
internal typealias ModelOutput = PlayableLibraryStepAnyOfContentOneOfFieldsOutputsInner
internal typealias ModelVariable = PlayableLibraryStepAnyOfContentOneOfFieldsVariablesInner
internal typealias ModelValues = Map<String, Double>
internal typealias PlotPoints = List<Pair<Double, Double>>

internal enum class BaselineKind { Start, WhatIf }

internal data class Baseline(
    val kind: BaselineKind,
    val values: ModelValues,
)

/** Main's `ModelView`: what the chart, the readouts and the text alternative show for the sliders and what-ifs. */
internal data class ModelView(
    val activeLabels: List<String>,
    val baseline: Baseline?,
    val baselineCurve: PlotPoints?,
    val chartedBefore: Double?,
    val chartedNow: Double?,
    val compared: Pair<Double, Double>?,
    val current: PlotPoints,
    val delta: Double,
    val now: ModelValues,
    val readoutBaseline: Baseline?,
    val x: Double,
    val yDomain: ClosedFloatingPointRange<Double>,
)

internal fun startingValues(variables: List<ModelVariable>): ModelValues = variables.associate { it.name to it.initial }

internal fun eventsOff(fields: FormulaFields): ModelValues = fields.events.orEmpty().associate { it.name to 0.0 }

/** Core's `computeOutput`: an output (the plotted one by default) with the sliders at [inputs], what-ifs off unless an input turns one on. */
internal fun formulaValue(
    fields: FormulaFields,
    inputs: ModelValues,
    output: String? = null,
): Double? {
    val id = output ?: fields.plot?.y ?: fields.outputs.firstOrNull()?.id
    val formula = fields.outputs.find { it.id == id }?.formula ?: return null
    val fixed = eventsOff(fields)
    val sliders = inputs.filterKeys { it !in fixed }
    val reachable =
        sliders.all { (name, value) -> fields.variables.find { it.name == name }?.let { value >= it.min && value <= it.max } == true }
    if (!reachable) return null
    return ActivityExpression.evaluate(formula, fixed + inputs.filterKeys { it in fixed } + startingValues(fields.variables) + sliders)
}

/** Main's `sampleFormula`: [formula] across [variable]'s range, skipping points it can't compute. */
internal fun sampleFormula(
    formula: String,
    variable: ModelVariable,
    fixed: ModelValues,
    samples: Int = DEFAULT_SAMPLES,
): PlotPoints {
    val count = max(samples, 1)
    return (0..count).mapNotNull { index ->
        val x = variable.min + (variable.max - variable.min) * index / count
        ActivityExpression.evaluate(formula, fixed + (variable.name to x))?.let { x to it }
    }
}

/** Every on/off mix of the what-ifs, so the y axis holds them all and stays put while they toggle. */
internal fun eventCombinations(names: List<String>): List<ModelValues> =
    names.fold(listOf(emptyMap())) { combinations, name -> combinations.flatMap { listOf(it + (name to 0.0), it + (name to 1.0)) } }

/** The plotted output: the check's own, else the plot's, else the first. */
internal fun chartedOutput(
    fields: FormulaFields,
    asked: String?,
): ModelOutput? {
    val id = asked ?: fields.plot?.y
    return fields.outputs.find { it.id == id } ?: fields.outputs.firstOrNull()
}

internal fun chartAxis(fields: FormulaFields): ModelVariable? =
    fields.variables.find { it.name == fields.plot?.x } ?: fields.variables.firstOrNull()

internal fun modelView(
    fields: FormulaFields,
    axis: ModelVariable,
    charted: ModelOutput,
    sliders: ModelValues,
    events: ModelValues,
): ModelView {
    val now = sliders + events
    val x = sliders[axis.name] ?: axis.initial
    val anyEventOn = events.values.any { it == 1.0 }
    val outputAt = { output: ModelOutput, at: ModelValues -> formulaValue(fields, at, output.id) }
    val curveAt = { values: ModelValues -> sampleFormula(charted.formula, axis, values) }
    val startWithEvents = Baseline(BaselineKind.Start, startingValues(fields.variables) + events)
    val baseline =
        when {
            anyEventOn -> Baseline(BaselineKind.WhatIf, sliders + eventsOff(fields))
            fields.variables.any { it.name != axis.name && sliders[it.name] != it.initial } -> startWithEvents
            else -> null
        }
    val readoutBaseline =
        when {
            baseline?.kind == BaselineKind.WhatIf -> baseline
            fields.variables.any { sliders[it.name] != it.initial } -> startWithEvents
            else -> null
        }
    val baselineCurve = baseline?.let { curveAt(it.values) }
    val chartedNow = outputAt(charted, now)
    val chartedBefore = baseline?.let { outputAt(charted, it.values + (axis.name to x)) }
    val everyCurve = eventCombinations(fields.events.orEmpty().map { it.name }).map { curveAt(sliders + it) }
    val compared = fields.compareAt?.let { at -> outputAt(charted, now + (axis.name to at))?.let { at to it } }

    return ModelView(
        activeLabels =
            fields.events
                .orEmpty()
                .filter { events[it.name] == 1.0 }
                .map { it.label },
        baseline = baseline,
        baselineCurve = baselineCurve,
        chartedBefore = chartedBefore,
        chartedNow = chartedNow,
        compared = compared,
        current = curveAt(now),
        delta =
            if (baseline?.kind == BaselineKind.WhatIf && chartedNow != null &&
                chartedBefore != null
            ) {
                chartedNow - chartedBefore
            } else {
                0.0
            },
        now = now,
        readoutBaseline = readoutBaseline,
        x = x,
        yDomain = niceDomain((everyCurve + listOfNotNull(baselineCurve)).flatMap { curve -> curve.map { it.second } }),
    )
}

private const val DEFAULT_SAMPLES = 64
