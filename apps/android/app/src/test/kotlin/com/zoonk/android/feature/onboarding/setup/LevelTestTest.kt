package com.zoonk.android.feature.onboarding.setup

import com.zoonk.android.data.ApiError
import com.zoonk.android.data.GenerationFailure
import com.zoonk.android.data.GenerationRun
import com.zoonk.android.data.LoadState
import com.zoonk.android.data.StepState
import com.zoonk.android.feature.onboarding.DONE_NEXT
import com.zoonk.android.feature.onboarding.SPEAKING_NEXT
import com.zoonk.android.feature.onboarding.levelTestOf
import com.zoonk.android.feature.onboarding.preparingTestOf
import com.zoonk.android.feature.onboarding.skillLevelOf
import com.zoonk.api.models.LanguageLevelTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class LevelTestTest {
    private val idle = preparingTestOf().preparing()
    private val writing = preparingTestOf(startedAt = "2026-09-28T10:00:03Z").preparing()
    private val followingWriter = GenerationRun(GenerationRun.Status.Following, steps = mapOf("writeLevelTestBank" to StepState.Started))

    @Test
    fun waitsForTheRunItAskedForUntilItClaimsTheQuestions() {
        val asked = BankWait.asked(idle, started = true, now = ASKED_AT)
        assertEquals(GenerationRun(GenerationRun.Status.Waiting), asked.run())

        assertEquals(followingWriter, asked.seen(writing, ASKED_AT + 3_000).run())
    }

    @Test
    fun saysTheStartFailedWhenAskingDidNotGoThrough() {
        val asked = BankWait.asked(idle, started = false, now = ASKED_AT)

        assertEquals(GenerationRun(GenerationRun.Status.Failed, GenerationFailure.NotStarted), asked.run())
        assertTrue(asked.isStopped)
    }

    @Test
    fun saysTheStartFailedWhenTheRunItAskedForNeverClaimsTheQuestions() {
        val asked = BankWait.asked(idle, started = true, now = ASKED_AT)
        val soon = asked.seen(idle, ASKED_AT + BANK_START_MS)
        val late = soon.seen(idle, ASKED_AT + BANK_START_MS + 1)

        assertEquals(GenerationRun.Status.Waiting, soon.run().status)
        assertEquals(GenerationRun(GenerationRun.Status.Failed, GenerationFailure.NotStarted), late.run())
    }

    @Test
    fun saysWritingStoppedWhenTheWriterItSawLetsGoWithoutFinishing() {
        val followed = BankWait().seen(writing, ASKED_AT)
        val stopped = followed.seen(idle, ASKED_AT + 3_000)

        assertEquals(GenerationRun.Status.Following, followed.run().status)
        assertEquals(GenerationRun(GenerationRun.Status.Failed, GenerationFailure.Generation), stopped.run())
        assertTrue(stopped.isStopped)
    }

    @Test
    fun offersToCheckAgainOnceCheckingKeepsFailingWhileWritingMayGoOn() {
        val followed = BankWait().seen(writing, ASKED_AT)
        val poll = Poll().apply { stopped = true }

        assertEquals(
            followingWriter.copy(status = GenerationRun.Status.Failed, failure = GenerationFailure.Connection),
            followed.run().withPoll(poll),
        )
        assertFalse(followed.isStopped)
    }

    @Test
    fun openingTheStepShowsItsIntroUntilTheLearnersStart() {
        assertEquals(LevelTestPhase.Loading, phase(LoadState.Loading))
        assertEquals(LevelTestPhase.Intro, phase(LoadState.Loaded(levelTestOf())))
        assertEquals(LevelTestPhase.Intro, phase(LoadState.Failed(ApiError.Network)))
    }

    @Test
    fun aTestWithAnswersOrAStartGoesOnAtItsNextStep() {
        val question = phase(LoadState.Loaded(levelTestOf(answered = 3, total = 12)))
        assertEquals(3f / 12, (question as LevelTestPhase.Question).progress)
        assertEquals("reading-1", question.question.id)

        val sentence = phase(LoadState.Loaded(levelTestOf(next = SPEAKING_NEXT)), started = true)
        assertEquals("Vorrei un caffè, per favore.", (sentence as LevelTestPhase.Speaking).sentence.sentence)

        val reading = skillLevelOf("reading", "B1", 2.0)
        assertEquals(
            1,
            (
                phase(
                    LoadState.Loaded(levelTestOf(next = DONE_NEXT, levels = listOf(reading))),
                    started = true,
                ) as LevelTestPhase.Done
            ).levels.size,
        )
    }

    @Test
    fun aStartedTestWaitsOnlyWhileARunWritesItsQuestions() {
        assertEquals(LevelTestPhase.Waiting, phase(LoadState.Loaded(preparingTestOf("2026-09-28T10:00:03Z")), started = true))
        assertEquals(LevelTestPhase.Intro, phase(LoadState.Loaded(preparingTestOf()), started = true))
        assertEquals(LevelTestPhase.Intro, phase(LoadState.Loaded(preparingTestOf("2026-09-28T10:00:03Z"))))
    }

    @Test
    fun theWaitThisScreensStartBeganStaysUntilTheQuestionsArrive() {
        assertEquals(LevelTestPhase.Waiting, phase(LoadState.Loaded(preparingTestOf()), started = true, begun = true))
        assertEquals(LevelTestPhase.Waiting, phase(LoadState.Failed(ApiError.Network), started = true, begun = true))
        assertTrue(phase(LoadState.Loaded(levelTestOf()), started = true, begun = true) is LevelTestPhase.Question)
    }

    @Test
    fun stoppingShowsTheLevelsSoFar() {
        val levels = listOf(skillLevelOf("reading", "A2+", 1.5), skillLevelOf("listening", "A2", 1.0))
        val done = phase(LoadState.Loaded(levelTestOf(answered = 4, levels = levels)), started = true, stopped = true)

        assertEquals(listOf("A2+", "A2"), (done as LevelTestPhase.Done).levels.map { it.label })
    }

    private fun phase(
        test: LoadState<LanguageLevelTest>,
        started: Boolean = false,
        begun: Boolean = false,
        stopped: Boolean = false,
    ) = levelTestPhase(test, started, begun, stopped, BankWait())

    private fun LanguageLevelTest.preparing() = (this as LanguageLevelTest.LanguageLevelTestOneOfValue).value

    private companion object {
        const val ASKED_AT = 1_000_000L
        const val BANK_START_MS = 45_000L
    }
}
