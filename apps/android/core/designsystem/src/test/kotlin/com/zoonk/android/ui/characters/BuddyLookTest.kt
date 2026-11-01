package com.zoonk.android.ui.characters

import com.zoonk.api.models.LearnerSummaryBuddy
import org.junit.Test

class BuddyLookTest {
    @Test
    fun knowsEveryKindAndPairOfGlassesTheApiSends() {
        LearnerSummaryBuddy.Kind.entries.forEach { BuddyKind.of(it.value) }
        LearnerSummaryBuddy.Glasses.entries.forEach { BuddyGlasses.of(it.value) }
        LearnerSummaryBuddy.BeltColor.entries.forEach {
            LearnerSummaryBuddy(it, null, LearnerSummaryBuddy.Glasses.ROUND, LearnerSummaryBuddy.Kind.ZU, null, false).look()
        }
    }
}
