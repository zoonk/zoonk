package com.zoonk.android.feature.tutor

import com.zoonk.android.feature.plan.planChange
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

/** A conversation asks about one plan change at a time: its newest proposal. */
class LiveProposalTest {
    private fun proposing(
        turn: String,
        change: String,
        status: String = "proposed",
    ) = turn(turn, TutorTurn.Status.Completed, "Here.").copy(planChange = planChange(status = status, id = change))

    @Test
    fun theNewestProposalIsTheOneStillAsked() {
        val turns = listOf(proposing("t1", OLDER), proposing("t2", NEWER))

        assertEquals(NEWER, liveProposal(turns)?.id.toString())
    }

    @Test
    fun answeringTheNewestProposalLeavesNothingAsked() {
        val declined = listOf(proposing("t1", OLDER), proposing("t2", NEWER, status = "declined"))
        val applied = listOf(proposing("t1", OLDER), proposing("t2", NEWER, status = "applied"))

        assertNull(liveProposal(declined))
        assertNull(liveProposal(applied))
    }

    @Test
    fun earlierTurnsLoadedAboveLeaveTheNewestAsked() {
        val turns = listOf(proposing("t0", EARLIEST), proposing("t1", OLDER), proposing("t2", NEWER))

        assertEquals(NEWER, liveProposal(turns)?.id.toString())
    }

    @Test
    fun aConversationWithNoProposalAsksNothing() {
        assertNull(liveProposal(listOf(turn("t1", TutorTurn.Status.Completed, "Here."))))
    }

    private companion object {
        const val EARLIEST = "00000000-0000-4000-8000-000000000000"
        const val OLDER = "11111111-1111-4111-8111-111111111111"
        const val NEWER = "22222222-2222-4222-8222-222222222222"
    }
}
