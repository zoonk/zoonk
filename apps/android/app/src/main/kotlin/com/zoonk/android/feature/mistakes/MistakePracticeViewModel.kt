package com.zoonk.android.feature.mistakes

import android.os.SystemClock
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.zoonk.android.data.MutationResult
import com.zoonk.android.data.recode
import com.zoonk.android.feature.practice.QuestionRun
import com.zoonk.android.feature.practice.RunControls
import com.zoonk.android.feature.practice.RunPhase
import com.zoonk.android.feature.questions.Answer
import com.zoonk.android.feature.questions.AnswerFeedback
import com.zoonk.android.feature.questions.Drill
import com.zoonk.android.feature.questions.Question
import com.zoonk.android.feature.questions.TrueFalseWords
import com.zoonk.api.models.MistakeDrill
import com.zoonk.api.models.MistakePractice
import com.zoonk.api.models.MistakePracticeCompletion
import com.zoonk.api.models.MistakePracticeFeedback
import com.zoonk.api.models.MistakePracticePracticeInnerQuestionsInner
import com.zoonk.api.models.MistakeSnapshot
import com.zoonk.api.models.MistakeStatus
import com.zoonk.api.models.TrueFalseLabels
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import java.util.UUID
import kotlin.math.max
import kotlin.time.Duration.Companion.seconds

data class PracticeQuestions(
    val questions: List<Question>,
    val words: TrueFalseWords,
    /** The learner's earlier answer by step, only on the mistake's own question: beside another it misleads. */
    val lastAnswers: Map<Int, String>,
)

/** How the run ended; [summary] is null when its count didn't get through. */
data class PracticeEnd(
    val summary: MistakePracticeCompletion?,
)

/** The run keeps the questions it started with: an answer refreshes the practice, and a fixed mistake leaves it. */
data class PracticeState(
    val read: PracticeQuestions,
    val run: QuestionRun,
    val answerIds: List<UUID> = emptyList(),
    val fixedIds: Set<String> = emptySet(),
    val end: PracticeEnd? = null,
)

/** Each answer carries the run's earlier ones, so a run left halfway still counts; the end counts it once more. */
class MistakePracticeViewModel(
    private val key: PracticeKey,
    private val store: MistakesStore,
    private val now: () -> Long = SystemClock::elapsedRealtime,
) : ViewModel(),
    RunControls {
    private val mutableState = MutableStateFlow<PracticeState?>(null)
    val state: StateFlow<PracticeState?> = mutableState.asStateFlow()

    val practice get() = store.practices[key]

    private val closing = MutableStateFlow(false)
    val closed: StateFlow<Boolean> = closing.asStateFlow()
    private var closeWhenEnded = false
    private var leaveWhenChecked = false

    private var shownAt = now()
    private var sent: Submission? = null

    /** By step: one item asked under two mistakes is two answers. */
    private val attempts = mutableMapOf<Int, UUID>()

    private data class Submission(
        val question: Question,
        val answer: Answer,
        val minDurationMs: Long,
    )

    override val canRetry: Boolean get() = sent != null

    fun begin(practice: MistakePractice) {
        if (mutableState.value != null) return
        val read = practice.toQuestions()
        mutableState.value = PracticeState(read, QuestionRun.begin(read.questions))
        shownAt = now()
    }

    override fun startDrill(questions: List<Question>) {
        shownAt = now()
        updateRun { it.start(questions) }
    }

    // Reading the question counts toward the answer's time, so the reveal keeps the clock going.
    override fun reveal() = updateRun(QuestionRun::reveal)

    override fun submit(
        question: Question,
        answer: Answer,
        minDurationMs: Long,
    ) {
        val current = mutableState.value ?: return
        val mistakeId = question.mistakeId ?: return
        if (!current.run.canAnswer) return
        mutableState.value = current.copy(run = current.run.checking())
        sent = Submission(question, answer, minDurationMs)
        val attemptId = attempts.getOrPut(current.run.index) { UUID.randomUUID() }

        viewModelScope.launch {
            val duration = max(minDurationMs, now() - shownAt)
            when (val result = store.answer(key, mistakeId, question.itemId, answer, duration, attemptId, current.answerIds)) {
                is MutationResult.Done -> {
                    sent = null
                    mutableState.update { it?.answered(mistakeId, answer, result.value) }
                }

                is MutationResult.Failed -> {
                    updateRun { it.failed(RunPhase.AnswerFailed) }
                }

                MutationResult.Obsolete -> {
                    return@launch
                }
            }
            if (leaveWhenChecked) {
                leaveWhenChecked = false
                leave()
            }
        }
    }

    override fun retry() {
        sent?.let { submit(it.question, it.answer, it.minDurationMs) }
    }

    override fun timeUp(
        question: Question,
        seconds: Int,
    ) {
        updateRun(QuestionRun::timeUp)
        submit(question, Answer.DontKnow, minDurationMs = seconds.seconds.inWholeMilliseconds)
    }

    override fun next(questions: List<Question>) {
        if (mutableState.value?.run?.phase !is RunPhase.Checked) return
        shownAt = now()
        updateRun { it.next(questions) }
        if (mutableState.value?.run?.phase == RunPhase.Finishing) finish()
    }

    /**
     * Close or Back: after an answer the run ends and what was answered counts. Leaving never
     * cancels a write: while an answer is checked or the end saves, it waits for it.
     */
    fun leave() {
        val current = mutableState.value
        when {
            current == null -> {
                closing.value = true
            }

            current.run.phase == RunPhase.Checking -> {
                leaveWhenChecked = true
            }

            current.run.phase == RunPhase.Finishing -> {
                if (current.end == null) closeWhenEnded = true else closing.value = true
            }

            current.answerIds.isNotEmpty() -> {
                updateRun(QuestionRun::finishing)
                finish()
            }

            else -> {
                closing.value = true
            }
        }
    }

    private fun finish() {
        val answerIds = mutableState.value?.answerIds.orEmpty()
        viewModelScope.launch {
            // A count that didn't get through still ends the run: each answer was counted as it came.
            val summary = if (answerIds.isEmpty()) null else (store.finish(key, answerIds) as? MutationResult.Done)?.value
            mutableState.update { it?.copy(end = PracticeEnd(summary)) }
            if (closeWhenEnded) closing.value = true
        }
    }

    private fun updateRun(change: (QuestionRun) -> QuestionRun) = mutableState.update { it?.copy(run = change(it.run)) }
}

/** An honest "I don't know" is neither right nor wrong; the clock running out stays a miss. */
private fun PracticeState.answered(
    mistakeId: String,
    answer: Answer,
    feedback: MistakePracticeFeedback,
) = copy(
    run =
        run.answered(
            answer,
            feedback.recode<MistakePracticeFeedback, AnswerFeedback>(),
            blank = answer == Answer.DontKnow && !run.timedOut,
        ),
    answerIds = answerIds + feedback.answerId,
    fixedIds = fixedIds.updatedBy(feedback, mistakeId),
)

/** A later answer can open a mistake this run fixed again. */
private fun Set<String>.updatedBy(
    feedback: MistakePracticeFeedback,
    mistakeId: String,
): Set<String> {
    val fixed = this + feedback.fixedMistakeIds.map(UUID::toString)
    return when {
        feedback.mistakeStatus == MistakeStatus.OPEN -> fixed - mistakeId
        feedback.fixed -> fixed + mistakeId
        else -> fixed
    }
}

internal fun MistakePractice.toQuestions(): PracticeQuestions {
    val asked =
        practice.flatMap { entry ->
            val drill = entry.drill.recode<MistakeDrill, Drill>()
            entry.questions.map { inner ->
                val question =
                    inner
                        .recode<MistakePracticePracticeInnerQuestionsInner, Question>()
                        .copy(drill = drill, mistakeId = entry.mistakeId.toString())
                question to entry.snapshot.answer?.takeIf { entry.snapshot.isAskedBy(question) }
            }
        }
    return PracticeQuestions(
        questions = asked.map { it.first },
        words = trueFalseLabels.recode<TrueFalseLabels, TrueFalseWords>(),
        lastAnswers = asked.mapIndexedNotNull { step, (_, answer) -> answer?.let { step to it } }.toMap(),
    )
}

/** The notebook saves a lesson's question with its context before it, and a bank question as it's asked. */
private fun MistakeSnapshot.isAskedBy(question: Question): Boolean {
    val saved = this.question.squashed()
    return saved == question.question.squashed() ||
        (!question.context.isNullOrEmpty() && saved == "${question.context} ${question.question}".squashed())
}

private fun String.squashed(): String =
    map {
        if (it.isWhitespace()) ' ' else it
    }.joinToString("").split(' ').filter(String::isNotEmpty).joinToString(" ")
