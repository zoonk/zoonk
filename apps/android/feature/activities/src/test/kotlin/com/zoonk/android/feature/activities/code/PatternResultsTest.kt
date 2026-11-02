package com.zoonk.android.feature.activities.code

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test
import com.zoonk.api.models.PlayableLibraryStepAnyOfContentOneOf19FieldsOneOf1ExamplesInner as Example
import com.zoonk.api.models.PlayableLibraryStepAnyOfContentOneOfCheckOneOf2Tolerance as Tolerance
import com.zoonk.api.models.PlayableLibraryStepAnyOfContentOneOfCheckOneOfInputsInner as Input

// Main's `pattern-results.test.ts` and core's `withinTolerance`.
class PatternResultsTest {
    private val examples =
        listOf(
            Example(listOf(Input("A1", 100.0), Input("B1", 0.2)), output = 120.0),
            Example(listOf(Input("A1", 50.0), Input("B1", 0.1)), output = 55.0),
        )

    private fun absolute(value: Double) = Tolerance(Tolerance.Kind.ABSOLUTE, value)

    @Test
    fun givesEachExamplesValueAndWhetherItsWithinTolerance() {
        assertEquals(
            listOf(FormulaResult(120.0, passes = true, value = 120.0), FormulaResult(55.0, passes = true, value = 55.00000000000001)),
            testFormula("=A1*(1+B1)", examples, absolute(0.01)),
        )
        assertEquals(
            listOf(FormulaResult(120.0, passes = false, value = 100.2), FormulaResult(55.0, passes = false, value = 50.1)),
            testFormula("A1+B1", examples, absolute(0.01)),
        )
    }

    @Test
    fun hasNoValueWhileTheFormulaIsEmptyOrUnfinished() {
        assertEquals(FormulaResult(120.0, passes = false, value = null), testFormula("", examples, absolute(0.0))[0])
        assertNull(testFormula("A1*(", examples, absolute(0.0))[0].value)
    }

    @Test
    fun allowsCoresAbsoluteAndRelativeTolerance() {
        val relative = { value: Double -> Tolerance(Tolerance.Kind.RELATIVE, value) }

        assertEquals(
            listOf(true, false, true, true),
            listOf(
                withinTolerance(100.0, relative(0.05), 104.9),
                withinTolerance(100.0, relative(0.05), 105.1),
                withinTolerance(0.3, absolute(0.0), 0.1 + 0.2),
                withinTolerance(-200.0, relative(0.1), -219.9),
            ),
        )
    }
}
