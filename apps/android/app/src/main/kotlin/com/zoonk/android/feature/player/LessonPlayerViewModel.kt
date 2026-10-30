package com.zoonk.android.feature.player

import androidx.compose.runtime.Immutable
import androidx.compose.runtime.mutableStateOf
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.zoonk.android.data.ApiException
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.DataDomain
import com.zoonk.android.data.DraftStore
import com.zoonk.android.data.MutationResult
import com.zoonk.android.data.SessionSource
import com.zoonk.android.data.value
import com.zoonk.android.feature.audio.GradeOutcome
import com.zoonk.android.feature.audio.VoiceRecording
import com.zoonk.android.feature.audio.toGradeOutcome
import com.zoonk.android.feature.player.engine.CheckIssue
import com.zoonk.android.feature.player.engine.CompletionStatus
import com.zoonk.android.feature.player.engine.HyperdriveStart
import com.zoonk.android.feature.player.engine.LessonAction
import com.zoonk.android.feature.player.engine.LessonPhase
import com.zoonk.android.feature.player.engine.LessonPlayerState
import com.zoonk.android.feature.player.engine.LessonRefusal
import com.zoonk.android.feature.player.engine.LessonRun
import com.zoonk.android.feature.player.engine.LessonSupport
import com.zoonk.android.feature.player.engine.RunAnswer
import com.zoonk.android.feature.player.engine.gradeOnDevice
import com.zoonk.android.feature.player.engine.isServerGradedAnswer
import com.zoonk.android.feature.player.engine.isWaitingForPicture
import com.zoonk.android.feature.player.engine.reduce
import com.zoonk.android.feature.player.engine.revealGuess
import com.zoonk.android.feature.player.model.LessonAnswer
import com.zoonk.android.feature.player.model.LessonLoad
import com.zoonk.android.feature.player.model.LessonStep
import com.zoonk.android.feature.player.model.PlayableLesson
import com.zoonk.android.feature.player.model.StepContent
import com.zoonk.android.feature.player.model.StepImage
import com.zoonk.android.feature.player.model.StepKind
import com.zoonk.android.feature.player.model.toApi
import com.zoonk.android.feature.player.model.toStepResult
import com.zoonk.android.feature.player.model.writtenText
import com.zoonk.android.feature.player.steps.isPlayable
import com.zoonk.android.navigation.AppRoute
import com.zoonk.api.ApiJson
import com.zoonk.api.models.ChapterLesson
import com.zoonk.api.models.LessonFit
import com.zoonk.api.models.LessonStepCheckInput
import com.zoonk.api.models.LessonStepCheckResult
import com.zoonk.api.models.LibraryLessonCompletion
import com.zoonk.api.models.LibraryLessonRun
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.job
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withTimeoutOrNull
import kotlinx.serialization.Serializable
import kotlinx.serialization.builtins.ListSerializer
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.decodeFromJsonElement
import kotlinx.serialization.json.encodeToJsonElement
import java.util.UUID
import kotlin.time.Duration.Companion.seconds
import com.zoonk.api.models.LessonSupport as ApiLessonSupport

/** [fit] is where a guest's lesson sits in its course; null outside a public chapter. */
@Immutable
data class LessonEnding(
    val nextLessonId: String? = null,
    val guest: Boolean = false,
    val fit: LessonFit? = null,
    val inSession: Boolean = false,
)

/** A session lesson's Continue and Stop for today (main's `useStudyNavigation`). */
interface SessionSteps {
    /** The session's next step, its summary once nothing is left, or Today when the day is over. */
    suspend fun next(sessionId: UUID): MutationResult<AppRoute>

    suspend fun stop(sessionId: UUID): MutationResult<Any>
}

enum class SessionStep { Continue, Stop }

/** A session lesson's end while [pending] saves, after [failed], or [leaving] for the route it opened. */
@Immutable
data class SessionMove(
    val pending: SessionStep? = null,
    val failed: SessionStep? = null,
    val leaving: AppRoute? = null,
)

/** An answer on its way to the server, sent again under the same attempt until the server has it. */
private data class PendingCheck(
    val stepId: String,
    val input: LessonStepCheckInput,
) {
    val attemptId: String get() = input.attemptId.toString()
}

/** A pending answer kept on the device, so one the app never sent goes out when the lesson opens again. */
@Serializable
private data class UnsentAnswer(
    val stepId: String,
    val input: JsonElement,
)

private sealed interface CheckOutcome {
    data class Checked(
        val result: LessonStepCheckResult,
    ) : CheckOutcome

    /** Never worth sending again: the run finished, or the answer doesn't fit the screen. */
    data object Refused : CheckOutcome

    data object Failed : CheckOutcome
}

private sealed interface StartOutcome {
    data class Started(
        val run: LibraryLessonRun,
    ) : StartOutcome

    data class Refused(
        val refusal: LessonRefusal,
    ) : StartOutcome
}

private sealed interface CompletionOutcome {
    data class Completed(
        val completion: LibraryLessonCompletion,
    ) : CompletionOutcome

    /** An answer the screens show never reached the server. */
    data object Incomplete : CompletionOutcome
}

/**
 * One open lesson's run: the screens' state, its answers on their way to the server and its
 * completion. Every write carries the session that opened the lesson; another session reopens it.
 */
class LessonPlayerViewModel(
    private val lessonId: String,
    private val studySessionId: String?,
    private val firstAnswer: String?,
    private val store: LessonPlayerStore,
    private val cache: AppCache,
    private val sessions: SessionSource,
    private val choices: TodayChoices,
    private val drafts: DraftStore,
    private val sessionSteps: SessionSteps? = null,
    private val isGuest: () -> Boolean = { false },
    private val activeGoalId: () -> String? = { null },
    private val now: () -> Long = System::currentTimeMillis,
) : ViewModel() {
    private val mutableState = MutableStateFlow<LessonPlayerState?>(null)
    private val mutableEnding = MutableStateFlow(LessonEnding(inSession = studySessionId != null))
    private val mutableSessionMove = MutableStateFlow(SessionMove())

    /** Null until the run starts or is refused. */
    val state: StateFlow<LessonPlayerState?> = mutableState.asStateFlow()

    /** Where the lesson's end leads, read once it's saved. */
    val ending: StateFlow<LessonEnding> = mutableEnding.asStateFlow()

    val sessionMove: StateFlow<SessionMove> = mutableSessionMove.asStateFlow()

    private var lesson: PlayableLesson? = null
    private var openedAt = 0L
    private var owner = sessions.current
    private var work = openScope()
    private var starting: Job? = null
    private var completing: Job? = null
    private val unsaved = mutableMapOf<String, MutableList<PendingCheck>>()
    private val screenLocks = mutableMapOf<String, Mutex>()

    /**
     * Starts the lesson's run when it opens, as main does after its player mounts (never on a
     * prefetch); reopening it for the same learner keeps where they are.
     */
    fun open(lesson: PlayableLesson) {
        val session = sessions.current

        if (this.lesson?.id == lesson.id && owner == session && (mutableState.value != null || starting?.isActive == true)) return

        work.cancel()
        work = openScope()
        this.lesson = lesson
        owner = session
        unsaved.clear()
        screenLocks.clear()
        mutableEnding.value = LessonEnding(inSession = studySessionId != null)
        mutableState.value = null
        startRun()
    }

    fun continueSession() = moveSession(SessionStep.Continue) { steps, sessionId -> steps.next(sessionId) }

    fun stopSession() =
        moveSession(SessionStep.Stop) { steps, sessionId ->
            when (val stopped = steps.stop(sessionId)) {
                is MutationResult.Done -> MutationResult.Done(AppRoute.Session(sessionId = sessionId.toString(), stopped = true))
                is MutationResult.Failed -> stopped
                MutationResult.Obsolete -> MutationResult.Obsolete
            }
        }

    private fun moveSession(
        step: SessionStep,
        write: suspend (SessionSteps, UUID) -> MutationResult<AppRoute>,
    ) {
        val steps = sessionSteps ?: return
        val sessionId = studySessionId?.let(UUID::fromString) ?: return
        if (mutableSessionMove.value.pending != null) return

        mutableSessionMove.value = SessionMove(pending = step)
        viewModelScope.launch {
            mutableSessionMove.value =
                when (val result = write(steps, sessionId)) {
                    is MutationResult.Done -> SessionMove(leaving = result.value)
                    is MutationResult.Failed -> SessionMove(failed = step)
                    MutationResult.Obsolete -> SessionMove()
                }
        }
    }

    /** After "Try again", or once a slow-down's wait is over. */
    fun retryStart() {
        if (starting?.isActive != true) startRun()
    }

    fun dispatch(action: LessonAction) {
        val before = mutableState.value?.completion?.status
        mutableState.update { state -> state?.let { reduce(it, action, now()) } }
        if (mutableState.value?.completion?.status == CompletionStatus.Saving && before != CompletionStatus.Saving) saveCompletion()
    }

    fun select(answer: LessonAnswer?) {
        val step = mutableState.value?.currentStep ?: return
        dispatch(LessonAction.SelectAnswer(step.id, answer))
    }

    /** "Can't write now", kept for the rest of the day on this device. */
    fun skipWriting() {
        owner?.let { session -> work.launch { choices.set(session, TodayChoice.CantWrite, true) } }
        dispatch(LessonAction.SkipWriting())
    }

    fun restoreWriting() {
        owner?.let { session -> work.launch { choices.set(session, TodayChoice.CantWrite, false) } }
        dispatch(LessonAction.RestoreWriting)
    }

    /** "I can't talk now": spoken screens are typed for the rest of the day on this device. */
    private val talkChoice = mutableStateOf(false)
    val cantTalk: Boolean get() = talkChoice.value

    fun setCantTalk(chosen: Boolean) {
        talkChoice.value = chosen
        owner?.let { session -> work.launch { choices.set(session, TodayChoice.CantTalk, chosen) } }
    }

    /** "I can't listen now": a sound to find by ear is shown as its notes for the rest of the day on this device. */
    private val listenChoice = mutableStateOf(false)
    val cantListen: Boolean get() = listenChoice.value

    fun setCantListen(chosen: Boolean) {
        listenChoice.value = chosen
        owner?.let { session -> work.launch { choices.set(session, TodayChoice.CantListen, chosen) } }
    }

    /**
     * Grades a spoken screen's take on the server; the recorder says what went wrong, and the
     * screen goes back to waiting for another take.
     */
    suspend fun gradeSpoken(
        stepId: String,
        recording: VoiceRecording,
    ): GradeOutcome<Unit> {
        val step = mutableState.value?.currentStep?.takeIf { it.id == stepId && mutableState.value?.phase == LessonPhase.Playing }
        val spoken = step?.content as? StepContent.SpokenAnswer

        if (spoken == null || sessions.current != owner) return GradeOutcome.Obsolete

        dispatch(LessonAction.CheckStarted(stepId))
        val outcome =
            withTimeoutOrNull(SPOKEN_TIMEOUT) {
                cache.mutate { session -> store.api.speak(session, stepId, recording, studySessionId) }.toGradeOutcome()
            } ?: GradeOutcome.Failed

        return when (outcome) {
            is GradeOutcome.Graded -> {
                dispatch(LessonAction.CheckResolved(stepId, outcome.value.toStepResult(spoken.content.targetText), counts = true))
                GradeOutcome.Graded(Unit)
            }

            GradeOutcome.NoSpeech -> {
                dispatch(LessonAction.CheckFailed(stepId, CheckIssue.NoSpeech))
                GradeOutcome.NoSpeech
            }

            is GradeOutcome.Limited -> {
                dispatch(LessonAction.CheckFailed(stepId, CheckIssue.Refused(LessonRefusal.Limited(outcome.limit))))
                outcome
            }

            GradeOutcome.Failed -> {
                dispatch(LessonAction.CheckFailed(stepId))
                GradeOutcome.Failed
            }

            GradeOutcome.Obsolete -> {
                GradeOutcome.Obsolete
            }
        }
    }

    /**
     * Grades the answer in view: a guess reveals at once, the screens the device can grade show
     * their verdict at once and are recorded in the background, and the rest wait for the server.
     */
    fun check() {
        val state = mutableState.value ?: return
        val step = state.currentStep ?: return
        val answer = state.answers[step.id] ?: return

        if (state.phase != LessonPhase.Playing) return

        if (answer is LessonAnswer.Hook) {
            revealGuess(step, answer.optionId)?.let { dispatch(LessonAction.CheckResolved(step.id, it, counts = false)) }
            return
        }

        val runId = (state.run as? LessonRun.Started)?.runId ?: return
        val input =
            LessonStepCheckInput(
                answer = answer.toApi() ?: return,
                durationMs = state.answerDurationMs(),
                runId = UUID.fromString(runId),
                attemptId = UUID.randomUUID(),
                timeZone = timeZone(),
                usedHelp = step.id in state.helped,
            )
        val pending = PendingCheck(step.id, input)
        val local = if (isServerGradedAnswer(answer, step)) null else gradeOnDevice(step, answer)

        if (local == null) {
            gradeOnServer(step, pending, answer.writtenText)
            return
        }

        dispatch(LessonAction.CheckResolved(step.id, local.copy(attemptId = pending.attemptId), counts = true))
        unsaved.getOrPut(step.id) { mutableListOf() } += pending
        work.launch {
            keepUnsent()
            saveScreen(step.id)
        }
    }

    private fun startRun() {
        val lesson = lesson ?: return
        dispatch(LessonAction.RunStarting)
        starting =
            work.launch {
                val outcome =
                    if (sendUnsent()) {
                        start(runId = null) ?: return@launch
                    } else {
                        StartOutcome.Refused(LessonRefusal.Failed)
                    }
                when (outcome) {
                    is StartOutcome.Started -> {
                        val state = playFrom(lesson, outcome.run)
                        if (sessions.current != owner) return@launch
                        mutableState.value = state
                        work.launch { followLatePictures() }
                    }

                    is StartOutcome.Refused -> {
                        val current = mutableState.value ?: LessonPlayerState.initial(lesson.id, lesson.steps, now = now())
                        mutableState.value = reduce(current, LessonAction.RunRefused(outcome.refusal), now())
                    }
                }
            }
    }

    /** Null when the session that opened the lesson isn't current anymore. */
    private suspend fun start(runId: String?): StartOutcome? {
        val result =
            cache.mutate { session ->
                if (session != owner) return@mutate null
                try {
                    StartOutcome.Started(store.api.start(session, lessonId, studySessionId, runId))
                } catch (e: ApiException) {
                    e.toLessonRefusal()?.let(StartOutcome::Refused) ?: throw e
                }
            }

        return when (result) {
            is MutationResult.Done -> result.value
            is MutationResult.Failed -> StartOutcome.Refused(LessonRefusal.Failed)
            MutationResult.Obsolete -> null
        }
    }

    private suspend fun playFrom(
        lesson: PlayableLesson,
        run: LibraryLessonRun,
    ): LessonPlayerState {
        val started = now()
        var state = LessonPlayerState.initial(lesson.id, lesson.steps, run.support?.toSupport(), started)
        state = reduce(state, run.toStartedAction(), started)

        val unplayable = lesson.steps.filterNot(::isPlayable).map(LessonStep::id)
        val leftOut = run.optionalStepIds.orEmpty().map(UUID::toString) + run.answers.map { it.stepId.toString() }
        if (!leftOut.containsAll(unplayable)) return reduce(state, LessonAction.RunRefused(LessonRefusal.NotInApp), started)

        state = reduce(state, LessonAction.SkipSteps(unplayable), started)
        openedAt = started
        state = reduce(state, LessonAction.PicturesRead(emptyList(), openedAt), started)

        val session = owner
        if (session != null && choices.isChosen(session, TodayChoice.CantWrite)) {
            state = reduce(state, LessonAction.SkipWriting(opening = true), started)
        }
        talkChoice.value = session != null && choices.isChosen(session, TodayChoice.CantTalk)
        listenChoice.value = session != null && choices.isChosen(session, TodayChoice.CantListen)

        return state.withFirstAnswer(started)
    }

    /** Main's and Apple's: the lesson is read again every few seconds until its pictures come or their wait ends. */
    private suspend fun followLatePictures() {
        while (true) {
            val steps = mutableState.value?.steps?.values ?: return
            if (steps.none(LessonStep::imagePending)) return

            val isLastRead = steps.none { it.isWaitingForPicture(openedAt, now()) }
            if (!isLastRead) delay(PICTURE_POLL)

            val read = store.lesson(lessonId)
            read.refresh()
            val fresh = (read.state.value.value as? LessonLoad.Ready)?.lesson?.steps.orEmpty()
            if (sessions.current != owner) return
            dispatch(LessonAction.PicturesRead(fresh, openedAt))

            if (isLastRead) return
        }
    }

    /** A hook picked on the lesson's public page opens revealed. */
    private fun LessonPlayerState.withFirstAnswer(now: Long): LessonPlayerState {
        val first = currentStep ?: return this
        val guess = first.content as? StepContent.Guess ?: return this
        val optionId = firstAnswer?.takeIf { id -> guess.content.options.any { it.id == id } } ?: return this

        if (position != 0 || first.id !in steps || first.id in results) return this

        val picked = reduce(this, LessonAction.SelectAnswer(first.id, LessonAnswer.Hook(optionId)), now)
        val result = revealGuess(first, optionId) ?: return picked
        return reduce(picked, LessonAction.CheckResolved(first.id, result, counts = false), now)
    }

    private fun gradeOnServer(
        step: LessonStep,
        pending: PendingCheck,
        answerText: String?,
    ) {
        dispatch(LessonAction.CheckStarted(step.id))
        work.launch {
            val timeout = if (step.kind == StepKind.SpokenAnswer) SPOKEN_TIMEOUT else TYPED_TIMEOUT
            when (val outcome = withTimeoutOrNull(timeout) { send(pending) }) {
                is CheckOutcome.Checked -> {
                    val result = outcome.result.toStepResult(answerText)
                    dispatch(LessonAction.CheckResolved(step.id, result, counts = outcome.result.checked))
                }

                else -> {
                    dispatch(LessonAction.CheckFailed(step.id))
                }
            }
        }
    }

    /** Sends a screen's unsaved answers oldest first; false while one of them can't get through. */
    private suspend fun saveScreen(stepId: String): Boolean =
        screenLocks.getOrPut(stepId, ::Mutex).withLock {
            val queue = unsaved[stepId] ?: return@withLock true

            while (queue.isNotEmpty()) {
                val pending = queue.first()
                val outcome = send(pending)

                if (outcome == CheckOutcome.Failed) return@withLock false
                if (outcome is CheckOutcome.Checked) {
                    dispatch(
                        LessonAction.CheckConfirmed(stepId, pending.attemptId, outcome.result.nextReviewAt, outcome.result.savedMistake),
                    )
                }
                queue.removeAt(0)
                keepUnsent()
            }

            true
        }

    /**
     * Answers the app closed before sending go first, so the run resumes with them; false while one
     * still can't get through, since a run started without it would ask that screen again.
     */
    private suspend fun sendUnsent(): Boolean {
        val queued =
            unsaved.values
                .flatten()
                .map(PendingCheck::attemptId)
                .toSet()
        val kept = unsentAnswers()?.value?.first().orEmpty()

        kept
            .map { PendingCheck(it.stepId, ApiJson.decodeFromJsonElement<LessonStepCheckInput>(it.input)) }
            .filterNot { it.attemptId in queued }
            .forEach { unsaved.getOrPut(it.stepId) { mutableListOf() } += it }
        return unsaved.keys
            .toList()
            .map { saveScreen(it) }
            .all { it }
    }

    private suspend fun keepUnsent() {
        val handle = unsentAnswers() ?: return
        val pending = unsaved.values.flatten()

        if (pending.isEmpty()) {
            handle.remove()
        } else {
            handle.save(pending.map { UnsentAnswer(it.stepId, ApiJson.encodeToJsonElement(it.input)) })
        }
    }

    private fun unsentAnswers() = owner?.let { drafts.open(it, "player.unsent.$lessonId", ListSerializer(UnsentAnswer.serializer())) }

    private suspend fun send(pending: PendingCheck): CheckOutcome {
        val result =
            cache.mutate { session ->
                if (session != owner) return@mutate CheckOutcome.Failed
                try {
                    CheckOutcome.Checked(store.api.check(session, pending.stepId, pending.input))
                } catch (e: ApiException) {
                    if (e.status in REFUSED_CHECK_STATUSES) CheckOutcome.Refused else throw e
                }
            }

        return (result as? MutationResult.Done)?.value ?: CheckOutcome.Failed
    }

    private fun saveCompletion() {
        if (completing?.isActive != true) completing = work.launch { complete() }
    }

    private suspend fun complete() {
        val allSaved =
            unsaved.keys
                .toList()
                .map { saveScreen(it) }
                .all { it }
        val state = mutableState.value ?: return
        val runId = (state.run as? LessonRun.Started)?.runId

        if (!allSaved || runId == null) {
            dispatch(LessonAction.CompletionFailed)
            return
        }

        val result =
            cache.mutate(invalidating = setOf(DataDomain.UserProgress, DataDomain.LearnerModel)) { session ->
                if (session != owner) return@mutate null
                try {
                    CompletionOutcome.Completed(store.api.complete(session, lessonId, runId, state.skippedWritingStepIds))
                } catch (e: ApiException) {
                    if (e.status == UNPROCESSABLE) CompletionOutcome.Incomplete else throw e
                }
            }

        when (val outcome = (result as? MutationResult.Done)?.value) {
            is CompletionOutcome.Completed -> {
                readEnding()
                dispatch(LessonAction.CompletionSaved(outcome.completion))
            }

            CompletionOutcome.Incomplete -> {
                resync(runId)
            }

            null -> {
                if (result is MutationResult.Failed) dispatch(LessonAction.CompletionFailed)
            }
        }
    }

    /** The server's answers say which screen to go back to; a late picture may have brought its question back. */
    private suspend fun resync(runId: String) {
        val restarted = start(runId) as? StartOutcome.Started

        if (restarted == null || restarted.run.runId.toString() != runId) {
            dispatch(LessonAction.CompletionFailed)
            return
        }

        val read = store.lesson(lessonId)
        read.refresh()
        val pictures = ((read.state.value.value as? LessonLoad.Ready)?.lesson?.steps).orEmpty().pictures()
        val run = restarted.run

        dispatch(
            LessonAction.RunResynced(
                runId = run.runId.toString(),
                answers = run.answers.map { RunAnswer(it.stepId.toString(), it.isCorrect, it.answeredAt) },
                optionalStepIds = run.optionalStepIds.orEmpty().map(UUID::toString),
                pictures = pictures,
            ),
        )
    }

    /**
     * A guest outside a session ends with where the lesson fits and "Build my plan"; a chapter's
     * lesson with its next one.
     */
    private suspend fun readEnding() {
        val session = owner ?: return

        if (studySessionId != null) return

        val ending =
            try {
                if (isGuest()) {
                    LessonEnding(guest = true, fit = store.api.fit(session, lessonId))
                } else {
                    LessonEnding(nextLessonId = lesson?.chapterId?.let { nextLessonIn(session, it) })
                }
            } catch (e: ApiException) {
                LessonEnding(guest = isGuest())
            }

        if (sessions.current == session) mutableEnding.value = ending
    }

    /** Main's: the first lesson after this one in its chapter that the learner hasn't finished. */
    private suspend fun nextLessonIn(
        session: AuthenticatedSession,
        chapterId: String,
    ): String? {
        val goalId = activeGoalId() ?: return null
        val lessons = store.api.chapterLessons(session, goalId, chapterId)
        val index = lessons.indexOfFirst { it.lessonId.toString() == lessonId }
        return lessons
            .drop(index + 1)
            .firstOrNull { it.state != ChapterLesson.State.DONE }
            ?.lessonId
            ?.toString()
    }

    /** The work for one learner's run, cancelled when another session opens the lesson. */
    private fun openScope() = CoroutineScope(viewModelScope.coroutineContext + SupervisorJob(viewModelScope.coroutineContext.job))

    private fun LessonPlayerState.answerDurationMs() = (now() - stepStartedAt).coerceIn(0, MAX_ANSWER_DURATION_MS)

    private companion object {
        val TYPED_TIMEOUT = 45.seconds
        val PICTURE_POLL = 4.seconds
        val SPOKEN_TIMEOUT = 60.seconds
        const val MAX_ANSWER_DURATION_MS = 3_600_000L
        const val UNPROCESSABLE = 422
        val REFUSED_CHECK_STATUSES = setOf(400, 404, 409, 422)
    }
}

private fun ApiLessonSupport.toSupport() =
    when (this) {
        ApiLessonSupport.EXPLANATION_FIRST -> LessonSupport.ExplanationFirst
        ApiLessonSupport.QUESTION_FIRST -> LessonSupport.QuestionFirst
    }

private fun LibraryLessonRun.toStartedAction() =
    LessonAction.RunStarted(
        runId = runId.toString(),
        answers = answers.map { RunAnswer(it.stepId.toString(), it.isCorrect, it.answeredAt) },
        hyperdrive = HyperdriveStart(hyperdrive.knownStepIds.map(UUID::toString).toSet(), hyperdrive.streak.toInt()),
        startedAt = startedAt,
        optionalStepIds = optionalStepIds.orEmpty().map(UUID::toString),
    )

private fun List<LessonStep>.pictures(): Map<String, StepImage> = mapNotNull { step -> step.image?.let { step.id to it } }.toMap()
