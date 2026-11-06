package com.zoonk.android.feature.conversation

import com.zoonk.android.feature.livecall.LiveCallFailure
import com.zoonk.android.feature.livecall.LiveCallPhase
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class DroppedCallTest {
    private fun reconnect(
        failure: LiveCallFailure?,
        micBlocked: Boolean = false,
    ) = droppedCall(continuing = true, LiveCallPhase.Failed, failure, micBlocked)

    @Test
    fun aDroppedCallsReconnectSaysWhyItCantGoOnAndOffersAWayBackOnlyWhenOneCanWork() {
        val plain = DroppedCall(reason = null, DroppedRetry.CallAgain)
        // A connect failure is also a reconnect the learner cancelled while it rang.
        assertEquals(plain, reconnect(LiveCallFailure.Connect))
        assertEquals(plain, reconnect(LiveCallFailure.Dropped))
        assertEquals(DroppedCall(DroppedReason.CallsPaused, DroppedRetry.CallAgain), reconnect(LiveCallFailure.CallsPaused))
        assertEquals(DroppedCall(DroppedReason.CallInProgress, DroppedRetry.Takeover), reconnect(LiveCallFailure.CallInProgress))
        assertEquals(DroppedCall(DroppedReason.Limit, retry = null), reconnect(LiveCallFailure.Limit))
        assertEquals(DroppedCall(DroppedReason.PlusRequired, retry = null), reconnect(LiveCallFailure.PlusRequired))
        assertEquals(DroppedCall(DroppedReason.Ended, retry = null), reconnect(LiveCallFailure.Ended))
    }

    @Test
    fun aMicrophoneRefusedForTheReconnectOffersItAgainOrTyping() {
        val microphone = DroppedCall(DroppedReason.Microphone, DroppedRetry.Microphone)
        assertEquals(microphone, reconnect(LiveCallFailure.Connect, micBlocked = true))
        assertEquals(microphone, droppedCall(continuing = false, LiveCallPhase.Failed, LiveCallFailure.Dropped, micBlocked = true))
    }

    @Test
    fun aFirstCallThatDroppedShowsThePlainLine() {
        assertEquals(
            DroppedCall(reason = null, DroppedRetry.CallAgain),
            droppedCall(continuing = false, LiveCallPhase.Failed, LiveCallFailure.Dropped, micBlocked = false),
        )
    }

    @Test
    fun aFirstCallsOwnProblemsAndAReconnectOnItsWayKeepTheirScreens() {
        assertNull(droppedCall(continuing = false, LiveCallPhase.Failed, LiveCallFailure.Connect, micBlocked = false))
        assertNull(droppedCall(continuing = false, LiveCallPhase.Failed, LiveCallFailure.PlusRequired, micBlocked = true))
        assertNull(droppedCall(continuing = true, LiveCallPhase.Connecting, failure = null, micBlocked = false))
        assertNull(droppedCall(continuing = true, LiveCallPhase.Connecting, failure = null, micBlocked = true))
    }
}
