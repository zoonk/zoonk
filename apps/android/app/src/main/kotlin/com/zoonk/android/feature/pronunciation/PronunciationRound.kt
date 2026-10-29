package com.zoonk.android.feature.pronunciation

import android.content.Context
import androidx.compose.runtime.Stable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.SavedStateHandle
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
 * said. It keeps the words it started with, even if grading changes what's due. A round restored
 * after process death keeps its [roundId], so the words already graded still count when it ends.
 */
@Stable
class PronunciationRound(
    val language: String,
    val words: List<ReviewWord>,
    private val answer: suspend (reviewId: String, roundId: String, VoiceRecording) -> GradeOutcome<PronunciationAnswerGrade>,
    private val complete: suspend (roundId: String) -> MutationResult<PronunciationRoundResult>,
    val roundId: String = UUID.randomUUID().toString(),
    answeredBefore: Boolean = false,
) {
    var step: RoundStep by mutableStateOf(if (words.isEmpty()) RoundStep.Result(null) else RoundStep.Word(0))
        private set

    /** Each word's [Segment.Right], [Segment.Wrong] or, when skipped, [Segment.Read]. */
    var outcomes by mutableStateOf(emptyMap<Int, Segment>())
        private set

    var pending by mutableStateOf(false)
        private set

    var finishFailed by mutableStateOf(false)
        private set

    var hasAnswers = answeredBefore
        private set

    val index: Int get() = (step as? RoundStep.Word)?.index ?: words.size

    val segments: List<Segment>
        get() = words.indices.map { outcomes[it] ?: if (it == index) Segment.Current else Segment.Ahead }

    /** A take answers the word it was recorded for; one that arrives after that word was left, or while another is graded, is dropped. */
    suspend fun record(
        index: Int,
        recording: VoiceRecording,
    ) {
        if ((step as? RoundStep.Word)?.index != index || pending) return
        pending = true
        try {
            step =
                when (val outcome = answer(words[index].id.toString(), roundId, recording)) {
                    is GradeOutcome.Graded -> {
                        hasAnswers = true
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
        if (!hasAnswers) {
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
    private val saved: SavedStateHandle,
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
        val answeredBefore = saved.get<Boolean>(ANSWERED) == true
        val started =
            PronunciationRound(
                language = reviews?.language.orEmpty(),
                words = reviews?.words.orEmpty(),
                answer = { reviewId, roundId, recording -> store.answer(reviewId, goalId, roundId, recording) },
                complete = { roundId -> store.finish(roundId, goalId) },
                roundId = saved.get<String>(ROUND_ID) ?: UUID.randomUUID().toString().also { saved[ROUND_ID] = it },
                answeredBefore = answeredBefore,
            )
        round = started
        // Every word was said before the app closed: the round only needs counting.
        if (answeredBefore && started.words.isEmpty()) finish()
    }

    fun record() {
        val round = round ?: return
        val index = round.index
        recorder.start { recording ->
            viewModelScope.launch {
                round.record(index, recording)
                saved[ANSWERED] = round.hasAnswers
            }
        }
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

    private companion object {
        const val ROUND_ID = "roundId"
        const val ANSWERED = "answered"
    }
}
