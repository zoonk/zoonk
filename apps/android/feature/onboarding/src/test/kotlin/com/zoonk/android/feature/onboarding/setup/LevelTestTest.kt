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
        assertEquals(
            followingWriter.copy(status = GenerationRun.Status.Failed, failure = GenerationFailure.Connection),
            followed.run().withPoll(failed = true),
        )
        assertFalse(followed.isStopped)
    }

    @Test
    fun anOpenTestGoesOnAtItsNextStep() {
        assertEquals(LevelTestPhase.Loading, phase(LoadState.Loading))

        val question = phase(LoadState.Loaded(levelTestOf(answered = 3, total = 12)))
        assertEquals(3f / 12, (question as LevelTestPhase.Question).progress)
        assertEquals("reading-1", question.question.id)

        assertEquals(LevelTestPhase.Done, phase(LoadState.Loaded(levelTestOf(next = SPEAKING_NEXT))))
        assertEquals(LevelTestPhase.Done, phase(LoadState.Loaded(levelTestOf(next = DONE_NEXT))))
    }

    @Test
    fun stoppingIsOfferedOnlyOnceTheServerSaysItWouldSaveALevel() {
        val early = phase(LoadState.Loaded(levelTestOf(answered = 3))) as LevelTestPhase.Question
        val later = phase(LoadState.Loaded(levelTestOf(answered = 4, canStop = true))) as LevelTestPhase.Question

        assertFalse(early.canStop)
        assertTrue(later.canStop)
    }

    @Test
    fun anOpenTestWaitsUntilItsQuestionsArrive() {
        assertEquals(LevelTestPhase.Waiting, phase(LoadState.Loaded(preparingTestOf())))
        assertEquals(LevelTestPhase.Waiting, phase(LoadState.Loaded(preparingTestOf("2026-09-28T10:00:03Z"))))
        assertEquals(LevelTestPhase.Waiting, phase(LoadState.Failed(ApiError.Network)))
    }

    @Test
    fun stoppingEndsTheTest() {
        assertEquals(LevelTestPhase.Done, phase(LoadState.Loaded(levelTestOf(answered = 4)), stopped = true))
    }

    @Test
    fun aMessageShowsTheTimeItTakesToHearToTheNearestSecond() {
        assertEquals(9_000L, heardLengthMs(8_500))
        assertEquals(9_000L, heardLengthMs(8_000))
        assertEquals(3_000L, heardLengthMs(3_000))
    }

    private fun phase(
        test: LoadState<LanguageLevelTest>,
        stopped: Boolean = false,
    ) = levelTestPhase(test, stopped)

    private fun LanguageLevelTest.preparing() = (this as LanguageLevelTest.LanguageLevelTestOneOfValue).value

    private companion object {
        const val ASKED_AT = 1_000_000L
        const val BANK_START_MS = 45_000L
    }
}
