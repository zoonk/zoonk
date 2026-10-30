package com.zoonk.android.feature.activities.math

import com.zoonk.api.models.PlayableLibraryStepAnyOfContentOneOf9FieldsDistributionOneOf
import com.zoonk.api.models.PlayableLibraryStepAnyOfContentOneOf9FieldsDistributionOneOf1
import org.junit.Assert.assertEquals
import org.junit.Test
import com.zoonk.api.models.PlayableLibraryStepAnyOfContentOneOf9FieldsDistribution.PlayableLibraryStepAnyOfContentOneOf9FieldsDistributionOneOf1Value as UniformValue
import com.zoonk.api.models.PlayableLibraryStepAnyOfContentOneOf9FieldsDistribution.PlayableLibraryStepAnyOfContentOneOf9FieldsDistributionOneOfValue as NormalValue

/** Expected values are what main's `distribution.ts` and core's `distributionExplorer` value return for the same input. */
class DistributionTest {
    private val iq =
        NormalValue(
            PlayableLibraryStepAnyOfContentOneOf9FieldsDistributionOneOf(
                PlayableLibraryStepAnyOfContentOneOf9FieldsDistributionOneOf.Kind.NORMAL,
                100.0,
                15.0,
            ),
        )
    private val dice =
        UniformValue(
            PlayableLibraryStepAnyOfContentOneOf9FieldsDistributionOneOf1(
                PlayableLibraryStepAnyOfContentOneOf9FieldsDistributionOneOf1.Kind.UNIFORM,
                6.0,
                0.0,
            ),
        )

    private fun fields(
        distribution: Distribution,
        handles: Interval,
        target: Interval,
    ) = DistributionFields(distribution, handles, target, unit = "points", valueLabel = "Score")

    @Test
    fun theShareBetweenTwoValuesIsCoresPercent() {
        assertEquals(95.44998742254873, percentBetween(iq, Interval(70.0, 130.0)), 1e-9)
        assertEquals(49.501505567283765, percentBetween(iq, Interval(90.0, 110.0)), 1e-9)
        assertEquals(25.249247216358118, percentBetween(iq, Interval(-500.0, 90.0)), 1e-9)
        assertEquals(16.666666666666664, percentBetween(dice, Interval(1.0, 2.0)), 1e-9)
        assertEquals(16.666666666666664, percentBetween(dice, Interval(-3.0, 1.0)), 1e-9)
    }

    @Test
    fun theAxisCoversThreeAndAHalfSdsSnappedToWholeSteps() {
        val iqFields = fields(iq, Interval(90.0, 110.0), Interval(70.0, 130.0))
        val iqDomain = distributionDomain(iqFields)

        assertEquals(47.5..152.5, iqDomain)
        assertEquals(5.0, handleStep(iqFields, iqDomain), 0.0)
        assertEquals(45.0..155.0, snapDomain(iqDomain, 5.0))
    }

    @Test
    fun theStepGetsFinerWhenTheTargetNeedsIt() {
        val fine = fields(iq, Interval(90.0, 110.0), Interval(71.0, 130.0))
        val diceFields = fields(dice, Interval(1.0, 2.0), Interval(0.5, 4.25))

        assertEquals(1.0, handleStep(fine, distributionDomain(fine)), 0.0)
        assertEquals(-1.5..7.5, distributionDomain(diceFields))
        assertEquals(0.05, handleStep(diceFields, distributionDomain(diceFields)), 0.0)
    }

    @Test
    fun theCurvePeaksAtTheMeanAndDrawsAUniformsWallsStraight() {
        val curve = densityCurve(iq, 45.0..155.0)

        assertEquals(121, curve.size)
        assertEquals(45.0, curve[0].first, 0.0)
        assertEquals(0.000032018043441388044, curve[0].second, 1e-15)
        assertEquals(100.0, curve[60].first, 1e-9)
        assertEquals(0.02659615202676218, curve[60].second, 1e-15)
        assertEquals(125, densityCurve(dice, -2.0..8.0).size)
    }

    @Test
    fun ticksMarkWholeSdsOrRoundValues() {
        assertEquals(listOf(55.0, 70.0, 85.0, 100.0, 115.0, 130.0, 145.0), distributionTicks(iq, 45.0..155.0))
        assertEquals(listOf(0.0, 2.5, 5.0, 7.5), distributionTicks(dice, -1.5..7.5))
    }
}
