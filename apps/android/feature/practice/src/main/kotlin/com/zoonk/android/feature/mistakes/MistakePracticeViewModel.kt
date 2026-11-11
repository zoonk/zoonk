package com.zoonk.android.feature.mistakes

import android.os.SystemClock
import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.zoonk.android.data.MutationResult
import com.zoonk.android.data.recode
import com.zoonk.android.feature.audio.GradeOutcome
import com.zoonk.android.feature.audio.VoiceRecording
import com.zoonk.android.feature.audio.toGradeOutcome
import com.zoonk.android.feature.player.engine.LessonPhase
import com.zoonk.android.feature.player.engine.LessonPlayerState
import com.zoonk.android.feature.player.engine.continueChallenge
import com.zoonk.android.feature.player.model.LessonAnswer
import com.zoonk.android.feature.player.model.LessonStep
import com.zoonk.android.feature.player.model.StepContent
import com.zoonk.android.feature.player.model.StepResult
import com.zoonk.android.feature.player.model.toApi
import com.zoonk.android.feature.player.model.toLessonStep
import com.zoonk.android.feature.player.model.toStepResult
import com.zoonk.android.feature.practice.AnswerSender
import com.zoonk.android.feature.practice.DrillStage
import com.zoonk.android.feature.practice.QuestionRun
import com.zoonk.android.feature.practice.RunControls
import com.zoonk.android.feature.practice.RunPhase
import com.zoonk.android.feature.practice.Submission
import com.zoonk.android.feature.questions.Answer
import com.zoonk.android.feature.questions.AnswerFeedback
import com.zoonk.android.feature.questions.Drill
import com.zoonk.android.feature.questions.Question
import com.zoonk.android.feature.questions.TrueFalseWords
import com.zoonk.android.feature.session.ReachedFacts
import com.zoonk.api.ApiJson
import com.zoonk.api.models.LessonStepAnswer
import com.zoonk.api.models.MistakeDrill
import com.zoonk.api.models.MistakePractice
import com.zoonk.api.models.MistakePracticeCompletion
import com.zoonk.api.models.MistakePracticeFeedback
import com.zoonk.api.models.MistakePracticePracticeInnerQuestionsInner
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

sealed interface MistakePracticeTask {
    val mistakeId: String
    val drill: Drill

    data class Bank(
        val question: Question,
    ) : MistakePracticeTask {
        override val mistakeId get() = requireNotNull(question.mistakeId)
        override val drill get() = requireNotNull(question.drill)
    }

    data class Lesson(
        override val mistakeId: String,
        override val drill: Drill,
        val lessonId: String,
        val language: String,
        val targetLanguage: String?,
        val step: LessonStep,
        val tutorAvailable: Boolean,
    ) : MistakePracticeTask
}

data class PracticeQuestions(
    val questions: List<Question>,
    val words: TrueFalseWords,
    val tasks: List<MistakePracticeTask> = questions.map(MistakePracticeTask::Bank),
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
    val reached: ReachedFacts = ReachedFacts(level = null, energy = null),
    val end: PracticeEnd? = null,
    val lesson: LessonPlayerState? = null,
    val lessonGrade: MistakePracticeFeedback? = null,
) {
    val endNote: PracticeEndNote?
        get() {
            val missed = run.answers.values.any { !it.isCorrect }
            val unreached = run.answers.size < read.tasks.size

            return when {
                missed && unreached -> PracticeEndNote.MissedAndUnreached
                missed -> PracticeEndNote.Missed
                unreached -> PracticeEndNote.Unreached
                else -> null
            }
        }
}

enum class PracticeEndNote { Missed, MissedAndUnreached, Unreached }

/** Each answer carries the run's earlier ones, so a run left halfway still counts; the end counts it once more. */
class MistakePracticeViewModel(
    private val key: PracticeKey,
    private val store: MistakesStore,
    private val saved: SavedStateHandle,
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

    private val attempts = mutableMapOf<Int, UUID>()
    private var lessonSent: Triple<LessonStepAnswer?, Long, UUID>? = null
    private var spokenSent: Triple<ByteArray, Long, UUID>? = null

    override val canRetry: Boolean get() = sent != null

    fun begin(practice: MistakePractice) {
        if (mutableState.value != null) return
        val read = practice.toQuestions()
        val lesson = restoreLesson(read, 0)
        val phase = if (lessonSent != null) RunPhase.AnswerFailed else RunPhase.Answering
        mutableState.value = PracticeState(read, QuestionRun(0, phase, read.openingStage(0)), lesson = lesson)
        shownAt = now()
    }

    override fun startDrill() {
        shownAt = now()
        updateRun(QuestionRun::start)
    }

    override fun submit(
        question: Question,
        answer: Answer,
        sender: AnswerSender,
        minDurationMs: Long,
    ) {
        send(Submission.of(question, answer, sender, max(minDurationMs, now() - shownAt), unsaved = sent))
    }

    override fun retry() {
        sent?.let(::send)
    }

    private fun send(submission: Submission) {
        val current = mutableState.value ?: return
        val mistakeId = submission.question.mistakeId ?: return
        if (!current.run.canAnswer) return
        mutableState.value = current.copy(run = current.run.checking(submission.sender))
        sent = submission
        val attemptId = attempts.getOrPut(current.run.index) { UUID.randomUUID() }

        viewModelScope.launch {
            val (question, answer, _, duration) = submission
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

    override fun timeUp(
        question: Question,
        seconds: Int,
    ) {
        updateRun(QuestionRun::timeUp)
        submit(question, Answer.DontKnow, AnswerSender.Timer, seconds.seconds.inWholeMilliseconds)
    }

    override fun next(questions: List<Question>) {
        if (mutableState.value?.run?.phase !is RunPhase.Checked) return
        shownAt = now()
        mutableState.update { state ->
            state?.let {
                val index = it.run.index + 1
                it.copy(
                    run =
                        it.run.copy(
                            index = index,
                            phase = if (index >= it.read.tasks.size) RunPhase.Finishing else RunPhase.Answering,
                            stage = it.read.openingStage(index),
                            timedOut = false,
                        ),
                    lesson = restoreLesson(it.read, index),
                    lessonGrade = null,
                )
            }
        }
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

            current.run.phase is RunPhase.Checking -> {
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
            mutableState.update { state ->
                state?.copy(
                    end = PracticeEnd(summary),
                    reached = summary?.let { state.reached.then(ReachedFacts(it.reached.level, it.reached.energy)) } ?: state.reached,
                )
            }
            if (closeWhenEnded) closing.value = true
        }
    }

    fun selectLesson(answer: LessonAnswer?) {
        mutableState.update { state ->
            state?.let {
                val lesson = it.lesson ?: return@update state
                val step = lesson.currentStep ?: return@update state
                if (!it.run.canAnswer) return@update state
                saved["answer:${step.id}"] = answer?.let { value -> ApiJson.encodeToString(LessonAnswer.serializer(), value) }
                val answers = if (answer == null) lesson.answers - step.id else lesson.answers + (step.id to answer)
                it.copy(lesson = lesson.copy(answers = answers))
            }
        }
    }

    fun continueLesson() {
        mutableState.update { state -> state?.copy(lesson = state.lesson?.continueChallenge()) }
    }

    fun retryLesson() =
        checkLesson(
            dontKnow = lessonSent != null && lessonSent?.first == null,
            timedOut =
                mutableState.value?.run?.timedOut == true,
        )

    fun checkLesson(
        dontKnow: Boolean = false,
        timedOut: Boolean = false,
    ) {
        val current = mutableState.value ?: return
        val task = current.read.tasks.getOrNull(current.run.index) as? MistakePracticeTask.Lesson ?: return
        if (!current.run.canAnswer) return
        val input =
            when {
                dontKnow -> {
                    null
                }

                else -> {
                    current.lesson
                        ?.answers
                        ?.get(task.step.id)
                        ?.toApi() ?: return
                }
            }
        val held = lessonSent?.takeIf { it.first == input }
        val duration = held?.second ?: (now() - shownAt)
        val attemptId = held?.third ?: UUID.randomUUID()
        lessonSent = Triple(input, duration, attemptId)
        saved["sent.id:${task.step.id}"] = attemptId.toString()
        saved["sent.duration:${task.step.id}"] = duration
        saved["sent.answer:${task.step.id}"] = input?.let { ApiJson.encodeToString(LessonStepAnswer.serializer(), it) } ?: "dontKnow"
        mutableState.value =
            current.copy(
                run = current.run.checking(AnswerSender.Check).copy(timedOut = timedOut),
                lesson =
                    current.lesson?.copy(
                        phase = LessonPhase.Checking,
                        answers = if (dontKnow) current.lesson.answers - task.step.id else current.lesson.answers,
                    ),
            )
        viewModelScope.launch {
            when (val result = store.answerLesson(key, task.mistakeId, task.step.id, input, duration, attemptId, current.answerIds)) {
                is MutationResult.Done -> lessonAnswered(task, result.value)
                is MutationResult.Failed -> lessonFailed()
                MutationResult.Obsolete -> Unit
            }
        }
    }

    suspend fun gradeSpoken(
        task: MistakePracticeTask.Lesson,
        recording: VoiceRecording,
    ): GradeOutcome<Unit> {
        val current = mutableState.value ?: return GradeOutcome.Obsolete
        if (!current.run.canAnswer) return GradeOutcome.Obsolete
        mutableState.value =
            current.copy(
                run = current.run.checking(AnswerSender.Check),
                lesson = current.lesson?.copy(phase = LessonPhase.Checking),
            )
        val held =
            spokenSent?.takeIf { it.first.contentEquals(recording.audio) }
                ?: Triple(recording.audio, now() - shownAt, UUID.randomUUID()).also { spokenSent = it }
        val outcome = store.speak(key, task.mistakeId, task.step.id, recording, held.third, current.answerIds, held.second).toGradeOutcome()
        return when (outcome) {
            is GradeOutcome.Graded -> {
                val feedback = outcome.value.practice
                if (feedback == null) {
                    lessonFailed(recording = true)
                    GradeOutcome.Failed
                } else {
                    val spoken = task.step.content as? StepContent.SpokenAnswer
                    val result = spoken?.let { outcome.value.toStepResult(it.content.targetText).copy(isCorrect = feedback.isCorrect) }
                    lessonAnswered(task, feedback, result)
                    GradeOutcome.Graded(Unit)
                }
            }

            GradeOutcome.Obsolete -> {
                GradeOutcome.Obsolete
            }

            GradeOutcome.NoSpeech -> {
                lessonFailed(recording = true)
                GradeOutcome.NoSpeech
            }

            is GradeOutcome.Limited -> {
                lessonFailed(recording = true)
                outcome
            }

            GradeOutcome.Failed -> {
                lessonFailed(recording = true)
                GradeOutcome.Failed
            }
        }
    }

    fun lessonAnswered(
        task: MistakePracticeTask.Lesson,
        feedback: MistakePracticeFeedback,
        spokenResult: StepResult? = null,
    ) {
        saved.remove<String>("answer:${task.step.id}")
        saved.remove<String>("sent.id:${task.step.id}")
        saved.remove<Long>("sent.duration:${task.step.id}")
        saved.remove<String>("sent.answer:${task.step.id}")
        val notSure = lessonSent != null && lessonSent?.first == null && mutableState.value?.run?.timedOut == false
        lessonSent = null
        spokenSent = null
        val result =
            (spokenResult ?: feedback.lessonResult?.toStepResult(null))?.let {
                if (notSure) it.copy(checked = false, answerText = null) else it
            }
        mutableState.update { state ->
            state?.copy(
                run =
                    state.run.answered(
                        Answer.DontKnow,
                        feedback.recode<MistakePracticeFeedback, AnswerFeedback>(),
                        blank = notSure || feedback.lessonResult?.checked == false,
                    ),
                lesson =
                    state.lesson?.copy(
                        phase = LessonPhase.Feedback,
                        results = result?.let { state.lesson.results + (task.step.id to it) } ?: state.lesson.results,
                    ),
                answerIds = state.answerIds + listOfNotNull(feedback.answerId),
                fixedIds = state.fixedIds.updatedBy(feedback, task.mistakeId),
                reached = state.reached.then(ReachedFacts(feedback.reached.level, feedback.reached.energy)),
                lessonGrade = feedback,
            )
        }
        if (leaveWhenChecked) {
            leaveWhenChecked = false
            leave()
        }
    }

    fun lessonFailed(recording: Boolean = false) {
        mutableState.update { state ->
            state?.copy(
                run = if (recording) state.run.copy(phase = RunPhase.Answering) else state.run.failed(RunPhase.AnswerFailed),
                lesson = state.lesson?.copy(phase = LessonPhase.Playing),
            )
        }
        if (leaveWhenChecked) {
            leaveWhenChecked = false
            leave()
        }
    }

    private fun heldLesson(stepId: String): Triple<LessonStepAnswer?, Long, UUID>? {
        val id = saved.get<String>("sent.id:$stepId") ?: return null
        val duration = saved.get<Long>("sent.duration:$stepId") ?: return null
        val encoded = saved.get<String>("sent.answer:$stepId") ?: return null
        return runCatching {
            val answer = if (encoded == "dontKnow") null else ApiJson.decodeFromString(LessonStepAnswer.serializer(), encoded)
            Triple(answer, duration, UUID.fromString(id))
        }.getOrNull()
    }

    private fun restoreLesson(
        read: PracticeQuestions,
        index: Int,
    ): LessonPlayerState? {
        val initial = read.lessonState(index) ?: return null
        val step = initial.currentStep ?: return initial
        lessonSent = heldLesson(step.id)
        val encoded = saved.get<String>("answer:${step.id}") ?: return initial
        val answer =
            runCatching {
                ApiJson.decodeFromString(LessonAnswer.serializer(), encoded)
            }.getOrNull() ?: return initial
        return initial.copy(answers = mapOf(step.id to answer))
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
    answerIds = answerIds + listOfNotNull(feedback.answerId),
    fixedIds = fixedIds.updatedBy(feedback, mistakeId),
    reached = reached.then(ReachedFacts(feedback.reached.level, feedback.reached.energy)),
)

/** Main's `mergeReached`: Brain Power only goes up, so the later level; a later count can dip Energy, so the higher one. */
private fun ReachedFacts.then(later: ReachedFacts) =
    ReachedFacts(
        level = later.level ?: level,
        energy = listOfNotNull(energy, later.energy).maxOrNull(),
    )

/** A later answer can open a mistake this run fixed again. */
private fun Set<String>.updatedBy(
    feedback: MistakePracticeFeedback,
    mistakeId: String,
): Set<String> {
    val fixed = this + feedback.fixedMistakeIds.map(UUID::toString)
    return when {
        feedback.mistakeStatus == MistakePracticeFeedback.MistakeStatus.OPEN -> fixed - mistakeId
        feedback.fixed -> fixed + mistakeId
        else -> fixed
    }
}

internal fun MistakePractice.toQuestions(): PracticeQuestions {
    val tasks =
        practice.flatMap { entry ->
            val drill = entry.drill.recode<MistakeDrill, Drill>()
            val lesson = entry.lesson
            if (lesson != null) {
                listOf(
                    MistakePracticeTask.Lesson(
                        entry.mistakeId.toString(),
                        drill,
                        lesson.lessonId.toString(),
                        lesson.language,
                        lesson.targetLanguage,
                        lesson.step.toLessonStep(),
                        entry.tutorAvailable,
                    ),
                )
            } else {
                entry.questions.map { inner ->
                    MistakePracticeTask.Bank(
                        inner
                            .recode<MistakePracticePracticeInnerQuestionsInner, Question>()
                            .copy(drill = drill, mistakeId = entry.mistakeId.toString(), tutorAvailable = entry.tutorAvailable),
                    )
                }
            }
        }
    return PracticeQuestions(
        questions = tasks.mapNotNull { (it as? MistakePracticeTask.Bank)?.question },
        words = trueFalseLabels.recode<TrueFalseLabels, TrueFalseWords>(),
        tasks = tasks,
    )
}

private fun PracticeQuestions.openingStage(index: Int): DrillStage {
    val task = tasks.getOrNull(index)
    return if (task?.drill?.isIdeaFirst == true && tasks.getOrNull(index - 1)?.mistakeId != task.mistakeId) {
        DrillStage.Ideas
    } else {
        DrillStage.Open
    }
}

private fun PracticeQuestions.lessonState(index: Int) =
    (tasks.getOrNull(index) as? MistakePracticeTask.Lesson)?.let {
        LessonPlayerState.initial(it.lessonId, listOf(it.step), 0)
    }
