package com.zoonk.android.feature.livecall

import com.zoonk.android.ui.components.Limit
import com.zoonk.android.ui.components.LimitPeriod
import com.zoonk.android.ui.components.LimitTier
import com.zoonk.api.models.ExamSpeakingTaskCuesInner
import com.zoonk.api.models.LanguageConversationSetup.EndsAtLimit
import com.zoonk.api.models.LanguageConversationTurn
import com.zoonk.api.models.LanguageConversationTurn.Speaker
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.advanceTimeBy
import kotlinx.coroutines.test.runCurrent
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import kotlin.time.Duration
import kotlin.time.Duration.Companion.milliseconds
import kotlin.time.Duration.Companion.seconds

@OptIn(ExperimentalCoroutinesApi::class)
class LiveCallTest {
    private val dispatcher = StandardTestDispatcher()
    private val client = FakeCallClient()
    private val transports = mutableListOf<FakeTransport>()
    private val transport get() = transports.single()
    private val script =
        LiveCallScript(
            openingLine = "Hola, ¿qué desea?",
            objectives = listOf("Order a coffee", "Ask the price"),
            met = emptyList(),
            minutes = 5,
        )

    private fun TestScope.call(script: LiveCallScript = this@LiveCallTest.script) =
        LiveCall(
            script = script,
            client = client,
            transports = { microphone, onEvent, onLost -> FakeTransport(microphone, onEvent, onLost).also(transports::add) },
            scope = CoroutineScope(SupervisorJob() + dispatcher),
            timeSource = testScheduler.timeSource,
        )

    private fun TestScope.live(call: LiveCall): LiveCall {
        call.start(microphone = true)
        runCurrent()
        transport.onEvent(LiveServerEvent.Started)
        runCurrent()
        return call
    }

    private fun TestScope.wait(duration: Duration) {
        advanceTimeBy(duration)
        runCurrent()
    }

    private val LiveCall.phase get() = state.value.phase

    @Test
    fun aCallReservesConnectsAndOpensWithItsLineOnceTheSessionStarts() =
        runTest(dispatcher) {
            val call = call()
            call.start(microphone = true)
            runCurrent()

            assertEquals(LiveCallPhase.Connecting, call.phase)
            assertEquals(listOf(false), client.connects)
            assertEquals(listOf(CONNECTION to "offer"), client.redeemed)
            assertEquals("answer", transport.answer)
            assertTrue(transport.microphone)
            assertTrue(transport.sent.isEmpty())

            transport.onEvent(LiveServerEvent.Started)
            runCurrent()

            assertEquals(LiveCallPhase.Live, call.phase)
            assertEquals(300L, call.state.value.limitSeconds)
            assertEquals(listOf(LiveCallCue.opening("Hola, ¿qué desea?")), transport.instructions)
        }

    @Test
    fun aDeniedMicrophoneRunsTheCallOnSilenceAndCantMute() =
        runTest(dispatcher) {
            val call = call()
            call.start(microphone = false)
            runCurrent()
            transport.onEvent(LiveServerEvent.Started)
            runCurrent()

            assertFalse(transport.microphone)
            assertTrue(call.state.value.micBlocked)
            call.toggleMute()
            assertFalse(call.state.value.muted)
            assertTrue(transport.sent.none { it is LiveClientCommand.Mute })
        }

    @Test
    fun muteGoesToTheCallWhileItsLive() =
        runTest(dispatcher) {
            val call = live(call())

            call.toggleMute()
            call.toggleMute()

            assertEquals(
                listOf(LiveClientCommand.Mute(true), LiveClientCommand.Mute(false)),
                transport.sent.filterIsInstance<LiveClientCommand.Mute>(),
            )
            assertFalse(call.state.value.muted)
        }

    @Test
    fun theOpeningIsSentOnceMoreOnlyWhileTheCharacterStaysSilent() =
        runTest(dispatcher) {
            client.reservations = ArrayDeque(listOf(CallReservation.Ready(setup()), CallReservation.Ready(setup())))
            val quiet = live(call())
            wait(LiveCall.OPENING_RETRY)
            assertEquals(2, transport.instructions.count { it == LiveCallCue.opening(script.openingLine) })
            quiet.hangUp()

            transports.clear()
            live(call())
            transport.onEvent(characterSays("Hola"))
            wait(LiveCall.OPENING_RETRY)
            assertEquals(1, transport.instructions.count { it == LiveCallCue.opening(script.openingLine) })
        }

    @Test
    fun aReplyTypedWhileConnectingGoesOutOnceTheCallIsLive() =
        runTest(dispatcher) {
            val call = call()
            call.start(microphone = true)
            runCurrent()

            call.sendText("  Un café, por favor  ")
            assertTrue(transport.instructions.isEmpty())
            assertEquals(listOf(TranscriptTurn(Speaker.LEARNER, "Un café, por favor")), call.state.value.turns)

            transport.onEvent(LiveServerEvent.Started)
            runCurrent()
            assertEquals(LiveCallCue.typedReply("Un café, por favor"), transport.instructions.last())

            call.sendText("¿Cuánto es?")
            assertEquals(LiveCallCue.typedReply("¿Cuánto es?"), transport.instructions.last())
        }

    @Test
    fun goalsAreCheckedOnceTheCharacterAnswersTheLearner() =
        runTest(dispatcher) {
            client.met = { listOf("Order a coffee") }
            val call = live(call())

            transport.onEvent(characterSays("¿Qué desea?"))
            wait(LiveCall.REPLY_SETTLED)
            assertTrue("A character speaking first checks nothing", client.checks.isEmpty())

            transport.onEvent(learnerSays("Un ", 1000.0, 1400.0))
            transport.onEvent(learnerSays("café.", 1400.0, 2000.0))
            transport.onEvent(characterSays("Claro."))
            wait(LiveCall.REPLY_SETTLED - 1.milliseconds)
            assertTrue(client.checks.isEmpty())
            wait(1.milliseconds)

            val said =
                listOf(
                    LanguageConversationTurn(Speaker.CHARACTER, "¿Qué desea?"),
                    LanguageConversationTurn(Speaker.LEARNER, "Un café."),
                    LanguageConversationTurn(Speaker.CHARACTER, "Claro."),
                )
            assertEquals(listOf(said), client.checks)
            assertEquals(listOf("Order a coffee"), call.state.value.metLabels)
            assertEquals(
                LiveCallCue.objectivesProgress(met = listOf("Order a coffee"), open = listOf("Ask the price")),
                transport.thinking.single().content,
            )
        }

    @Test
    fun aTurnEndingDuringACheckIsCheckedRightAfterIt() =
        runTest(dispatcher) {
            val gate = CompletableDeferred<Unit>()
            client.checkGate = gate
            live(call())

            transport.onEvent(learnerSays("Hola", 0.0, 500.0))
            transport.onEvent(characterSays("Hola"))
            wait(LiveCall.REPLY_SETTLED)
            transport.onEvent(learnerSays("Un café", 900.0, 1500.0))
            transport.onEvent(characterSays("Sí"))
            wait(LiveCall.REPLY_SETTLED)
            assertEquals(1, client.checks.size)

            gate.complete(Unit)
            runCurrent()
            assertEquals(2, client.checks.size)
            assertEquals(4, client.checks.last().size)
        }

    @Test
    fun anExamTaskSendsItsCuesAndChecksNoGoals() =
        runTest(dispatcher) {
            val exam =
                script.copy(
                    objectives = emptyList(),
                    examCues = listOf(ExamSpeakingTaskCuesInner(10, "Ask the second question"), ExamSpeakingTaskCuesInner(15, "Move on")),
                )
            live(call(exam))

            transport.onEvent(learnerSays("Creo que sí", 0.0, 900.0))
            transport.onEvent(characterSays("Bien"))
            wait(10.seconds)
            assertTrue(client.checks.isEmpty())
            assertEquals("Ask the second question", transport.instructions.last())
            wait(5.seconds)
            assertEquals("Move on", transport.instructions.last())
        }

    @Test
    fun theCharacterWrapsUpBeforeTheTimeIsUpAndTheCallEndsAtIt() =
        runTest(dispatcher) {
            client.reservations = ArrayDeque(listOf(CallReservation.Ready(setup(seconds = 30, endsAtLimit = EndsAtLimit.DAY))))
            val call = live(call())

            wait(9.seconds)
            assertNull(call.state.value.limitNear)
            wait(1.seconds)
            assertEquals(LiveCallCue.WRAP_UP, transport.instructions.last())
            assertEquals(EndsAtLimit.DAY, call.state.value.limitNear)
            assertEquals(10L, call.state.value.elapsedSeconds)

            wait(20.seconds)
            assertEquals(LiveCallPhase.Ended, call.phase)
            assertTrue(transport.silenced)
            assertFalse("The silence nudge never interrupts a wrap-up", LiveCallCue.SILENCE in transport.instructions)
        }

    @Test
    fun aQuietLearnerIsAskedOnceThenTheCallEnds() =
        runTest(dispatcher) {
            val call = live(call())

            wait(LiveCall.SILENCE_NUDGE)
            assertEquals(LiveCallCue.SILENCE, transport.instructions.last())
            wait(10.seconds)
            call.sendText("Sí, aquí estoy")
            wait(LiveCall.SILENCE_END - 1.seconds)
            assertEquals(LiveCallPhase.Live, call.phase)
            assertEquals("A word resets the nudge", 2, transport.instructions.count { it == LiveCallCue.SILENCE })

            wait(1.seconds)
            assertEquals(LiveCallPhase.Ended, call.phase)
        }

    @Test
    fun aRefusedReservationShowsItsProblemAndOpensNoPeer() =
        runTest(dispatcher) {
            val limit = Limit.Reached(LimitTier.Free, LimitPeriod.Month)
            client.reservations = ArrayDeque(listOf(CallReservation.Limited(limit)))
            val call = call()
            call.start(microphone = true)
            runCurrent()

            assertEquals(LiveCallPhase.Failed, call.phase)
            assertEquals(LiveCallFailure.Limit, call.state.value.failure)
            assertEquals(limit, call.state.value.limit)
            assertTrue(transports.isEmpty())
            assertTrue(client.ended.isEmpty())
        }

    @Test
    fun aPreviousConnectionStillClosingIsAskedOnceMore() =
        runTest(dispatcher) {
            client.reservations = ArrayDeque(listOf(CallReservation.PreviousConnectionClosing, CallReservation.Ready(setup())))
            val second = CompletableDeferred<Unit>()
            client.connectGates[2] = second
            val call = call()
            call.start(microphone = true, takeover = true)
            runCurrent()
            assertEquals(listOf(true, true), client.connects)
            assertTrue(call.state.value.reconnecting)

            second.complete(Unit)
            runCurrent()
            transport.onEvent(LiveServerEvent.Started)
            runCurrent()
            assertEquals(LiveCallPhase.Live, call.phase)
            assertFalse(call.state.value.reconnecting)
        }

    @Test
    fun aCallThatNeverStartsFailsToConnectAndHangsUp() =
        runTest(dispatcher) {
            val call = call()
            call.start(microphone = true)
            runCurrent()

            wait(LiveCall.CONNECT_TIMEOUT)

            assertEquals(LiveCallFailure.Connect, call.state.value.failure)
            assertTrue(transport.closed)
            assertEquals(listOf(CONNECTION), client.ended)
        }

    @Test
    fun theServerClosingTheSessionEndsALiveCallButFailsOneConnecting() =
        runTest(dispatcher) {
            client.reservations = ArrayDeque(listOf(CallReservation.Ready(setup()), CallReservation.Ready(setup())))
            val call = live(call())
            transport.onEvent(LiveServerEvent.Closed)
            assertEquals(LiveCallPhase.Ended, call.phase)

            transports.clear()
            val early = call()
            early.start(microphone = true)
            runCurrent()
            transport.onEvent(LiveServerEvent.Closed)
            assertEquals(LiveCallFailure.Connect, early.state.value.failure)
        }

    @Test
    fun aLostConnectionEndsTheCallWhenTheServerHungUpAtTheDeadline() =
        runTest(dispatcher) {
            client.endAnswers = ArrayDeque(listOf(true))
            val call = live(call())

            transport.onLost()
            runCurrent()

            assertEquals(LiveCallPhase.Ended, call.phase)
            assertEquals(listOf(CONNECTION), client.ended)
        }

    @Test
    fun aLostConnectionOtherwiseShowsTheCallDropped() =
        runTest(dispatcher) {
            client.endAnswers = ArrayDeque(listOf(false))
            val call = live(call())

            transport.onLost()
            runCurrent()

            assertEquals(LiveCallFailure.Dropped, call.state.value.failure)
        }

    @Test
    fun leavingALiveCallDropsItAndHangsItUp() =
        runTest(dispatcher) {
            val call = live(call())

            call.leave()
            runCurrent()

            assertEquals(LiveCallFailure.Dropped, call.state.value.failure)
            assertTrue(transport.silenced)
            assertTrue(transport.closed)
            assertEquals(listOf(CONNECTION), client.ended)
        }

    @Test
    fun aStartLeftBeforeItsReservationCameEndsThatReservation() =
        runTest(dispatcher) {
            val gate = CompletableDeferred<Unit>()
            client.connectGates[1] = gate
            val call = call()
            call.start(microphone = true)
            runCurrent()

            call.leave()
            gate.complete(Unit)
            runCurrent()

            assertEquals(LiveCallFailure.Connect, call.state.value.failure)
            assertTrue(transports.isEmpty())
            assertEquals(listOf(CONNECTION), client.ended)
        }

    @Test
    fun anUnconfirmedHangupIsAskedAgainAndAConfirmedOneIsnt() =
        runTest(dispatcher) {
            client.endAnswers = ArrayDeque(listOf(null, false))
            val call = live(call())
            call.hangUp()

            var first: Boolean? = null
            launch { first = call.release() }
            runCurrent()
            assertEquals(false, first)

            var second: Boolean? = null
            launch { second = call.release() }
            launch { call.release() }
            runCurrent()
            assertEquals(true, second)
            assertEquals(2, client.ended.size)

            launch { call.release() }
            runCurrent()
            assertEquals(2, client.ended.size)
        }

    @Test
    fun finishingHangsUpThenReturnsWhatWasSaid() =
        runTest(dispatcher) {
            val call = live(call())
            transport.onEvent(characterSays("¿Qué desea?"))
            transport.onEvent(learnerSays("Un café", 1000.0, 2600.0))
            call.sendText("Con leche")
            call.hangUp()

            var summary: LiveCallSummary? = null
            launch { summary = call.finish() }
            runCurrent()

            assertEquals(listOf(CONNECTION), client.ended)
            assertTrue(transport.closed)
            assertEquals(CONNECTION, summary?.connectionId)
            assertEquals(2L, summary?.spokenSeconds)
            assertEquals(
                listOf(
                    LanguageConversationTurn(Speaker.CHARACTER, "¿Qué desea?"),
                    LanguageConversationTurn(Speaker.LEARNER, "Un café"),
                    LanguageConversationTurn(Speaker.LEARNER, "Con leche"),
                ),
                summary?.turns,
            )
        }

    @Test
    fun aDelegationIsAnsweredWithNothingToLookUp() =
        runTest(dispatcher) {
            live(call())
            transport.onEvent(LiveServerEvent.Delegation("del_1"))

            assertEquals(LiveClientCommand.Thinking(LiveCallCue.NO_BACKEND, "del_1"), transport.thinking.single())
        }
}
