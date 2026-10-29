package com.zoonk.android.feature.activities.code

import com.zoonk.android.feature.activities.ActivityExpression
import kotlin.math.abs
import kotlin.math.max
import com.zoonk.api.models.PlayableLibraryStepAnyOfContentOneOf19FieldsOneOf1ExamplesInner as FormulaExample
import com.zoonk.api.models.PlayableLibraryStepAnyOfContentOneOfCheckOneOf2Tolerance as Tolerance

/** [value] is null when the formula can't be worked out for this example. */
data class FormulaResult(
    val expected: Double,
    val passes: Boolean,
    val value: Double?,
)

private const val FLOAT_SLACK = 1e-9
private const val RELATIVE_TOLERANCE_SLACK = 1e-9

private fun isClose(
    value: Double,
    expected: Double,
) = abs(value - expected) <= FLOAT_SLACK * max(1.0, abs(expected))

/** Core's `withinTolerance`. */
internal fun withinTolerance(
    expected: Double,
    tolerance: Tolerance,
    value: Double,
): Boolean {
    val allowed = if (tolerance.kind == Tolerance.Kind.ABSOLUTE) tolerance.`value` else tolerance.`value` * abs(expected)
    val distance = abs(value - expected)
    val slack = RELATIVE_TOLERANCE_SLACK * maxOf(abs(expected), abs(value), allowed)
    return distance <= allowed + slack || isClose(value, expected)
}

/** Main's `testFormula`: a spreadsheet formula, with or without its `=`, worked out for each example. */
internal fun testFormula(
    formula: String,
    examples: List<FormulaExample>,
    tolerance: Tolerance,
): List<FormulaResult> {
    val source = formula.jsTrim().removePrefix("=")
    return examples.map { example ->
        val value = if (source.isEmpty()) null else ActivityExpression.evaluate(source, example.inputs.associate { it.name to it.`value` })
        FormulaResult(
            expected = example.output,
            passes = value != null && withinTolerance(example.output, tolerance, value),
            value = value,
        )
    }
}
