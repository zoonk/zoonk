package com.zoonk.android.feature.session

import com.zoonk.api.models.StudySessionSummary
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class SessionSummaryTest {
    @Test
    fun onlySkillsThatRoseShowAndTwoAtMost() {
        val summary =
            summary(
                "skillsMoved" to
                    JsonArray(
                        listOf(
                            move("Fractions", from = "solid", to = "learning"),
                            move("Ratios", from = "new", to = "learning"),
                            move("Percent", from = "learning", to = "mastered"),
                            move("Angles", from = "learning", to = "solid"),
                        ),
                    ),
            )

        assertEquals(listOf("Ratios", "Percent"), risenSkills(summary.skillsMoved).map { it.name })
    }

    @Test
    fun missionsAreDoneOnlyWhenThisGoalsAreAllDoneAndItsBonusWasPaid() {
        val allDone = JsonArray(listOf(mission("done"), mission("done")))

        assertTrue(summary("fullMeal" to true, "missions" to allDone).missionsDone())
        assertFalse(summary("fullMeal" to false, "missions" to allDone).missionsDone())
        assertFalse(summary("fullMeal" to true, "missions" to JsonArray(listOf(mission("done"), mission("todo")))).missionsDone())
        assertFalse(summary("fullMeal" to true).missionsDone())
    }

    @Test
    fun aRewardsStepNeedsMoreThanBrainPower() {
        assertFalse(summary().hasRewardsBeyondBrainPower())
        assertFalse(summary("bestStreak" to 2).hasRewardsBeyondBrainPower())
        assertTrue(summary("bestStreak" to 3).hasRewardsBeyondBrainPower())
        assertTrue(summary("belt" to belt(stripesGained = 1)).hasRewardsBeyondBrainPower())
        assertFalse(summary("belt" to belt(stripesGained = 0)).hasRewardsBeyondBrainPower())
    }

    private fun summary(vararg overrides: Pair<String, Any?>): StudySessionSummary = decodeFixture("study-session-summary", *overrides)

    private fun move(
        name: String,
        from: String,
        to: String,
    ) = JsonObject(
        mapOf(
            "from" to from.toJson(),
            "name" to name.toJson(),
            "skillId" to "5f0c1f7e-0d3a-4c55-9d1e-6f1b0a3c2d0${name.length % 10}".toJson(),
            "to" to to.toJson(),
        ),
    )

    private fun mission(status: String) =
        JsonObject(mapOf("done" to 1.toJson(), "kind" to "review".toJson(), "status" to status.toJson(), "total" to 1.toJson()))

    private fun belt(stripesGained: Int): JsonObject {
        val level =
            JsonObject(
                mapOf(
                    "bpPerLevel" to 100.toJson(),
                    "bpToNextLevel" to 50.toJson(),
                    "color" to "yellow".toJson(),
                    "isMaxLevel" to false.toJson(),
                    "level" to 3.toJson(),
                    "progressInLevel" to 50.toJson(),
                ),
            )
        return JsonObject(
            mapOf(
                "after" to level,
                "before" to level,
                "colorChanged" to false.toJson(),
                "stripesGained" to stripesGained.toJson(),
            ),
        )
    }
}
