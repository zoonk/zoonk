package com.zoonk.android.feature.conversation

import android.os.Looper
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.feature.livecall.CallReservation
import com.zoonk.android.feature.livecall.LiveServerEvent
import com.zoonk.android.feature.livecall.learnerSays
import com.zoonk.android.feature.livecall.setup
import com.zoonk.api.models.LanguageConversationSetup
import kotlinx.coroutines.CompletableDeferred
import org.junit.Assert.assertEquals
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.Shadows.shadowOf
import java.util.UUID

@RunWith(AndroidJUnit4::class)
class ConversationViewModelTest {
    private val harness = ConversationHarness()
    private val client get() = harness.client
    private val model get() = harness.model()
    private val conversation get() = harness.api.stored

    private fun idle() = shadowOf(Looper.getMainLooper()).idle()

    /** A call that went live and dropped, then called again: [reconnect] is held until the gate opens. */
    private fun reconnectHeld(reconnect: LanguageConversationSetup): CompletableDeferred<Unit> {
        val gate = CompletableDeferred<Unit>()
        client.connectGates[2] = gate
        client.reservations =
            ArrayDeque(
                listOf(
                    CallReservation.Ready(setup()),
                    CallReservation.Ready(reconnect),
                    CallReservation.Ready(setup(continuesCall = true, connectionId = THIRD)),
                ),
            )
        model.start(conversation, microphone = true)
        idle()
        harness.transport.onEvent(LiveServerEvent.Started)
        harness.transport.onEvent(learnerSays("Un café", 0.0, 1000.0))
        harness.transport.onLost()
        idle()
        model.start(conversation, microphone = true)
        idle()
        return gate
    }

    @Test
    fun endingTheCallWhileACancelledReconnectIsReservingStartsNoOtherAndSavesUnderTheLatest() {
        val gate = reconnectHeld(setup(continuesCall = true, connectionId = SECOND))
        model.cancel()
        model.start(conversation, microphone = true)
        model.call?.hangUp()
        idle()

        gate.complete(Unit)
        idle()

        assertEquals("Call again waited, then didn't start once the call was ended", 2, client.connects.size)
        assertEquals(
            SECOND,
            harness.api.completions
                .single()
                .connectionId,
        )
        assertEquals(
            listOf("Un café"),
            harness.api.completions
                .single()
                .turns
                .map { it.text },
        )
    }

    private companion object {
        val SECOND: UUID = UUID.fromString("00000000-0000-4000-8000-000000000002")
        val THIRD: UUID = UUID.fromString("00000000-0000-4000-8000-000000000003")
    }
}
