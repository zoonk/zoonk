package com.zoonk.android.feature.livecall

import com.zoonk.android.data.AnalyticsEvent
import com.zoonk.android.ui.components.Limit
import com.zoonk.android.ui.components.LimitPeriod
import com.zoonk.android.ui.components.LimitTier
import com.zoonk.api.models.ExamSpeakingTaskCuesInner
import com.zoonk.api.models.LanguageConversationObjectiveCheck
import com.zoonk.api.models.LanguageConversationSetup
import com.zoonk.api.models.LanguageConversationTurn
import com.zoonk.api.models.LanguageConversationTurn.Speaker
import com.zoonk.api.models.LiveCallCue
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.advanceTimeBy
import kotlinx.coroutines.test.currentTime
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
    private val events = mutableListOf<AnalyticsEvent>()
    private val task = LiveCallTask(kind = "practice", objectives = listOf("Order a coffee", "Ask the price"), met = emptyList())
    private val cues = SCRIPT.cues

    private fun TestScope.call(task: LiveCallTask = this@LiveCallTest.task) =
        LiveCall(
            task = task,
            client = client,
            transports = { microphone, signals -> FakeTransport(microphone, signals).also(transports::add) },
            scope = CoroutineScope(SupervisorJob() + dispatcher),
            analytics = { events += it },
            timeSource = testScheduler.timeSource,
        )

    private fun TestScope.live(
        call: LiveCall = call(),
        setup: LanguageConversationSetup = setup(),
    ): LiveCall {
        client.reservations = ArrayDeque(listOf(CallReservation.Ready(setup)))
        call.start(microphone = true)
        runCurrent()
        transport.onEvent(LiveServerEvent.Started)
        runCurrent()
        return call
    }

    /** A call whose talk time ends 20 s in, and whose server hangs up 45 s later; the character greets the learner first. */
    private fun TestScope.greeted(task: LiveCallTask = this@LiveCallTest.task): LiveCall {
        val call = live(call(task), setup(talkSeconds = 20))
        characterTalks(until = 1.seconds)
        return call
    }

    private fun TestScope.wait(duration: Duration) {
        advanceTimeBy(duration)
        runCurrent()
    }

    private fun TestScope.waitUntil(time: Duration) = wait(time - currentTime.milliseconds)

    /** The learner's microphone hears them from now until [until], sampled as the peer's stats are. */
    private fun TestScope.learnerTalks(until: Duration) {
        while (currentTime.milliseconds < until) {
            transport.voice()
            runCurrent()
            wait(VOICE_SAMPLE)
        }
    }

    /** The character's words arrive from now until [until], each placed on the session's timeline at its arrival. */
    private fun TestScope.characterTalks(until: Duration) {
        do {
            val at = currentTime.toDouble()
            transport.onEvent(characterSays("palabra ", at, at + FRAGMENT.inWholeMilliseconds))
            runCurrent()
            wait(FRAGMENT)
        } while (currentTime.milliseconds < until)
    }

    /** The learner says something until 3 s in, heard by the microphone and transcribed. */
    private fun TestScope.learnerAnswers() {
        learnerTalks(until = 3.seconds)
        transport.onEvent(learnerSays("Un café", 1200.0, 2800.0))
        runCurrent()
    }

    private val FakeTransport.goodbyes get() = appended.filter { it.content == cues.goodbye.text || it.content == cues.goodbyeDone.text }

    private val FakeTransport.checkIns get() = commentary.count { it.content == cues.checkIn.text }

    /** The session took the latest goodbye cue at [atMs] on its timeline, now by default. */
    private fun TestScope.goodbyeTaken(atMs: Double = currentTime.toDouble()) {
        transport.onEvent(LiveServerEvent.CueTaken(requireNotNull(transport.goodbyes.last().eventId), atMs))
        runCurrent()
    }

    private fun TestScope.openingTaken() {
        transport.onEvent(LiveServerEvent.CueTaken(requireNotNull(transport.openings.last().eventId), currentTime.toDouble()))
        runCurrent()
    }

    private val FakeTransport.openings get() = commentary.filter { it.content == cues.opening.text }

    private val LiveCall.phase get() = state.value.phase

    private val endReasons get() = events.filterIsInstance<AnalyticsEvent.CallEnded>().map { it.reason }

    @Test
    fun aCallReservesConnectsAndOpensWithTheServersCueOnceTheSessionStarts() =
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
            assertEquals(300L, call.state.value.talkSeconds)
            assertEquals(listOf(cues.opening.text), transport.commentary.map { it.content })
            assertEquals(1, transport.sent.size)
        }

    @Test
    fun theCallIsAnsweredOnlyOnceTheCharacterSpeaks() =
        runTest(dispatcher) {
            val call = live()
            wait(0.7.seconds)
            assertFalse("Connected, but the character hasn't spoken", call.state.value.answered)

            transport.onEvent(characterSays("Hola", 700.0, 1000.0))
            runCurrent()
            assertTrue(call.state.value.answered)
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
    fun muteGoesToTheCallWhileItsLiveAndAMutedMicrophoneHearsNoOne() =
        runTest(dispatcher) {
            val call = live()

            call.toggleMute()
            transport.voice()
            runCurrent()
            assertFalse(call.state.value.learnerSpeaking)
            call.toggleMute()
            transport.voice()
            runCurrent()

            assertEquals(
                listOf(LiveClientCommand.Mute(true), LiveClientCommand.Mute(false)),
                transport.sent.filterIsInstance<LiveClientCommand.Mute>(),
            )
            assertTrue(call.state.value.learnerSpeaking)
        }

    @Test
    fun theOpeningIsSentOnceMoreOnlyWhileTheCharacterStaysSilentAfterTakingIt() =
        runTest(dispatcher) {
            val quiet = live()
            wait(2.seconds)
            openingTaken()
            wait(4.8.seconds)
            assertEquals(1, transport.openings.size)
            wait(0.2.seconds)
            assertEquals("5 s after the session took it", 2, transport.openings.size)
            wait(10.seconds)
            assertEquals(2, transport.openings.size)
            quiet.hangUp()

            transports.clear()
            live()
            openingTaken()
            transport.onEvent(characterSays("Hola"))
            wait(10.seconds)
            assertEquals(1, transport.openings.size)
        }

    @Test
    fun aSlowStartIsNotGreetedTwice() =
        runTest(dispatcher) {
            live()

            wait(6.7.seconds)
            assertEquals("Not taken yet: the first opening is still on its way", 1, transport.openings.size)
            openingTaken()
            transport.onEvent(characterSays("Hola"))
            wait(10.seconds)
            assertEquals(1, transport.openings.size)
        }

    @Test
    fun aReplyTypedWhileConnectingGoesOutOnceTheCallIsLive() =
        runTest(dispatcher) {
            val call = call()
            call.start(microphone = true)
            runCurrent()

            call.sendText("  Un café, por favor  ")
            assertTrue(transport.sent.isEmpty())
            assertEquals(listOf(TranscriptTurn(Speaker.LEARNER, "Un café, por favor")), call.state.value.turns)

            transport.onEvent(LiveServerEvent.Started)
            runCurrent()
            assertEquals("They typed: \"Un café, por favor\"", transport.commentary.last().content)

            call.sendText("¿Cuánto es?")
            assertEquals("They typed: \"¿Cuánto es?\"", transport.commentary.last().content)
        }

    @Test
    fun goalsAreCheckedOnceTheCharacterAnswersTheLearnerAndTheServersProgressIsPassedOn() =
        runTest(dispatcher) {
            val progress = LiveCallCue(LiveCallCue.Channel.THINKING, "They ordered; the price is left")
            client.check =
                { LanguageConversationObjectiveCheck(goodbye = false, objectivesMet = listOf("Order a coffee"), progress = progress) }
            val call = live()

            transport.onEvent(characterSays("¿Qué desea?"))
            wait(LiveCall.REPLY_SETTLED)
            assertTrue("A character speaking first checks nothing", client.checks.isEmpty())

            transport.onEvent(learnerSays("Un ", 1000.0, 1400.0))
            transport.onEvent(learnerSays("café.", 1400.0, 2000.0))
            transport.onEvent(characterSays("Claro.", 2400.0, 2900.0))
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
            assertEquals(progress.command(), transport.thinking.single())
            assertNull(call.state.value.ending)
        }

    @Test
    fun aTurnEndingDuringACheckIsCheckedRightAfterIt() =
        runTest(dispatcher) {
            val gate = CompletableDeferred<Unit>()
            client.checkGate = gate
            live()

            transport.onEvent(learnerSays("Hola", 0.0, 500.0))
            transport.onEvent(characterSays("Hola", 700.0, 1000.0))
            wait(LiveCall.REPLY_SETTLED)
            transport.onEvent(learnerSays("Un café", 2900.0, 3500.0))
            transport.onEvent(characterSays("Sí", 3800.0, 4000.0))
            wait(LiveCall.REPLY_SETTLED)
            assertEquals("The running check holds the next", 1, client.checks.size)

            gate.complete(Unit)
            wait(LiveCall.REPLY_SETTLED)
            assertEquals(2, client.checks.size)
            assertEquals(4, client.checks.last().size)
        }

    @Test
    fun anExamTaskSendsItsCuesAndChecksNoGoals() =
        runTest(dispatcher) {
            val exam =
                task.copy(
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
    fun atTheTalkTimeALearnerWhoIsSpeakingGetsTheGoodbyeAtOnce() =
        runTest(dispatcher) {
            val call = greeted()

            waitUntil(19.seconds)
            learnerTalks(until = 19.8.seconds)
            assertTrue(transport.goodbyes.isEmpty())
            learnerTalks(until = 20.2.seconds)

            assertEquals(listOf(cues.goodbye.text), transport.goodbyes.map { it.content })
            assertEquals(
                "Said aloud at once, it would talk over a pause in the answer",
                LiveCallCue.Channel.THINKING,
                transport.goodbyes.single().channel,
            )
            assertEquals(EndingReason.Time, call.state.value.ending)
        }

    @Test
    fun atTheTalkTimeTheCharacterFinishesFirstThenTheLearnerAnswers() =
        runTest(dispatcher) {
            greeted()

            waitUntil(18.seconds)
            characterTalks(until = 23.seconds)
            wait(1.seconds)
            assertTrue("Nothing interrupts the character", transport.goodbyes.isEmpty())

            learnerTalks(until = 25.2.seconds)
            assertEquals(1, transport.goodbyes.size)
        }

    @Test
    fun atTheTalkTimeAnIdleLearnerIsGivenEightSecondsToAnswerAndNotCheckedOn() =
        runTest(dispatcher) {
            greeted()
            waitUntil(17.seconds)
            characterTalks(until = 19.seconds)

            waitUntil(28.2.seconds)
            assertTrue(transport.goodbyes.isEmpty())
            wait(0.2.seconds)
            assertEquals("8 s after the character stopped, at 20.3 s", 1, transport.goodbyes.size)
            assertEquals("Nobody talks: said aloud at once", LiveCallCue.Channel.COMMENTARY, transport.goodbyes.single().channel)

            wait(30.seconds)
            assertEquals("No check-in once the ending started", 0, transport.checkIns)
        }

    @Test
    fun aGoodbyeSentWhileTheLearnerGivesALongAnswerIsSentAgainOnlyOnceTheyStopAndNothingComes() =
        runTest(dispatcher) {
            greeted()

            waitUntil(19.seconds)
            learnerTalks(until = 40.seconds)
            assertEquals(1, transport.goodbyes.size)

            waitUntil(47.6.seconds)
            assertEquals(1, transport.goodbyes.size)
            wait(0.4.seconds)
            assertEquals(2, transport.goodbyes.size)
            wait(30.seconds)
            assertEquals(2, transport.goodbyes.size)
        }

    @Test
    fun theCallHangsUpThreeSecondsAfterTheGoodbyeWithNothingElseHappening() =
        runTest(dispatcher) {
            val call = greeted()
            waitUntil(19.seconds)
            learnerTalks(until = 21.seconds)
            goodbyeTaken()
            characterTalks(until = 23.seconds)
            assertTrue(call.state.value.sayingGoodbye)

            waitUntil(25.6.seconds)
            assertEquals(LiveCallPhase.Live, call.phase)
            waitUntil(25.8.seconds)
            assertEquals("3 s after its last words, at 22.8 s", LiveCallPhase.Ended, call.phase)
            assertEquals(listOf("time"), endReasons)
        }

    @Test
    fun theCallStaysWhileTheLearnerKeepsTalkingOrTypingAfterTheGoodbye() =
        runTest(dispatcher) {
            val call = greeted()
            waitUntil(19.seconds)
            learnerTalks(until = 21.seconds)
            goodbyeTaken()
            characterTalks(until = 23.seconds)

            learnerTalks(until = 30.seconds)
            repeat(4) {
                call.typed()
                wait(2.seconds)
            }
            assertEquals(LiveCallPhase.Live, call.phase)
            waitUntil(39.seconds)
            assertEquals(LiveCallPhase.Live, call.phase)
            waitUntil(39.2.seconds)
            assertEquals("3 s after the last keystroke, at 36.1 s", LiveCallPhase.Ended, call.phase)
        }

    @Test
    fun aLearnerAnsweringTheGoodbyeAndTheCharacterReplyingStartsTheQuietAgain() =
        runTest(dispatcher) {
            val call = greeted()
            waitUntil(19.seconds)
            learnerTalks(until = 21.seconds)
            goodbyeTaken()
            characterTalks(until = 23.seconds)

            wait(1.seconds)
            learnerTalks(until = 25.seconds)
            wait(1.seconds)
            characterTalks(until = 27.seconds)
            waitUntil(29.6.seconds)
            assertEquals(LiveCallPhase.Live, call.phase)
            waitUntil(29.8.seconds)
            assertEquals("3 s after the character's reply, at 26.7 s", LiveCallPhase.Ended, call.phase)
        }

    @Test
    fun theHardStopEndsTheCallWhateverIsHappening() =
        runTest(dispatcher) {
            val call = greeted()

            learnerTalks(until = 64.8.seconds)
            assertEquals(LiveCallPhase.Live, call.phase)
            learnerTalks(until = 65.2.seconds)

            assertEquals(LiveCallPhase.Ended, call.phase)
            assertTrue(transport.silenced)
            assertEquals(listOf("hard_stop"), endReasons)
        }

    @Test
    fun everyGoalMetEndsTheCallWithAThankYouGoodbye() =
        runTest(dispatcher) {
            client.check = { LanguageConversationObjectiveCheck(goodbye = false, objectivesMet = task.objectives, progress = null) }
            val call = greeted()

            learnerAnswers()
            characterTalks(until = 4.seconds)
            wait(LiveCall.REPLY_SETTLED)
            assertEquals(EndingReason.Done, call.state.value.ending)

            wait(8.seconds)
            assertEquals(listOf(cues.goodbyeDone.text), transport.goodbyes.map { it.content })
            assertTrue(transport.thinking.isEmpty())
        }

    @Test
    fun aMutualGoodbyeTheCheckFoundEndsTheCallWithoutACue() =
        runTest(dispatcher) {
            client.check = { LanguageConversationObjectiveCheck(goodbye = true, objectivesMet = emptyList(), progress = null) }
            val call = greeted()

            learnerAnswers()
            characterTalks(until = 4.seconds)
            wait(LiveCall.REPLY_SETTLED)
            assertEquals(EndingReason.Goodbye, call.state.value.ending)

            wait(1.4.seconds)
            assertEquals(LiveCallPhase.Ended, call.phase)
            assertTrue(transport.goodbyes.isEmpty())
            assertEquals(listOf("goodbye"), endReasons)
        }

    @Test
    fun aMutualGoodbyeFoundAfterTheLearnerSpokeAgainIsIgnored() =
        runTest(dispatcher) {
            val gate = CompletableDeferred<Unit>()
            client.checkGate = gate
            client.check = { LanguageConversationObjectiveCheck(goodbye = true, objectivesMet = emptyList(), progress = null) }
            val call = greeted()

            learnerAnswers()
            characterTalks(until = 4.seconds)
            wait(LiveCall.REPLY_SETTLED)
            learnerTalks(until = 7.seconds)
            gate.complete(Unit)
            runCurrent()

            wait(10.seconds)
            assertNull(call.state.value.ending)
            assertEquals(LiveCallPhase.Live, call.phase)
        }

    @Test
    fun aQuietLearnerIsToldToTakeTheirTimeCheckedOnOnceThenToldGoodbye() =
        runTest(dispatcher) {
            val call = live()
            characterTalks(until = 1.seconds)

            waitUntil(14.2.seconds)
            assertFalse(call.state.value.quietHint)
            wait(0.2.seconds)
            assertTrue("12 s after the character stopped, at 2.4 s", call.state.value.quietHint)

            waitUntil(27.6.seconds)
            assertEquals(1, transport.checkIns)
            characterTalks(until = 30.seconds)

            waitUntil(52.2.seconds)
            assertTrue("The check-in's answer doesn't start the silence again", transport.goodbyes.isEmpty())
            wait(0.2.seconds)
            assertEquals(listOf(cues.goodbye.text), transport.goodbyes.map { it.content })
            assertEquals(EndingReason.Quiet, call.state.value.ending)
            assertEquals(1, transport.checkIns)
        }

    @Test
    fun aCoughWithNoTranscriptStartsTheSilenceAgainOnceItStops() =
        runTest(dispatcher) {
            val call = live()
            characterTalks(until = 1.seconds)

            waitUntil(20.seconds)
            learnerTalks(until = 20.4.seconds)
            assertFalse(call.state.value.quietHint)

            waitUntil(33.seconds)
            assertFalse(call.state.value.quietHint)
            wait(0.2.seconds)
            assertTrue("12 s after the microphone went quiet, at 21.2 s", call.state.value.quietHint)

            waitUntil(46.seconds)
            assertEquals(0, transport.checkIns)
            wait(0.2.seconds)
            assertEquals(1, transport.checkIns)

            waitUntil(71.seconds)
            assertTrue(transport.goodbyes.isEmpty())
            wait(0.2.seconds)
            assertEquals(EndingReason.Quiet, call.state.value.ending)
        }

    @Test
    fun aCoughAfterTheCheckInStartsAQuietWithItsOwnCheckIn() =
        runTest(dispatcher) {
            val call = live()
            characterTalks(until = 1.seconds)
            waitUntil(30.seconds)
            assertEquals(1, transport.checkIns)
            characterTalks(until = 32.seconds)

            waitUntil(40.seconds)
            learnerTalks(until = 40.4.seconds)
            waitUntil(66.seconds)
            assertEquals(1, transport.checkIns)
            wait(0.2.seconds)
            assertEquals("25 s after the microphone went quiet, at 41.2 s", 2, transport.checkIns)

            waitUntil(91.seconds)
            assertTrue(transport.goodbyes.isEmpty())
            wait(0.2.seconds)
            assertEquals(EndingReason.Quiet, call.state.value.ending)
        }

    @Test
    fun aSteadyNoiseHoldsTheQuietHandlingUntilItStops() =
        runTest(dispatcher) {
            val call = live()
            characterTalks(until = 1.seconds)

            learnerTalks(until = 60.seconds)
            assertFalse(call.state.value.quietHint)
            assertEquals(0, transport.checkIns)
            assertNull(call.state.value.ending)

            waitUntil(85.6.seconds)
            assertEquals(0, transport.checkIns)
            wait(0.2.seconds)
            assertEquals("25 s after the microphone went quiet, at 60.8 s", 1, transport.checkIns)
        }

    @Test
    fun typingStartsTheSilenceAgainFromTheLastKeystroke() =
        runTest(dispatcher) {
            val call = live()
            characterTalks(until = 1.seconds)

            waitUntil(20.seconds)
            call.typed()
            waitUntil(44.8.seconds)
            assertEquals(0, transport.checkIns)
            wait(0.2.seconds)
            assertEquals(1, transport.checkIns)
        }

    @Test
    fun theLearnersTranscriptStartsTheSilenceAgainFromItsArrival() =
        runTest(dispatcher) {
            live()
            characterTalks(until = 1.seconds)

            waitUntil(10.seconds)
            transport.onEvent(learnerSays("Sí", 8200.0, 8600.0))
            runCurrent()
            waitUntil(34.8.seconds)
            assertEquals(0, transport.checkIns)
            wait(0.2.seconds)
            assertEquals(1, transport.checkIns)
        }

    @Test
    fun aReplyTypedAfterTheTalkTimeIsAnsweredBeforeTheGoodbye() =
        runTest(dispatcher) {
            val call = greeted()
            waitUntil(18.seconds)
            characterTalks(until = 19.5.seconds)
            while (currentTime < 22_000) {
                call.typed()
                wait(0.4.seconds)
            }
            call.sendText("¿Abren el sábado?")
            wait(1.seconds)
            assertTrue("The reply goes alone", transport.goodbyes.isEmpty())

            characterTalks(until = 24.5.seconds)
            waitUntil(25.6.seconds)
            assertTrue("Not while the character answers it", transport.goodbyes.isEmpty())
            wait(0.2.seconds)
            assertEquals("Once its answer stopped, its last words at 24.2 s", 1, transport.goodbyes.size)
            assertEquals(
                "They typed: \"¿Abren el sábado?\"",
                transport.commentary
                    .dropLast(1)
                    .last()
                    .content,
            )
        }

    @Test
    fun aReplyBeingTypedHoldsTheGoodbye() =
        runTest(dispatcher) {
            val call = greeted()

            waitUntil(19.8.seconds)
            while (currentTime <= 34_800) {
                call.typed()
                wait(1.seconds)
            }
            assertTrue(transport.goodbyes.isEmpty())
            waitUntil(42.6.seconds)
            assertTrue(transport.goodbyes.isEmpty())
            wait(0.2.seconds)
            assertEquals("8 s after the last keystroke, at 34.8 s", 1, transport.goodbyes.size)
        }

    @Test
    fun theLearnersTranscriptCountsAsSpeakingWhenTheMicrophoneHearsNothing() =
        runTest(dispatcher) {
            greeted()
            waitUntil(17.seconds)
            characterTalks(until = 19.5.seconds)

            waitUntil(21.seconds)
            assertTrue(transport.goodbyes.isEmpty())
            transport.onEvent(learnerSays("Gracias", 19800.0, 20300.0))
            runCurrent()
            assertEquals(1, transport.goodbyes.size)
        }

    @Test
    fun wordsThatArriveBeforeTheGoodbyesAcknowledgmentCountWhenTheyStartNearIt() =
        runTest(dispatcher) {
            val call = greeted()
            waitUntil(19.seconds)
            learnerTalks(until = 21.seconds)
            transport.onEvent(characterSays("Lo siento, ", 20800.0, 21100.0))
            runCurrent()
            assertFalse(call.state.value.sayingGoodbye)

            goodbyeTaken(atMs = 21_000.0)
            assertTrue("It started 200 ms before the cue's place", call.state.value.sayingGoodbye)
        }

    @Test
    fun wordsFromBeforeTheGoodbyeCueAreNotItsGoodbye() =
        runTest(dispatcher) {
            val call = greeted()
            waitUntil(19.seconds)
            learnerTalks(until = 21.seconds)
            transport.onEvent(characterSays("y además", 20000.0, 20400.0))
            runCurrent()
            goodbyeTaken(atMs = 21_000.0)
            assertFalse(call.state.value.sayingGoodbye)

            transport.onEvent(characterSays("Adiós", 21300.0, 21800.0))
            runCurrent()
            assertTrue(call.state.value.sayingGoodbye)
        }

    @Test
    fun aRefusedReservationShowsItsProblemOpensNoPeerAndReportsNoCall() =
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
            assertTrue(events.isEmpty())
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
    fun aCallThatNeverStartsFailsToConnectHangsUpAndIsReportedFailed() =
        runTest(dispatcher) {
            val call = call()
            call.start(microphone = true)
            runCurrent()

            wait(LiveCall.CONNECT_TIMEOUT)

            assertEquals(LiveCallFailure.Connect, call.state.value.failure)
            assertTrue(transport.closed)
            assertEquals(listOf(CONNECTION), client.ended)
            assertEquals(listOf("failed"), endReasons)
        }

    @Test
    fun theServerClosingTheSessionEndsALiveCallButFailsOneConnecting() =
        runTest(dispatcher) {
            val call = live()
            transport.onEvent(LiveServerEvent.Closed)
            assertEquals(LiveCallPhase.Ended, call.phase)

            transports.clear()
            val early = call()
            client.reservations = ArrayDeque(listOf(CallReservation.Ready(setup())))
            early.start(microphone = true)
            runCurrent()
            transport.onEvent(LiveServerEvent.Closed)
            assertEquals(LiveCallFailure.Connect, early.state.value.failure)
        }

    @Test
    fun aLostConnectionEndsTheCallWhenTheServerHungUpAtTheDeadline() =
        runTest(dispatcher) {
            client.endAnswers = ArrayDeque(listOf(true))
            val call = live()

            transport.onLost()
            runCurrent()

            assertEquals(LiveCallPhase.Ended, call.phase)
            assertEquals(listOf(CONNECTION), client.ended)
        }

    @Test
    fun aLostConnectionOtherwiseShowsTheCallDropped() =
        runTest(dispatcher) {
            client.endAnswers = ArrayDeque(listOf(false))
            val call = live()

            transport.onLost()
            runCurrent()

            assertEquals(LiveCallFailure.Dropped, call.state.value.failure)
            assertEquals(listOf("dropped"), endReasons)
        }

    @Test
    fun leavingALiveCallDropsItAndHangsItUp() =
        runTest(dispatcher) {
            val call = live()

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
            assertEquals(listOf("learner_ended"), endReasons)
        }

    @Test
    fun anUnconfirmedHangupIsAskedAgainAndAConfirmedOneIsnt() =
        runTest(dispatcher) {
            client.endAnswers = ArrayDeque(listOf(null, false))
            val call = live()
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
    fun finishingHangsUpThenReturnsWhatWasSaidAndReportsTheCallOnce() =
        runTest(dispatcher) {
            val call = live()
            transport.onEvent(characterSays("¿Qué desea?"))
            transport.onEvent(learnerSays("Un café", 1000.0, 2600.0))
            call.sendText("Con leche")
            call.hangUp()
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
            assertEquals(listOf("learner_ended"), endReasons)
        }

    @Test
    fun aDelegationIsAnsweredWithTheServersNothingToLookUp() =
        runTest(dispatcher) {
            live()
            transport.onEvent(LiveServerEvent.Delegation("del_1"))

            assertEquals(cues.noBackend.command(delegationId = "del_1"), transport.thinking.single())
        }

    @Test
    fun learnerWordsOverTheCharactersLastOnesStartTheSilenceWhenTheyStop() =
        runTest(dispatcher) {
            live()
            characterTalks(until = 1.seconds)
            learnerTalks(until = 3.seconds)

            waitUntil(28.6.seconds)
            assertEquals(0, transport.checkIns)
            wait(0.2.seconds)
            assertEquals("25 s after the microphone went quiet, at 3.8 s", 1, transport.checkIns)
        }

    @Test
    fun aLateLearnerFragmentWaitsWithTheAnswerForTheTranscriptToSettle() =
        runTest(dispatcher) {
            live()
            transport.onEvent(characterSays("¿Qué desea?", 0.0, 600.0))
            transport.onEvent(learnerSays("Un ", 1000.0, 1400.0))
            wait(0.5.seconds)
            transport.onEvent(characterSays("Claro.", 2000.0, 2500.0))
            wait(0.5.seconds)
            transport.onEvent(learnerSays("café.", 1400.0, 1900.0))

            wait(1.9.seconds)
            assertTrue("The transcript settles for 2 s after its last fragment", client.checks.isEmpty())
            wait(0.1.seconds)
            assertEquals("On the session's timeline the character spoke last", 1, client.checks.size)
            wait(10.seconds)
            assertEquals(1, client.checks.size)
        }

    @Test
    fun aCheckThatAnswersWhileALostCallIsClosingLeavesItDropped() =
        runTest(dispatcher) {
            val checked = CompletableDeferred<Unit>()
            client.checkGate = checked
            client.check = { LanguageConversationObjectiveCheck(goodbye = true, objectivesMet = emptyList(), progress = null) }
            val closing = CompletableDeferred<Unit>()
            client.endGate = closing
            val call = greeted()
            learnerAnswers()
            characterTalks(until = 4.seconds)
            wait(LiveCall.REPLY_SETTLED)
            assertEquals(1, client.checks.size)

            transport.onLost()
            runCurrent()
            wait(2.seconds)
            checked.complete(Unit)
            runCurrent()
            assertEquals("The check answered 3.8 s after the last words, past the goodbye's drain", LiveCallPhase.Live, call.phase)
            wait(5.seconds)
            assertEquals("Still waiting on the server to say how it ended", LiveCallPhase.Live, call.phase)
            assertTrue(events.isEmpty())

            closing.complete(Unit)
            runCurrent()
            assertEquals(LiveCallFailure.Dropped, call.state.value.failure)
            assertEquals(listOf("dropped"), endReasons)
        }

    @Test
    fun aMutualGoodbyeFoundAfterTheGoodbyeCueWentWaitsForTheCuesWords() =
        runTest(dispatcher) {
            client.check = { LanguageConversationObjectiveCheck(goodbye = true, objectivesMet = emptyList(), progress = null) }
            val call = greeted()
            waitUntil(19.seconds)
            learnerTalks(until = 21.seconds)
            assertEquals(1, transport.goodbyes.size)
            transport.onEvent(learnerSays("Adiós", 19000.0, 20800.0))
            runCurrent()
            characterTalks(until = 22.seconds)

            waitUntil(26.seconds)
            assertEquals("The check answered at 23.4 s, after the cue went", LiveCallPhase.Live, call.phase)
            goodbyeTaken()
            characterTalks(until = 27.seconds)
            waitUntil(29.8.seconds)
            assertEquals(LiveCallPhase.Live, call.phase)
            waitUntil(30.seconds)
            assertEquals("3 s after the cue's words, at 26.9 s", LiveCallPhase.Ended, call.phase)
            assertEquals(listOf("time"), endReasons)
        }

    @Test
    fun aLateTranscriptDoesntSendTheGoodbyeBeforeATypedReplyIsAnswered() =
        runTest(dispatcher) {
            val call = greeted()
            waitUntil(17.seconds)
            characterTalks(until = 18.seconds)
            waitUntil(19.5.seconds)
            while (currentTime < 21_000) {
                call.typed()
                wait(0.4.seconds)
            }
            waitUntil(21.1.seconds)
            call.sendText("Un café")
            waitUntil(21.4.seconds)
            transport.onEvent(learnerSays("Hola", 16000.0, 16500.0))
            transport.voice()
            runCurrent()
            assertTrue("The reply goes alone", transport.goodbyes.isEmpty())

            waitUntil(22.seconds)
            characterTalks(until = 23.seconds)
            waitUntil(24.2.seconds)
            assertTrue(transport.goodbyes.isEmpty())
            wait(0.2.seconds)
            assertEquals("Once the reply's answer stopped, its last words at 22.9 s", 1, transport.goodbyes.size)
        }

    @Test
    fun aGoodbyeCueStaysOutOfReplyGapsThroughAPauseInTheLearnersAnswer() =
        runTest(dispatcher) {
            val call = greeted()
            waitUntil(19.seconds)
            learnerTalks(until = 20.2.seconds)
            assertEquals(1, transport.goodbyes.size)
            waitUntil(24.seconds)
            learnerTalks(until = 25.seconds)
            waitUntil(29.seconds)
            characterTalks(until = 29.5.seconds)
            call.hangUp()

            val ended = events.filterIsInstance<AnalyticsEvent.CallEnded>().single()
            assertNull("The goodbye answers the cue, not the learner", ended.replyGapMaxMs)
            assertEquals("The pause went unanswered", 1, ended.unansweredTurns)
        }

    @Test
    fun aTypedCallsTurnsCountFromItsTranscript() =
        runTest(dispatcher) {
            val call = call()
            call.start(microphone = false)
            runCurrent()
            transport.onEvent(LiveServerEvent.Started)
            runCurrent()
            characterTalks(until = 1.seconds)
            call.sendText("Un café, por favor")
            wait(1.seconds)
            characterTalks(until = 3.seconds)
            call.hangUp()

            assertEquals(1, events.filterIsInstance<AnalyticsEvent.CallEnded>().single().learnerTurns)
        }

    @Test
    fun aDelegationsWaitStaysInTheLearnersReplyGap() =
        runTest(dispatcher) {
            val call = greeted()

            learnerTalks(until = 3.seconds)
            transport.onEvent(LiveServerEvent.Delegation("d1"))
            runCurrent()
            waitUntil(4.seconds)
            characterTalks(until = 4.5.seconds)
            call.hangUp()

            val ended = events.filterIsInstance<AnalyticsEvent.CallEnded>().single()
            assertEquals(
                "From the microphone's last sample at 2.8 s: the answer to nothing-to-look-up still answers them",
                1200L,
                ended.replyGapMaxMs,
            )
            assertEquals(1, ended.delegations)
        }

    @Test
    fun aPauseOfExactlyASlowReplyIsStillOneTurn() =
        runTest(dispatcher) {
            val call = greeted()

            waitUntil(3.seconds)
            transport.voice()
            waitUntil(6.seconds)
            transport.voice()
            waitUntil(7.seconds)
            characterTalks(until = 7.5.seconds)
            call.hangUp()

            assertEquals(
                "Only a pause longer than a slow reply goes unanswered",
                0,
                events.filterIsInstance<AnalyticsEvent.CallEnded>().single().unansweredTurns,
            )
        }

    @Test
    fun aQuickReplyIsMeasuredAndAGoodbyeSentWhileTheLearnerSpeaksIsLeftOut() =
        runTest(dispatcher) {
            val call = greeted()

            learnerTalks(until = 3.seconds)
            wait(0.4.seconds)
            characterTalks(until = 4.seconds)
            waitUntil(19.seconds)
            learnerTalks(until = 22.seconds)
            assertEquals(1, transport.goodbyes.size)
            wait(1.seconds)
            characterTalks(until = 24.seconds)
            call.hangUp()

            val ended = events.filterIsInstance<AnalyticsEvent.CallEnded>().single()
            assertEquals("0.6 s after the microphone last heard them", 600L, ended.replyGapMaxMs)
            assertEquals(600L, ended.replyGapMedianMs)
            assertEquals(0, ended.unansweredTurns)
        }

    @Test
    fun replyGapsRunFromTheLearnersLastWordToTheCharactersNextOnesAndSkipAnswersToCues() =
        runTest(dispatcher) {
            val call = greeted()

            learnerTalks(until = 3.seconds)
            wait(1.seconds)
            characterTalks(until = 5.seconds)
            learnerTalks(until = 7.seconds)
            wait(4.seconds)
            characterTalks(until = 12.seconds)
            learnerTalks(until = 13.seconds)
            call.sendText("Y un té")
            wait(1.seconds)
            characterTalks(until = 15.seconds)
            transport.onEvent(LiveServerEvent.Delegation("d"))
            learnerTalks(until = 16.seconds)
            call.hangUp()

            val ended = events.filterIsInstance<AnalyticsEvent.CallEnded>().single()
            assertEquals("The typed reply: the microphone's words have no transcript here", 1, ended.learnerTurns)
            assertEquals("The last one, cut off by hanging up", 1, ended.unansweredTurns)
            assertEquals("practice", ended.conversationKind)
            assertEquals("1.2 s and 4.2 s; the typed reply's answer is left out", 2700L, ended.replyGapMedianMs)
            assertEquals(4200L, ended.replyGapMaxMs)
            assertEquals(1, ended.slowReplies)
            assertEquals(1, ended.delegations)
        }

    @Test
    fun hangingUpWhileTheReservationIsOnItsWayEndsItWhenItComes() {
        runTest(dispatcher) {
            val gate = CompletableDeferred<Unit>()
            client.connectGates[1] = gate
            val call = call()
            call.start(microphone = true)
            runCurrent()

            call.hangUp()
            gate.complete(Unit)
            runCurrent()

            assertEquals(LiveCallPhase.Ended, call.phase)
            assertTrue("No peer opens for a call already ended", transports.isEmpty())
            assertEquals(listOf(CONNECTION), client.ended)
            assertEquals(listOf("learner_ended"), endReasons)
        }
    }

    @Test
    fun aDroppedCallCanStillBeEndedForItsFeedback() =
        runTest(dispatcher) {
            val call = live()
            transport.onEvent(learnerSays("Hola", 0.0, 800.0))
            transport.onLost()
            runCurrent()
            assertEquals(LiveCallFailure.Dropped, call.state.value.failure)

            call.hangUp()

            assertEquals(LiveCallPhase.Ended, call.phase)
            var summary: LiveCallSummary? = null
            launch { summary = call.finish() }
            runCurrent()
            assertEquals(listOf(LanguageConversationTurn(Speaker.LEARNER, "Hola")), summary?.turns)
            assertEquals(listOf("dropped"), endReasons)
        }

    @Test
    fun aCallThatFailedOtherwiseStaysFailed() =
        runTest(dispatcher) {
            client.reservations = ArrayDeque(listOf(CallReservation.CallsPaused))
            val call = call()
            call.start(microphone = true)
            runCurrent()

            call.hangUp()

            assertEquals(LiveCallPhase.Failed, call.phase)
        }

    private companion object {
        val VOICE_SAMPLE = 200.milliseconds
        val FRAGMENT = 300.milliseconds
    }
}
