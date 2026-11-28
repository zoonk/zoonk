package com.zoonk.android.feature.onboarding.setup

import com.zoonk.android.data.GenerationFailure
import com.zoonk.android.data.GenerationRun
import com.zoonk.android.data.LoadState
import com.zoonk.android.data.StepState
import com.zoonk.api.models.LanguageLevelTest
import com.zoonk.api.models.LanguageLevelTestOneOf
import com.zoonk.api.models.LanguageLevelTestOneOf1
import com.zoonk.api.models.LanguageLevelTestOneOf1Next
import com.zoonk.api.models.LanguageLevelTestOneOf1NextOneOfQuestion

internal typealias LevelTestQuestion = LanguageLevelTestOneOf1NextOneOfQuestion

internal sealed interface LevelTestPhase {
    data object Loading : LevelTestPhase

    data object Waiting : LevelTestPhase

    /**
     * [confirmation]: a level's check, where every right option is picked so a guess rarely passes. [canStop]: stopping
     * now would save a level, so "Stop and use my answers" shows.
     */
    data class Question(
        val question: LevelTestQuestion,
        /** 0 to 1. */
        val progress: Float,
        val number: Int = 1,
        val total: Int = 1,
        val confirmation: Boolean = false,
        val canStop: Boolean = false,
    ) : LevelTestPhase

    data object Done : LevelTestPhase
}

/** An open test waits for its questions until they're written; [stopped] is the learner leaving them for what the test found. */
internal fun levelTestPhase(
    test: LoadState<LanguageLevelTest>,
    stopped: Boolean,
): LevelTestPhase {
    if (test == LoadState.Idle || test == LoadState.Loading) return LevelTestPhase.Loading

    val ready = ((test as? LoadState.Loaded)?.value as? LanguageLevelTest.LanguageLevelTestOneOf1Value)?.value

    return when {
        stopped -> LevelTestPhase.Done
        ready != null -> ready.phase()
        else -> LevelTestPhase.Waiting
    }
}

private fun LanguageLevelTestOneOf1.phase(): LevelTestPhase {
    val progress = answered.toFloat() / total.coerceAtLeast(1)
    return when (val next = next) {
        is LanguageLevelTestOneOf1Next.LanguageLevelTestOneOf1NextOneOf4Value -> {
            LevelTestPhase.Waiting
        }

        is LanguageLevelTestOneOf1Next.LanguageLevelTestOneOf1NextOneOfValue -> {
            LevelTestPhase.Question(next.value.question, progress, (answered + 1).toInt(), total.toInt(), canStop = canStop)
        }

        is LanguageLevelTestOneOf1Next.LanguageLevelTestOneOf1NextOneOf1Value -> {
            LevelTestPhase.Question(
                next.value.question,
                progress,
                (answered + 1).toInt(),
                total.toInt(),
                confirmation = true,
                canStop = canStop,
            )
        }

        // An older test's spoken sentence isn't asked anymore: its levels come from reading and listening.
        is LanguageLevelTestOneOf1Next.LanguageLevelTestOneOf1NextOneOf2Value,
        is LanguageLevelTestOneOf1Next.LanguageLevelTestOneOf1NextOneOf3Value,
        -> {
            LevelTestPhase.Done
        }
    }
}

internal val LevelTestQuestion.isListening get() = skill == LanguageLevelTestOneOf1NextOneOfQuestion.Skill.LISTENING

/** The test's reading, listening and check as runs of its [total] questions, drawn apart on its bar. */
internal fun levelTestGroups(total: Int): List<Int> {
    val reading = minOf(LEVEL_TEST_BLOCK, total)
    val listening = minOf(LEVEL_TEST_BLOCK, total - reading)
    return listOf(reading, listening, total - reading - listening).filter { it > 0 }
}

/** Core's `LEVEL_TEST_BLOCK_SIZE`: the questions each skill's block asks. */
private const val LEVEL_TEST_BLOCK = 4

/** What the wait for a language pair's questions has seen since the learner's Start. */
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
