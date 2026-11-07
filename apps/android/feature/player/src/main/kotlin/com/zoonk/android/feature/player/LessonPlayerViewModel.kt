package com.zoonk.android.feature.player

import androidx.compose.runtime.Immutable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.zoonk.android.data.AnalyticsEvent
import com.zoonk.android.data.ApiException
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.DataDomain
import com.zoonk.android.data.DraftStore
import com.zoonk.android.data.EventTracker
import com.zoonk.android.data.MutationResult
import com.zoonk.android.data.Resource
import com.zoonk.android.data.SessionSource
import com.zoonk.android.data.value
import com.zoonk.android.feature.activities.savedJson
import com.zoonk.android.feature.audio.GradeOutcome
import com.zoonk.android.feature.audio.VoiceRecording
import com.zoonk.android.feature.audio.toGradeOutcome
import com.zoonk.android.feature.goalcontent.ChapterKey
import com.zoonk.android.feature.goalcontent.GoalContentStore
import com.zoonk.android.feature.player.engine.CheckIssue
import com.zoonk.android.feature.player.engine.CompletionStatus
import com.zoonk.android.feature.player.engine.HyperdriveStart
import com.zoonk.android.feature.player.engine.LessonAction
import com.zoonk.android.feature.player.engine.LessonPhase
import com.zoonk.android.feature.player.engine.LessonPlayerState
import com.zoonk.android.feature.player.engine.LessonRefusal
import com.zoonk.android.feature.player.engine.LessonRun
import com.zoonk.android.feature.player.engine.RunAnswer
import com.zoonk.android.feature.player.engine.abandonEvent
import com.zoonk.android.feature.player.engine.gradeOnDevice
import com.zoonk.android.feature.player.engine.hasExampleLineSlot
import com.zoonk.android.feature.player.engine.isServerGradedAnswer
import com.zoonk.android.feature.player.engine.isWaitingForPicture
import com.zoonk.android.feature.player.engine.playedSteps
import com.zoonk.android.feature.player.engine.reduce
import com.zoonk.android.feature.player.engine.revealGuess
import com.zoonk.android.feature.player.engine.round
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
import com.zoonk.android.ui.components.Limit
import com.zoonk.api.ApiJson
import com.zoonk.api.models.ChapterLesson
import com.zoonk.api.models.LessonFit
import com.zoonk.api.models.LessonStepCheckInput
import com.zoonk.api.models.LessonStepCheckResult
import com.zoonk.api.models.LibraryLessonCompletion
import com.zoonk.api.models.LibraryLessonRun
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.CoroutineStart
import kotlinx.coroutines.Deferred
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
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
import java.time.LocalDate
import java.util.UUID
import kotlin.time.Duration.Companion.seconds
import kotlin.time.Instant

/** [fit] is where a guest's lesson sits in its course; null outside a public chapter. */
@Immutable
data class LessonEnding(
    val nextLessonId: String? = null,
    val guest: Boolean = false,
    val fit: LessonFit? = null,
    val inSession: Boolean = false,
)

@Immutable
sealed interface AnswerExplanation {
    data object Loading : AnswerExplanation

    data class Explained(
        val text: String,
    ) : AnswerExplanation

    data class Refused(
        val limit: Limit,
    ) : AnswerExplanation

    data object Failed : AnswerExplanation
}

/** An answer on its way to the server, sent again under the same attempt until the server has it. */
private data class PendingCheck(
    val stepId: String,
    val input: LessonStepCheckInput,
    val isCorrect: Boolean? = null,
    val answeredAt: Instant? = null,
) {
    val attemptId: String get() = input.attemptId.toString()

    val progress: RunAnswer? get() = isCorrect?.let { correct -> answeredAt?.let { RunAnswer(stepId, correct, it) } }
}

@Serializable
private data class UnsentAnswer(
    val stepId: String,
    val input: JsonElement,
    val isCorrect: Boolean? = null,
    val answeredAt: Instant? = null,
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
    private val endsAsGuest: () -> Boolean = { false },
    private val activeGoalId: () -> String? = { null },
    private val lessonStarted: Resource<Boolean>? = null,
    private val chapters: GoalContentStore? = null,
    private val analytics: EventTracker = EventTracker {},
    private val saved: SavedStateHandle,
    private val now: () -> Long = System::currentTimeMillis,
) : ViewModel() {
    private val mutableState = MutableStateFlow<LessonPlayerState?>(null)
    private val mutableEnding = MutableStateFlow(LessonEnding(inSession = studySessionId != null))
    private val sessionMover =
        sessionSteps?.let { steps ->
            studySessionId?.let { id -> runCatching { UUID.fromString(id) }.getOrNull() }?.let { SessionMover(steps, it, viewModelScope) }
        }

    /** Null until the run starts or is refused. */
    val state: StateFlow<LessonPlayerState?> = mutableState.asStateFlow()

    /** Where the lesson's end leads, read once it's saved. */
    val ending: StateFlow<LessonEnding> = mutableEnding.asStateFlow()

    val sessionMove: StateFlow<SessionMove> = sessionMover?.move ?: MutableStateFlow(SessionMove())

    private val mutableExplanations = MutableStateFlow<Map<String, AnswerExplanation>>(emptyMap())

    /** By screen: a wrong typed answer's explanation, once the learner asked for it. */
    val explanations: StateFlow<Map<String, AnswerExplanation>> = mutableExplanations.asStateFlow()

    private var lesson: PlayableLesson? = null
    private var openedAt = 0L
    private var replay = false
    private var owner = sessions.current
    private var work = openScope()
    private var starting: Job? = null
    private var completing: Job? = null
    private val unsaved = mutableMapOf<String, MutableList<PendingCheck>>()
    private val screenLocks = mutableMapOf<String, Mutex>()
    private val unsentLock = Mutex()
    private var resending: Deferred<Boolean>? = null
    var hasUnsent by mutableStateOf(false)
        private set
    private var exampleLinesWrite: Job? = null
    private var writingExampleLines by mutableStateOf(false)
    private var abandonSent = false
    private val encodedAnswers = HashMap<String, Pair<LessonAnswer, String?>>()

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
        resending = null
        hasUnsent = false
        exampleLinesWrite = null
        writingExampleLines = false
        mutableEnding.value = LessonEnding(inSession = studySessionId != null)
        mutableExplanations.value = emptyMap()
        mutableState.value = null
        startRun()
    }

    /** The app went to the background or the player closed: an unfinished run counts as abandoned, once. */
    fun leave() {
        if (abandonSent) return
        val event = mutableState.value?.abandonEvent() ?: return
        abandonSent = true
        analytics.track(event)
    }

    fun continueSession() {
        sessionMover?.continueSession()
    }

    fun stopSession() {
        sessionMover?.stop()
    }

    /** After "Try again", or once a slow-down's wait is over. */
    fun retryStart() {
        if (starting?.isActive != true) startRun()
    }

    fun dispatch(action: LessonAction) {
        if (action == LessonAction.Continue || action == LessonAction.GoBack) writeExampleLines()
        if (action == LessonAction.Continue) resendAnswers()
        val before = mutableState.value
        mutableState.update { state -> state?.let { reduce(it, action, now()) } }
        val after = mutableState.value ?: return
        if (after.completion?.status == CompletionStatus.Saving && before?.completion?.status != CompletionStatus.Saving) saveCompletion()
        keepWork(after)
    }

    /**
     * Saves what the learner did and hasn't checked, for when Android closes the app in the background: each screen's
     * answer and revealed steps, and the round its canvas work belongs to. A checked screen keeps neither and is saved
     * under its next round: the resumed run puts its retry straight on screen, and that retry starts over.
     */
    private fun keepWork(state: LessonPlayerState) {
        // Until a run starts it holds none of the saved work, so what's saved waits for the run that restores it.
        if (state.run !is LessonRun.Started) return
        val checked = state.results.keys
        saved[ROUNDS] = HashMap(state.rounds + checked.associateWith { state.round(it) + 1 })
        saved[REVEALED] = HashMap(state.revealed - checked)
        saved[ANSWERS] = HashMap((state.answers - checked).mapNotNull { (id, answer) -> answerJson(id, answer)?.let { id to it } }.toMap())
    }

    /** An answer's saved JSON, encoded again only when the answer changes: a slider dispatches on every step it moves. */
    private fun answerJson(
        stepId: String,
        answer: LessonAnswer,
    ): String? {
        encodedAnswers[stepId]?.takeIf { it.first === answer }?.let { return it.second }
        return savedJson(ApiJson, LessonAnswer.serializer(), answer).also { encodedAnswers[stepId] = answer to it }
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
    private val talkDay = mutableStateOf<LocalDate?>(null)
    val cantTalk: Boolean get() = talkDay.value == choices.today()

    fun setCantTalk(chosen: Boolean) {
        talkDay.value = choices.today().takeIf { chosen }
        owner?.let { session -> work.launch { choices.set(session, TodayChoice.CantTalk, chosen) } }
    }

    /** "I can't listen now": a sound to find by ear is shown as its notes for the rest of the day on this device. */
    private val listenDay = mutableStateOf<LocalDate?>(null)
    val cantListen: Boolean get() = listenDay.value == choices.today()

    fun setCantListen(chosen: Boolean) {
        listenDay.value = choices.today().takeIf { chosen }
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
                cache
                    .mutate(replacing = { markStarted(recorded = true) }) { session ->
                        store.api.speak(session, stepId, recording, studySessionId)
                    }.toGradeOutcome()
            } ?: GradeOutcome.Failed

        return when (outcome) {
            is GradeOutcome.Graded -> {
                dispatch(LessonAction.CheckResolved(stepId, outcome.value.toStepResult(spoken.content.targetText), counts = true))
                resendAnswers()
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

        writeExampleLines()

        if (answer is LessonAnswer.Hook) {
            analytics.track(AnalyticsEvent.HookAnswered(state.lessonId))
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
        val local = if (isServerGradedAnswer(answer, step)) null else gradeOnDevice(step, answer)
        val pending = PendingCheck(step.id, input, local?.isCorrect, Instant.fromEpochMilliseconds(now()))

        if (local == null) {
            gradeOnServer(step, pending, answer.writtenText)
            return
        }

        countActivity(step)
        dispatch(LessonAction.CheckResolved(step.id, local.copy(attemptId = pending.attemptId), counts = true))
        unsaved.getOrPut(step.id) { mutableListOf() } += pending
        work.launch {
            keepUnsent()
            saveScreen(step.id)
        }
    }

    /** Null while the lesson's example lines are being written, so a screen reads its line once they're in. */
    fun exampleLine(stepId: String): Resource<String>? = store.exampleLine(stepId).takeUnless { writingExampleLines }

    /**
     * Main's: the learner's first move writes the lesson's example lines, never its opening, and a
     * failed write isn't tried again. Every line is read again once the write settles, since its
     * response can be lost or built from memory that changed meanwhile.
     */
    private fun writeExampleLines() {
        val slots =
            lesson
                ?.steps
                .orEmpty()
                .filter { it.hasExampleLineSlot }
                .map(LessonStep::id)
        val first = slots.firstOrNull() ?: return

        if (exampleLinesWrite != null) return

        writingExampleLines = true
        exampleLinesWrite =
            work.launch {
                cache.mutate(invalidating = setOf(DataDomain.Allowance)) { session ->
                    if (session == owner) store.api.writeExampleLines(session, first)
                }
                slots.forEach { store.exampleLine(it).invalidate() }
                writingExampleLines = false
            }
    }

    /** Why the typed answer in view misses: it may run AI, so only on the learner's tap. */
    fun explainAnswer() {
        val state = mutableState.value ?: return
        val step = state.currentStep ?: return
        val answer = state.results[step.id]?.answerText ?: return

        if (mutableExplanations.value[step.id] == AnswerExplanation.Loading) return

        mutableExplanations.update { it + (step.id to AnswerExplanation.Loading) }
        work.launch {
            val explained =
                cache.mutate(invalidating = setOf(DataDomain.Allowance)) { session ->
                    if (session == owner) store.api.explainAnswer(session, step.id, answer) else null
                }
            val explanation =
                when (explained) {
                    is MutationResult.Done -> explained.value?.let(AnswerExplanation::Explained)
                    is MutationResult.Failed -> Limit.of(explained)?.let(AnswerExplanation::Refused) ?: AnswerExplanation.Failed
                    MutationResult.Obsolete -> null
                }
            mutableExplanations.update { if (explanation == null) it - step.id else it + (step.id to explanation) }
        }
    }

    private fun startRun() {
        val opened = lesson ?: return
        dispatch(LessonAction.RunStarting)
        starting =
            work.launch {
                // The run keeps the screens it starts with, and the copy shown on opening may predate a plan change or
                // a rewrite, so a stale one is read again first, as Apple's player does. Offline, the copy plays.
                val read = store.lesson(lessonId)
                val reading = async { read.load() }
                val queued =
                    unsaved.values
                        .flatten()
                        .map(PendingCheck::attemptId)
                        .toSet()
                unsentAnswers()
                    ?.value
                    ?.first()
                    .orEmpty()
                    .map { PendingCheck(it.stepId, ApiJson.decodeFromJsonElement(it.input), it.isCorrect, it.answeredAt) }
                    .filterNot { it.attemptId in queued }
                    .forEach { unsaved.getOrPut(it.stepId) { mutableListOf() } += it }
                hasUnsent = unsaved.values.any { it.isNotEmpty() }
                sendUnsent()
                val outcome = start(runId = null)
                if (outcome !is StartOutcome.Started) reading.cancel()
                if (outcome == null) return@launch
                when (outcome) {
                    is StartOutcome.Started -> {
                        reading.await()
                        val lesson = (read.state.value.value as? LessonLoad.Ready)?.lesson ?: opened
                        this@LessonPlayerViewModel.lesson = lesson
                        val state = playFrom(lesson, outcome.run)
                        if (sessions.current != owner) return@launch
                        replay = outcome.run.replay
                        mutableState.value = state
                        work.launch { followLatePictures() }
                    }

                    is StartOutcome.Refused -> {
                        val current = mutableState.value ?: LessonPlayerState.initial(opened.id, opened.playedSteps, now = now())
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
        var state = LessonPlayerState.initial(lesson.id, lesson.playedSteps, now = started)
        state = reduce(state, run.toStartedAction(unsaved.values.flatten().mapNotNull(PendingCheck::progress)), started)

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
        talkDay.value = choices.today().takeIf { session != null && choices.isChosen(session, TodayChoice.CantTalk) }
        listenDay.value = choices.today().takeIf { session != null && choices.isChosen(session, TodayChoice.CantListen) }

        // After the server's answers rebuild the run, what the learner did and hadn't checked comes back, under the round
        // it was saved in, when Android closed the app in the background.
        val rounds = saved.get<Map<String, Int>>(ROUNDS).orEmpty()
        val revealed = saved.get<Map<String, Int>>(REVEALED).orEmpty()
        val answers =
            saved.get<Map<String, String>>(ANSWERS).orEmpty().mapValues { (_, json) ->
                ApiJson.decodeFromString(LessonAnswer.serializer(), json)
            }
        val resumed = state.withFirstAnswer(started)
        return resumed.copy(answers = resumed.answers + answers, revealed = resumed.revealed + revealed, rounds = resumed.rounds + rounds)
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
            when (val outcome = withTimeoutOrNull(timeout) { if (saveScreen(step.id)) send(pending) else CheckOutcome.Failed }) {
                is CheckOutcome.Checked -> {
                    val result = outcome.result.toStepResult(answerText)
                    countActivity(step)
                    dispatch(LessonAction.CheckResolved(step.id, result, counts = outcome.result.checked))
                    resendAnswers()
                }

                else -> {
                    dispatch(LessonAction.CheckFailed(step.id))
                }
            }
        }
    }

    /** A graded check of an activity, as main counts the ones it grades on the device. */
    private fun countActivity(step: LessonStep) {
        val activity = step.content as? StepContent.Activity ?: return
        analytics.track(AnalyticsEvent.ActivityUsed(lessonId, activity.frame.template))
    }

    /** Sends a screen's unsaved answers oldest first; false while one of them can't get through. */
    private suspend fun saveScreen(stepId: String): Boolean {
        var checked = false
        val saved =
            screenLocks.getOrPut(stepId, ::Mutex).withLock {
                val queue = unsaved[stepId] ?: return@withLock true

                while (queue.isNotEmpty()) {
                    val pending = queue.first()
                    val outcome = send(pending)

                    if (outcome == CheckOutcome.Failed) {
                        if (sessions.current == owner) hasUnsent = true
                        return@withLock false
                    }
                    if (outcome is CheckOutcome.Checked) {
                        checked = true
                        dispatch(
                            LessonAction.CheckConfirmed(
                                stepId,
                                pending.attemptId,
                                outcome.result.nextReviewAt,
                                outcome.result.savedMistake,
                            ),
                        )
                    }
                    queue.removeAt(0)
                    hasUnsent = hasUnsent && unsaved.values.any { it.isNotEmpty() }
                    keepUnsent()
                }

                unsaved.remove(stepId)
                true
            }
        if (checked) resendAnswers()
        return saved
    }

    fun resendAnswers() {
        if (unsaved.isNotEmpty() && resending?.isActive != true) work.launch { sendUnsent() }
    }

    private suspend fun sendUnsent(): Boolean {
        resending?.takeIf { it.isActive }?.let { return it.await() }
        if (unsaved.isEmpty()) return true
        val pass =
            work.async(start = CoroutineStart.LAZY) {
                keepUnsent()
                unsaved.keys
                    .toList()
                    .map { async { saveScreen(it) } }
                    .awaitAll()
                    .all { it }
            }
        resending = pass
        return pass.await()
    }

    private suspend fun keepUnsent() =
        unsentLock.withLock {
            val handle = unsentAnswers() ?: return@withLock
            val pending = unsaved.values.flatten()

            if (pending.isEmpty()) {
                handle.remove()
            } else {
                handle.save(pending.map { UnsentAnswer(it.stepId, ApiJson.encodeToJsonElement(it.input), it.isCorrect, it.answeredAt) })
            }
        }

    private fun unsentAnswers() = owner?.let { drafts.open(it, "player.unsent.$lessonId", ListSerializer(UnsentAnswer.serializer())) }

    private fun markStarted(recorded: Boolean) = listOfNotNull(lessonStarted?.takeIf { recorded }?.replacing(true))

    private suspend fun send(pending: PendingCheck): CheckOutcome {
        val result =
            cache.mutate(replacing = { markStarted(recorded = (it as? CheckOutcome.Checked)?.result?.checked == true) }) { session ->
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
        val allSaved = sendUnsent()
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
     * A guest's lesson from the catalog ([endsAsGuest]) ends with where it fits and "Build my plan"; a chapter's
     * lesson with its next one, unless the learner had already finished it and came back to review.
     */
    private suspend fun readEnding() {
        val session = owner ?: return

        if (studySessionId != null) return

        val ending =
            try {
                if (endsAsGuest()) {
                    LessonEnding(guest = true, fit = store.api.fit(session, lessonId))
                } else {
                    LessonEnding(nextLessonId = lesson?.chapterId?.takeUnless { replay }?.let { nextLessonIn(it) })
                }
            } catch (e: ApiException) {
                LessonEnding(guest = endsAsGuest())
            }

        if (sessions.current == session) mutableEnding.value = ending
    }

    /** Main's: the first lesson after this one in its chapter that the learner hasn't finished. */
    private suspend fun nextLessonIn(chapterId: String): String? {
        val goalId = activeGoalId() ?: return null
        val lessons = chapters?.lessons(ChapterKey(UUID.fromString(goalId), UUID.fromString(chapterId))) ?: return null
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
        const val ROUNDS = "rounds"
        const val REVEALED = "revealed"
        const val ANSWERS = "answers"
    }
}

private fun LibraryLessonRun.toStartedAction(heldAnswers: List<RunAnswer>) =
    LessonAction.RunStarted(
        runId = runId.toString(),
        answers = answers.map { RunAnswer(it.stepId.toString(), it.isCorrect, it.answeredAt) },
        hyperdrive = HyperdriveStart(hyperdrive.knownStepIds.map(UUID::toString).toSet(), hyperdrive.streak.toInt()),
        startedAt = startedAt,
        optionalStepIds = optionalStepIds.orEmpty().map(UUID::toString),
        heldAnswers = heldAnswers,
    )

private fun List<LessonStep>.pictures(): Map<String, StepImage> = mapNotNull { step -> step.image?.let { step.id to it } }.toMap()
