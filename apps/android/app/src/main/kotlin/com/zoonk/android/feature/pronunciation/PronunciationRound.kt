package com.zoonk.android.feature.pronunciation

import android.content.Context
import androidx.compose.runtime.Stable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.zoonk.android.data.MutationResult
import com.zoonk.android.feature.audio.GradeOutcome
import com.zoonk.android.feature.audio.VoiceIssue
import com.zoonk.android.feature.audio.VoiceRecorder
import com.zoonk.android.feature.audio.VoiceRecording
import com.zoonk.android.feature.player.engine.Segment
import com.zoonk.api.models.PronunciationAnswerGrade
import com.zoonk.api.models.PronunciationReviews
import com.zoonk.api.models.PronunciationRoundResult
import kotlinx.coroutines.launch
import java.util.UUID

sealed interface RoundStep {
    data class Word(
        val index: Int,
        val grade: PronunciationAnswerGrade? = null,
        val issue: VoiceIssue? = null,
    ) : RoundStep

    data class Result(
        val result: PronunciationRoundResult?,
    ) : RoundStep
}

/**
 * Main's `usePronunciationRound`. The round is counted once, at the end, and only when a word was
 * said. It keeps the words it started with, even if grading changes what's due.
 */
@Stable
class PronunciationRound(
    val language: String,
    val words: List<ReviewWord>,
    private val answer: suspend (reviewId: String, roundId: String, VoiceRecording) -> GradeOutcome<PronunciationAnswerGrade>,
    private val complete: suspend (roundId: String) -> MutationResult<PronunciationRoundResult>,
) {
    val roundId = UUID.randomUUID().toString()

    var step: RoundStep by mutableStateOf(if (words.isEmpty()) RoundStep.Result(null) else RoundStep.Word(0))
        private set

    /** Each word's [Segment.Right], [Segment.Wrong] or, when skipped, [Segment.Read]. */
    var outcomes by mutableStateOf(emptyMap<Int, Segment>())
        private set

    var pending by mutableStateOf(false)
        private set

    var finishFailed by mutableStateOf(false)
        private set

    private var answered = 0

    val index: Int get() = (step as? RoundStep.Word)?.index ?: words.size

    val segments: List<Segment>
        get() = words.indices.map { outcomes[it] ?: if (it == index) Segment.Current else Segment.Ahead }

    suspend fun record(recording: VoiceRecording) {
        val index = (step as? RoundStep.Word)?.index ?: return
        pending = true
        try {
            step =
                when (val outcome = answer(words[index].id.toString(), roundId, recording)) {
                    is GradeOutcome.Graded -> {
                        answered++
                        outcomes = outcomes + (index to if (outcome.value.isCorrect) Segment.Right else Segment.Wrong)
                        RoundStep.Word(index, grade = outcome.value)
                    }

                    GradeOutcome.NoSpeech -> {
                        RoundStep.Word(index, issue = VoiceIssue.NoSpeech)
                    }

                    is GradeOutcome.Limited -> {
                        RoundStep.Word(index, issue = VoiceIssue.Limited(outcome.limit))
                    }

                    GradeOutcome.Failed -> {
                        RoundStep.Word(index, issue = VoiceIssue.Failed)
                    }

                    GradeOutcome.Obsolete -> {
                        return
                    }
                }
        } finally {
            pending = false
        }
    }

    fun tryAgain() {
        val index = (step as? RoundStep.Word)?.index ?: return
        outcomes = outcomes - index
        step = RoundStep.Word(index)
    }

    suspend fun next() {
        val index = (step as? RoundStep.Word)?.index ?: return
        if (index !in outcomes) outcomes = outcomes + (index to Segment.Read)
        if (index + 1 < words.size) {
            step = RoundStep.Word(index + 1)
            return
        }
        finish()
    }

    suspend fun finish() {
        if (answered == 0) {
            step = RoundStep.Result(null)
            return
        }
        pending = true
        finishFailed = false
        try {
            when (val result = complete(roundId)) {
                is MutationResult.Done -> step = RoundStep.Result(result.value)
                is MutationResult.Failed -> finishFailed = true
                MutationResult.Obsolete -> Unit
            }
        } finally {
            pending = false
        }
    }
}

/** Holds the round and its take through rotation; leaving the screen throws an unfinished take away. */
class PronunciationViewModel(
    context: Context,
) : ViewModel() {
    val recorder = VoiceRecorder(context.applicationContext, viewModelScope)

    var round by mutableStateOf<PronunciationRound?>(null)
        private set

    var microphoneOff by mutableStateOf(false)

    fun start(
        goalId: String,
        reviews: PronunciationReviews?,
        store: PronunciationStore,
    ) {
        if (round != null) return
        round =
            PronunciationRound(
                language = reviews?.language.orEmpty(),
                words = reviews?.words.orEmpty(),
                answer = { reviewId, roundId, recording -> store.answer(reviewId, goalId, roundId, recording) },
                complete = { roundId -> store.finish(roundId, goalId) },
            )
    }

    fun record() {
        val round = round ?: return
        recorder.start { recording -> viewModelScope.launch { round.record(recording) } }
    }

    fun next() {
        viewModelScope.launch { round?.next() }
    }

    fun finish() {
        viewModelScope.launch { round?.finish() }
    }

    override fun onCleared() {
        recorder.cancel()
    }
}
