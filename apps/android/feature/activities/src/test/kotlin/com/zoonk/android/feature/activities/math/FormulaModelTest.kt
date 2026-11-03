package com.zoonk.android.feature.activities.math

import com.zoonk.android.feature.activities.ActivityFixtures
import com.zoonk.api.ApiJson
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test
import com.zoonk.api.models.PlayableLibraryStepAnyOfContent.PlayableLibraryStepAnyOfContentOneOfValue as FormulaModelContent
import com.zoonk.api.models.PlayableLibraryStepAnyOfContentOneOfCheckOneOfInputsInner as CheckInput

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
    fun aRepeatedCheckInputPlacesTheAnswerAtItsLastValueAsCoreReadsIt() {
        val axis = checkNotNull(chartAxis(fields("formulaModel.scenario")))
        val inputs = listOf(CheckInput("price", 3.0), CheckInput("rentUp", 1.0), CheckInput("price", 4.0))

        assertEquals(4.0, answerX(inputs, axis), 0.0)
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
        assertEquals(Change(-500.0, 0), on.delta)
        assertEquals(listOf("Rent goes up $500"), on.activeLabels)
        assertEquals(683.59375, on.baselineCurve!![10].second, 1e-9)
        assertEquals(-1000.0..2000.0, on.yDomain)
        assertNull(off.baseline)
        assertEquals(-1000.0..2000.0, off.yDomain)
    }

    @Test
    fun aReadoutChangesByWhatItShowsSoOneThatRoundsToItsStartHasNoChange() {
        val changes = { angle: Double ->
            view("formulaModel.simulation", mapOf("angle" to angle, "speed" to 20.0)).readouts.associate { it.output.id to it.change }
        }

        assertEquals(mapOf("distance" to null, "peak" to Change(15.3 - 5.1, 1)), changes(60.0))
        assertEquals(mapOf("distance" to Change(40.8 - 35.3, 2), "peak" to Change(10.2 - 5.1, 2)), changes(45.0))
        assertEquals(Change(0.00000000000000499 - 35.3, 1), changes(90.0)["distance"])
    }

    @Test
    fun aChangeRoundsItsReadoutsAsTheyAreWrittenAndKeepsTheDecimalsTheyShare() {
        val change = { initial: Double, x: Double ->
            val fields =
                ApiJson.decodeFromString(
                    FormulaFields.serializer(),
                    """
                    {"outputs":[{"formula":"x","id":"x","label":"Position","unit":"m"}],
                     "variables":[{"initial":$initial,"label":"Position","max":10,"min":-10,"name":"x","step":0.005}]}
                    """,
                )
            modelView(fields, fields.variables.first(), fields.outputs.first(), mapOf("x" to x), emptyMap()).readouts.first().change
        }

        assertEquals(Change(1.01 - 1.0, 4), change(1.0, 1.005))
        assertEquals(Change(9.99 - -9.99, 2), change(-9.99, 9.99))
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
