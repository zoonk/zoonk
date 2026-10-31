package com.zoonk.android.ui.characters

import com.zoonk.android.ui.components.Belt
import com.zoonk.api.models.LearnerSummaryBuddy
import org.junit.Assert.assertEquals
import org.junit.Test

class BuddyLookTest {
    @Test
    fun napsUnderThirtyEnergyOnlyOnADayWithoutStudy() {
        assertEquals(BuddyEnergyState.Napping, BuddyLook(energy = 29.0).energyState)
        assertEquals(BuddyEnergyState.Awake, BuddyLook(energy = 29.0, studiedToday = true).energyState)
        assertEquals(BuddyEnergyState.Awake, BuddyLook(energy = 30.0).energyState)
    }

    @Test
    fun glowsFromEightyAndIsAwakeBeforeAnyEnergy() {
        assertEquals(BuddyEnergyState.Glowing, BuddyLook(energy = 80.0).energyState)
        assertEquals(BuddyEnergyState.Awake, BuddyLook(energy = null).energyState)
        assertEquals(0f, BuddyLook(energy = null).glow)
        assertEquals(1f, BuddyLook(energy = 120.0).glow)
        assertEquals(0.5f, BuddyLook(energy = 50.0).glow)
    }

    @Test
    fun showsItsEnergyInItsEverydayFace() {
        assertEquals(BuddyExpression.Sleepy, BuddyLook(energy = 10.0).everydayExpression)
        assertEquals(BuddyExpression.Happy, BuddyLook(energy = 50.0).everydayExpression)
        assertEquals(BuddyExpression.Cheer, BuddyLook(energy = 90.0).everydayExpression)
    }

    @Test
    fun growsWithTheBelt() {
        assertEquals(
            listOf(BuddyStage.Baby, BuddyStage.Baby, BuddyStage.Young, BuddyStage.Young) + List(6) { BuddyStage.Adult },
            Belt.entries.map { BuddyLook(belt = it).stage },
        )
    }

    @Test
    fun readsTheSummarysBuddy() {
        val buddy =
            LearnerSummaryBuddy(
                beltColor = LearnerSummaryBuddy.BeltColor.ORANGE,
                energy = 12.0,
                glasses = LearnerSummaryBuddy.Glasses.CAT_EYE,
                kind = LearnerSummaryBuddy.Kind.OTTO,
                name = "Octavia",
                studiedToday = true,
            )

        assertEquals(BuddyLook(BuddyKind.Otto, BuddyGlasses.CatEye, Belt.Orange, energy = 12.0, studiedToday = true), buddy.look())
    }

    @Test
    fun knowsEveryKindAndPairOfGlassesTheApiSends() {
        LearnerSummaryBuddy.Kind.entries.forEach { BuddyKind.of(it.value) }
        LearnerSummaryBuddy.Glasses.entries.forEach { BuddyGlasses.of(it.value) }
        LearnerSummaryBuddy.BeltColor.entries.forEach {
            LearnerSummaryBuddy(it, null, LearnerSummaryBuddy.Glasses.ROUND, LearnerSummaryBuddy.Kind.ZU, null, false).look()
        }
    }
}
