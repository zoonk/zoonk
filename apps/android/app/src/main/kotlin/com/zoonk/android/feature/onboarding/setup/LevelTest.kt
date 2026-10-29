package com.zoonk.android.feature.onboarding.setup

import com.zoonk.android.data.GenerationFailure
import com.zoonk.android.data.GenerationRun
import com.zoonk.android.data.LoadState
import com.zoonk.android.data.StepState
import com.zoonk.api.models.LanguageLevelTest
import com.zoonk.api.models.LanguageLevelTestOneOf
import com.zoonk.api.models.LanguageLevelTestOneOf1
import com.zoonk.api.models.LanguageLevelTestOneOf1LevelsInner
import com.zoonk.api.models.LanguageLevelTestOneOf1Next
import com.zoonk.api.models.LanguageLevelTestOneOf1NextOneOf1Speaking
import com.zoonk.api.models.LanguageLevelTestOneOf1NextOneOfQuestion

internal typealias LevelTestQuestion = LanguageLevelTestOneOf1NextOneOfQuestion
internal typealias LevelTestSentence = LanguageLevelTestOneOf1NextOneOf1Speaking
internal typealias SkillLevel = LanguageLevelTestOneOf1LevelsInner

internal sealed interface LevelTestPhase {
    data object Loading : LevelTestPhase

    data object Intro : LevelTestPhase

    data object Waiting : LevelTestPhase

    data class Question(
        val question: LevelTestQuestion,
        /** 0 to 1. */
        val progress: Float,
    ) : LevelTestPhase

    data class Speaking(
        val sentence: LevelTestSentence,
        val progress: Float,
    ) : LevelTestPhase

    data class Done(
        val levels: List<SkillLevel>,
    ) : LevelTestPhase
}

/**
 * Main's `toResumedPhase`: the test resumes once the learner tapped Start ([started]) or answered,
 * and waits for its questions after this screen's Start ([begun]) or while a run it started writes
 * them. [stopped] is the learner leaving the questions for their levels.
 */
internal fun levelTestPhase(
    test: LoadState<LanguageLevelTest>,
    started: Boolean,
    begun: Boolean,
    stopped: Boolean,
    bank: BankWait,
): LevelTestPhase {
    if (test == LoadState.Idle || test == LoadState.Loading) return LevelTestPhase.Loading

    val value = (test as? LoadState.Loaded)?.value
    val ready = (value as? LanguageLevelTest.LanguageLevelTestOneOf1Value)?.value
    val preparing = (value as? LanguageLevelTest.LanguageLevelTestOneOfValue)?.value

    return when {
        stopped -> LevelTestPhase.Done(ready?.levels.orEmpty())
        ready != null && (started || ready.answered > 0) -> ready.phase()
        begun -> LevelTestPhase.Waiting
        preparing != null && started && (preparing.startedAt != null || bank.sawWriter) -> LevelTestPhase.Waiting
        else -> LevelTestPhase.Intro
    }
}

private fun LanguageLevelTestOneOf1.phase(): LevelTestPhase {
    val progress = answered.toFloat() / total.coerceAtLeast(1)
    return when (val next = next) {
        is LanguageLevelTestOneOf1Next.LanguageLevelTestOneOf1NextOneOfValue -> LevelTestPhase.Question(next.value.question, progress)
        is LanguageLevelTestOneOf1Next.LanguageLevelTestOneOf1NextOneOf1Value -> LevelTestPhase.Speaking(next.value.speaking, progress)
        is LanguageLevelTestOneOf1Next.LanguageLevelTestOneOf1NextOneOf2Value -> LevelTestPhase.Done(levels)
    }
}

/** Main's `BankWait`: what the wait for a language pair's questions has seen since the learner's Start. */
internal data class BankWait(
    val askedAt: Long? = null,
    val writing: Boolean = false,
    val sawWriter: Boolean = false,
    val startFailed: Boolean = false,
) {
    /** [now] is on the same clock as [askedAt]. */
    fun seen(
        preparing: LanguageLevelTestOneOf,
        now: Long,
    ): BankWait {
        val writing = preparing.startedAt != null
        val lostStart = !writing && askedAt != null && now - askedAt > BANK_START_MS
        return copy(writing = writing, sawWriter = sawWriter || writing, startFailed = startFailed || lostStart)
    }

    val isStopped: Boolean get() = startFailed || (sawWriter && !writing)

    fun run(): GenerationRun {
        val steps = if (writing) mapOf(WRITE_STEP to StepState.Started) else emptyMap()
        return when {
            startFailed -> GenerationRun(GenerationRun.Status.Failed, GenerationFailure.NotStarted, steps)
            sawWriter && !writing -> GenerationRun(GenerationRun.Status.Failed, GenerationFailure.Generation, steps)
            else -> GenerationRun(if (writing) GenerationRun.Status.Following else GenerationRun.Status.Waiting, steps = steps)
        }
    }

    companion object {
        /** After the learner's Start asked for the questions; [started] is false when asking didn't go through. */
        fun asked(
            preparing: LanguageLevelTestOneOf,
            started: Boolean,
            now: Long,
        ) = BankWait().seen(preparing, now).copy(askedAt = now, startFailed = !started)
    }
}

/** Runs claim a pair's questions within seconds of starting, so one that hasn't by now was lost. */
private const val BANK_START_MS = 45_000L
private const val WRITE_STEP = "writeLevelTestBank"
