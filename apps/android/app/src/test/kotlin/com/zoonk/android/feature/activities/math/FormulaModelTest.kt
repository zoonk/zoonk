package com.zoonk.android.feature.activities.math

import com.zoonk.android.feature.activities.ActivityFixtures
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test
import com.zoonk.api.models.PlayableLibraryStepAnyOfContent.PlayableLibraryStepAnyOfContentOneOfValue as FormulaModelContent

/** Expected values are what main's `formula-model-view.ts` and core's `computeValue` return for main's fixtures. */
class FormulaModelTest {
    private fun fields(fixture: String) = (ActivityFixtures.content(fixture) as FormulaModelContent).value.fields

    private fun view(
        fixture: String,
        sliders: ModelValues,
        events: ModelValues = emptyMap(),
    ): ModelView {
        val fields = fields(fixture)
        return modelView(fields, checkNotNull(chartAxis(fields)), checkNotNull(chartedOutput(fields, null)), sliders, events)
    }

    @Test
    fun computesAnOutputAtTheCheckInputsWithWhatIfsOffUnlessTurnedOn() {
        assertEquals(1000.0, formulaValue(fields("formulaModel.scenario"), mapOf("price" to 4.0, "rentUp" to 1.0))!!, 1e-9)
        assertEquals(38.31570319208596, formulaValue(fields("formulaModel.simulation"), mapOf("angle" to 35.0))!!, 1e-9)
        assertEquals(6.707236051726107, formulaValue(fields("formulaModel.simulation"), mapOf("angle" to 35.0), "peak")!!, 1e-9)
        assertNull(formulaValue(fields("formulaModel.calculator"), mapOf("extra" to 900.0)))
        assertNull(formulaValue(fields("formulaModel.scenario"), mapOf("nope" to 1.0)))
    }

    @Test
    fun theStartingModelHasNoBaselineAndComparesAtItsPoint() {
        val start = view("formulaModel", mapOf("rate" to 5.0))

        assertNull(start.baseline)
        assertNull(start.readoutBaseline)
        assertEquals(2653.2977051444223, start.chartedNow!!, 1e-9)
        assertEquals(5.0, checkNotNull(start.compared).first, 0.0)
        assertEquals(2653.2977051444223, checkNotNull(start.compared).second, 1e-9)
        assertEquals(0.0..10_000.0, start.yDomain)
        assertEquals(65, start.current.size)
        assertEquals(1.875, start.current[10].first, 0.0)
        assertEquals(1449.9480257195419, start.current[10].second, 1e-9)
    }

    @Test
    fun movingTheAxisSliderComparesReadoutsWithTheStartButDrawsNoBaseline() {
        val moved = view("formulaModel", mapOf("rate" to 7.0))

        assertNull(moved.baseline)
        assertEquals(BaselineKind.Start, moved.readoutBaseline?.kind)
        assertEquals(3869.6844624861833, moved.chartedNow!!, 1e-9)
    }

    @Test
    fun movingAnotherSliderDrawsTheStartCurve() {
        val faster = view("formulaModel.simulation", mapOf("angle" to 30.0, "speed" to 25.0))

        assertEquals(BaselineKind.Start, faster.baseline?.kind)
        assertEquals(55.174911046409186, faster.chartedNow!!, 1e-9)
        assertEquals(35.311943069701876, faster.chartedBefore!!, 1e-9)
        assertEquals(19.221069799225184, faster.baselineCurve!![10].second, 1e-9)
        assertEquals(0.0..80.0, faster.yDomain)
    }

    @Test
    fun aWhatIfComparesWithTheSameSlidersBeforeIt() {
        val on = view("formulaModel.scenario", mapOf("price" to 4.0), mapOf("rentUp" to 1.0))
        val off = view("formulaModel.scenario", mapOf("price" to 4.0), mapOf("rentUp" to 0.0))

        assertEquals(BaselineKind.WhatIf, on.baseline?.kind)
        assertEquals(1000.0, on.chartedNow!!, 1e-9)
        assertEquals(1500.0, on.chartedBefore!!, 1e-9)
        assertEquals(-500.0, on.delta, 1e-9)
        assertEquals(listOf("Rent goes up $500"), on.activeLabels)
        assertEquals(683.59375, on.baselineCurve!![10].second, 1e-9)
        assertEquals(-1000.0..2000.0, on.yDomain)
        assertNull(off.baseline)
        assertEquals(-1000.0..2000.0, off.yDomain)
    }

    @Test
    fun whatIfMixesCoverEveryOnOffCombination() {
        assertEquals(
            listOf(
                mapOf("a" to 0.0, "b" to 0.0),
                mapOf("a" to 0.0, "b" to 1.0),
                mapOf("a" to 1.0, "b" to 0.0),
                mapOf("a" to 1.0, "b" to 1.0),
            ),
            eventCombinations(listOf("a", "b")),
        )
    }
}
