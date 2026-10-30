package com.zoonk.android.feature.checkpoint

import com.zoonk.api.models.Checkpoint
import com.zoonk.api.models.CheckpointPhase
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class CheckpointResultTest {
    private fun duel(
        kind: String = "boss",
        phaseComplete: Boolean = false,
        retry: String? = null,
        finished: Boolean = false,
    ): Duel {
        val read =
            checkpoint(
                kind = kind,
                fields =
                    arrayOf(
                        "nextPhase" to JsonObject(mapOf("index" to JsonPrimitive(1), "name" to JsonPrimitive("Energy"))),
                        "retry" to retry,
                        "reward" to
                            JsonObject(
                                mapOf(
                                    "badge" to JsonPrimitive(false),
                                    "brainPower" to JsonPrimitive(40),
                                    "glasses" to JsonNull,
                                    "phaseComplete" to JsonPrimitive(phaseComplete),
                                ),
                            ),
                    ),
            )
        val state = DuelState.of(read)
        return Duel(read.read(), if (finished) state.finished(wonCompletion()) else state)
    }

    @Test
    fun aWonWeeklyChallengeHasNothingBesideItsResult() {
        assertTrue(resultRows(duel(kind = "weekly"), won = true).isEmpty)
    }

    @Test
    fun aWonBossNamesTheNextPhaseOnlyOnceItsOwnIsComplete() {
        assertTrue(resultRows(duel(), won = true).isEmpty)
        assertEquals(CheckpointPhase(index = 1, name = "Energy"), resultRows(duel(phaseComplete = true), won = true).nextPhase)
    }

    @Test
    fun aLossJustFinishedTriesAgainTomorrowAndALaterPassDropsTheNextPhase() {
        assertEquals(Checkpoint.Retry.TOMORROW, resultRows(duel(finished = true), won = false).retry)

        val passed = resultRows(duel(retry = "passed"), won = false)
        assertEquals(Checkpoint.Retry.PASSED, passed.retry)
        assertNull(passed.nextPhase)
    }

    @Test
    fun theReadoutCountsOnlyTheDuelsOwnBrainPowerOrAReopenedWinsPrize() {
        assertEquals(30L, earnedBrainPower(duel(finished = true), won = true))
        assertEquals(40L, earnedBrainPower(duel(), won = true))
        assertEquals(0L, earnedBrainPower(duel(), won = false))
    }
}
