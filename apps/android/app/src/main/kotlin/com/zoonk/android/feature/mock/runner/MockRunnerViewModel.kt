package com.zoonk.android.feature.mock.runner

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.MutationResult
import com.zoonk.android.data.SessionSource
import com.zoonk.android.data.recode
import com.zoonk.android.feature.questions.Answer
import com.zoonk.android.feature.questions.Question
import com.zoonk.android.feature.questions.isMulti
import com.zoonk.api.ApiJson
import com.zoonk.api.models.MockAnswer
import com.zoonk.api.models.MockExam
import com.zoonk.api.models.MockExamCurrent
import com.zoonk.api.models.MockExamCurrentPlaysInner
import com.zoonk.api.models.MockExamCurrentQuestionsInner
import com.zoonk.api.models.MockExamSectionsInner
import kotlinx.coroutines.Job
import kotlinx.coroutines.async
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.withTimeoutOrNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.decodeFromJsonElement
import kotlinx.serialization.json.jsonObject
import java.util.UUID
import kotlin.time.Clock
import kotlin.time.Duration.Companion.milliseconds
import kotlin.time.Duration.Companion.minutes
import kotlin.time.Duration.Companion.seconds
import kotlin.time.TimeMark
import kotlin.time.TimeSource

/** A mock's question: the kit's question, its number in the exam and whether it's an essay. */
data class MockQuestion(
    val question: Question,
    val number: Int,
    val essay: Boolean,
) {
    val itemId: String get() = question.itemId
}

/** An essay is long typed text to the question kit, which has no essays. */
fun MockExamCurrentQuestionsInner.toMockQuestion(): MockQuestion {
    val essay = format == MockExamCurrentQuestionsInner.Format.ESSAY
    val json = ApiJson.encodeToJsonElement(MockExamCurrentQuestionsInner.serializer(), this).jsonObject
    val question =
        ApiJson.decodeFromJsonElement<Question>(
            JsonObject(json + ("format" to JsonPrimitive(if (essay) "typed" else format.value))),
        )
    return MockQuestion(question, number.toInt(), essay)
}

enum class MockStep { Submit, EndBreak, StartSpeaking, Finish }

/** The running mock as the learner sees it; [view] is the mock as the server last answered. */
data class MockRun(
    val view: MockExam,
    val questions: List<MockQuestion>,
    val position: Int,
    val reached: Int,
    val drafts: Map<String, MockDraft>,
    val moves: SectionMoves,
    val timeUp: Boolean,
    val busy: MockStep? = null,
    val error: Boolean = false,
    val slow: Boolean = false,
) {
    val pending: Boolean get() = busy != null
    val question: MockQuestion? get() = questions.getOrNull(position)
    val counts: SectionCounts get() = sectionCounts(questions, drafts)
    val isLastSection: Boolean get() = view.sections.lastOrNull()?.status == MockExamSectionsInner.Status.CURRENT
    val currentSection: MockExamSectionsInner? get() = view.sections.firstOrNull { it.status == MockExamSectionsInner.Status.CURRENT }

    fun played(setId: String): Int =
        view.current
            ?.plays
            ?.firstOrNull { it.setId.toString() == setId }
            ?.played
            ?.toInt() ?: 0
}

/**
 * Main's `useMockRunner` and `useMockDrafts`: one question at a time, answers saved in order as
 * they're given (typed ones after a pause), the time spent on each, flags, the section's moves and
 * its clocks, and the steps that hand in, end a break, start speaking or grade it. Nothing here
 * says whether an answer is right.
 */
class MockRunnerViewModel(
    private val store: MockRunStore,
    private val sessions: SessionSource,
    private val blockId: String,
    opened: OpenedMock,
    private val reread: suspend () -> Unit,
    private val clock: Clock = Clock.System,
    private val time: TimeSource = TimeSource.Monotonic,
) : ViewModel() {
    private val owner: AuthenticatedSession? = sessions.current
    private val unsent = owner?.let { store.unsent(it, blockId) }
    private val queue = MockSaveQueue(scope = viewModelScope, send = ::send, onPendingChange = ::keepOnDevice)
    private var questionTimeUp = isLastQuestionExpired(opened.view)
    private var changed = emptySet<Int>()
    private val run = MutableStateFlow(start(opened.view, opened.keptHere))
    private var shown: Pair<String, TimeMark>? = null
    private var unsavedText: MockDraft? = null
    private var textSave: Job? = null
    private var sectionClock: Job? = null
    private var lastRead = opened.view
    private var heldRead: MockExam? = null
    private var timedOutDuringStep = false
    private var away = false

    val state: StateFlow<MockRun> = run.asStateFlow()
    val saveStatus: StateFlow<DraftSaveStatus> = queue.status

    init {
        enter(opened.view, opened.keptHere)
    }

    fun answer(answer: Answer?) {
        val question = run.value.question ?: return
        if (!canAnswer(answer)) return
        persist(withTimeSpent(question.itemId).copy(answer = answer))
    }

    /** The question's [index]th option, tapped or by its number key: picks toggle, and a single pick tapped again clears unless an answer is required. */
    fun pickOption(index: Int): Boolean {
        val current = run.value
        val question = current.question ?: return false
        val answers = current.optionAnswers(question) ?: return false
        if (index !in answers.indices) return false
        val saved = current.drafts[question.itemId]?.answer
        if (question.question.select.isMulti) {
            val picks = (saved as? Answer.Choices)?.indexes.orEmpty()
            val next = if (index in picks) picks - index else picks + index
            answer(if (next.isEmpty()) null else Answer.Choices(next))
            return true
        }
        val option = answers[index]
        val picked = option != null && saved == option
        if (!(picked && current.moves.mustAnswer)) answer(if (picked) null else option)
        return true
    }

    /** A typed answer: kept on the device as it's typed, and sent once typing pauses, as main does. */
    fun write(answer: Answer?) {
        val question = run.value.question ?: return
        if (!canAnswer(answer)) return
        val draft = (run.value.drafts[question.itemId] ?: MockDraft(question.itemId)).copy(answer = answer)
        run.update { it.copy(drafts = it.drafts + (draft.itemId to draft)).withMoves() }
        unsavedText = draft
        keepOnDevice()
        textSave?.cancel()
        textSave =
            viewModelScope.launch {
                delay(TEXT_SAVE_DELAY)
                saveText()
            }
    }

    fun toggleFlag() {
        val question = run.value.question ?: return
        unsavedText = null
        saveText()
        val draft = withTimeSpent(question.itemId)
        persist(draft.copy(flagged = !draft.flagged))
    }

    fun go(target: Int) = move(target, timedOut = false)

    /** The question's own clock ran out: the next one opens, or the section's time is up after the last. */
    fun timeOutQuestion() = move(run.value.position + 1, timedOut = true)

    fun retrySaves() = queue.retryNow()

    /** Leaving waits at most a few seconds for answers going out, so the close action always leaves, even offline. */
    suspend fun leave() {
        run.value.question?.let { leaveQuestion(it.itemId) }
        saveText()
        queue.retryNow()
        withTimeoutOrNull(LEAVE_WAIT) { queue.idle() }
    }

    /**
     * A play the server counted, or not; false stops the recording: none were left. The count goes
     * on when the recording leaves the screen, since its sound already started.
     */
    suspend fun play(setId: String): Boolean =
        viewModelScope
            .async {
                when (val result = store.play(blockId, setId)) {
                    is MutationResult.Done -> {
                        when (val outcome = result.value) {
                            is PlayOutcome.Counted -> {
                                run.update { it.copy(view = it.view.withPlayed(setId, outcome.played)) }
                                true
                            }

                            PlayOutcome.UsedUp -> {
                                false
                            }
                        }
                    }

                    // One the server couldn't count keeps playing.
                    is MutationResult.Failed, MutationResult.Obsolete -> {
                        true
                    }
                }
            }.await()

    fun submitSection() =
        step(MockStep.Submit) {
            store.submitSection(
                blockId,
                run.value.view.current
                    ?.section
                    ?.toInt() ?: 0,
            )
        }

    fun endBreak() = step(MockStep.EndBreak) { store.endBreak(blockId) }

    fun startSpeaking() = step(MockStep.StartSpeaking) { store.startSpeaking(blockId) }

    fun finish() = step(MockStep.Finish) { store.finish(blockId) }

    /**
     * Back on screen, the clocks catch up with the time away, and the mock is read again where it
     * may have moved on: a call that finished a speaking task, or a deadline long past. Never hands
     * it in.
     */
    fun onStart() {
        if (!away) return
        away = false
        watchDeadline(run.value.view)
        val current = run.value.view.current ?: return
        val abandoned = clock.now() > current.deadline + ABANDONMENT_DELAY
        if (current.kind == MockExamCurrent.Kind.SPEAKING || abandoned) viewModelScope.launch { reread() }
    }

    /** Off screen, what's typed reaches the disk now rather than after the pause. */
    fun onStop() {
        away = true
        viewModelScope.launch { unsent?.flush() }
    }

    /**
     * A read of the mock while it's open. As main's runner, it moves the run only where the mock
     * moved on without it (expired, a step on another device) or where the run holds no answers
     * (a break, speaking); the answers being given stay as they are. A read during a step waits
     * for the step to fail.
     */
    fun show(read: MockExam) {
        if (read == lastRead) return
        lastRead = read
        if (run.value.pending) {
            heldRead = read
            return
        }
        if (movedOn(read)) reset(read)
    }

    private fun movedOn(read: MockExam): Boolean {
        val view = run.value.view
        val place = { mock: MockExam -> Triple(mock.status, mock.current?.section, mock.current?.kind) }
        return read != view && (run.value.questions.isEmpty() || place(read) != place(view))
    }

    private fun step(
        kind: MockStep,
        request: suspend () -> MutationResult<MockExam?>,
    ) {
        if (run.value.pending) return
        run.value.question?.let { leaveQuestion(it.itemId) }
        run.update { it.copy(busy = kind, error = false) }
        viewModelScope.launch {
            val slow = launch { delay(SLOW_AFTER).also { run.update { it.copy(slow = true) } } }
            val result =
                withTimeoutOrNull(STEP_TIMEOUT) {
                    saveText()
                    queue.idle()
                    request()
                }
            slow.cancel()
            val next = (result as? MutationResult.Done)?.value
            run.update { it.copy(busy = null, slow = false, error = next == null && result !is MutationResult.Obsolete) }
            if (next != null) reset(next) else afterFailedStep()
        }
    }

    /** A step that didn't go through leaves the question on screen, unless a read meanwhile moved the mock on or its clock ran out. */
    private fun afterFailedStep() {
        val read = heldRead
        heldRead = null
        if (read != null && movedOn(read)) return reset(read)
        syncShown()
        if (timedOutDuringStep) {
            timedOutDuringStep = false
            timeOutQuestion()
        }
    }

    private fun reset(next: MockExam) {
        shown = null
        changed = emptySet()
        questionTimeUp = false
        timedOutDuringStep = false
        heldRead = null
        textSave?.cancel()
        unsavedText = null
        run.value = start(next)
        enter(next, kept = emptyList())
    }

    /** Starts on a mock as read: what the device kept goes out before anything else, then the clocks and the question on screen. */
    private fun enter(
        view: MockExam,
        kept: List<MockDraft>,
    ) {
        if (view.status == MockExam.Status.FINISHED || view.status == MockExam.Status.EXPIRED) {
            viewModelScope.launch { unsent?.remove() }
            return
        }
        kept.forEach(queue::add)
        watchDeadline(view)
        syncShown()
    }

    private fun start(
        view: MockExam,
        kept: List<MockDraft> = emptyList(),
    ): MockRun {
        val questions =
            view.current
                ?.questions
                .orEmpty()
                .map { it.toMockQuestion() }
        val resume = view.current?.resume?.toInt() ?: 0
        val drafts =
            view.current?.drafts.orEmpty().associate {
                it.itemId.toString() to
                    MockDraft(it.itemId.toString(), it.answer?.toAnswer(), it.durationMs, it.flagged)
            } + kept.associateBy(MockDraft::itemId)
        val deadline = view.current?.deadline
        return MockRun(
            view = view,
            questions = questions,
            position = resume,
            reached = resume,
            drafts = drafts,
            moves = moves(view, questions, drafts, resume, resume),
            timeUp = (deadline != null && clock.now() >= deadline) || questionTimeUp,
        )
    }

    private fun MockRun.withMoves(): MockRun = copy(moves = moves(view, questions, drafts, position, reached))

    private fun moves(
        view: MockExam,
        questions: List<MockQuestion>,
        drafts: Map<String, MockDraft>,
        position: Int,
        reached: Int,
    ): SectionMoves {
        val changesLeft = view.current?.changesLeft?.toInt()
        return SectionMoves.of(
            navigation = view.sections.firstOrNull { it.status == MockExamSectionsInner.Status.CURRENT }?.navigation,
            answered = drafts[questions.getOrNull(position)?.itemId].isAnswered,
            position = position,
            reached = reached,
            total = questions.size,
            changed = changed,
            changesLeft = changesLeft?.let { (it - changed.size).coerceAtLeast(0) },
        )
    }

    private fun move(
        target: Int,
        timedOut: Boolean,
    ) {
        val current = run.value
        if (current.timeUp || (timedOut && current.moves.itemSeconds == null)) return
        if (current.pending) {
            timedOutDuringStep = timedOutDuringStep || timedOut
            return
        }
        if (timedOut && target == current.questions.size) {
            questionTimeUp = true
            setTimeUp()
            return
        }
        if (!(if (timedOut) current.moves.canOpenAfterTimeout(target) else current.moves.canOpen(target))) return
        current.question?.takeIf { target != current.position }?.let { leaveQuestion(it.itemId) }
        run.update { it.copy(position = target, reached = maxOf(it.reached, target)).withMoves() }
        syncShown()
    }

    private fun canAnswer(next: Answer?): Boolean {
        val current = run.value
        val question = current.question ?: return false
        if (current.pending || current.timeUp || !current.moves.canChange(current.position)) return false
        val saved = current.drafts[question.itemId]?.answer
        if (current.moves.reviewing && current.position < current.reached && saved != next && current.position !in changed) {
            changed = changed + current.position
            run.update { it.withMoves() }
        }
        return true
    }

    /** What isn't stored yet stays on the device, typing included, so a closed app sends it the next time the mock opens. */
    private fun keepOnDevice() {
        unsent?.saveDebounced((queue.pending + listOfNotNull(unsavedText)).associateBy(MockDraft::itemId).values.toList())
    }

    private fun persist(draft: MockDraft) {
        run.update { it.copy(drafts = it.drafts + (draft.itemId to draft)).withMoves() }
        queue.add(draft)
    }

    private fun saveText() {
        textSave?.cancel()
        textSave = null
        val draft = unsavedText ?: return
        unsavedText = null
        persist(draft)
    }

    private fun withTimeSpent(itemId: String): MockDraft {
        val draft = run.value.drafts[itemId] ?: MockDraft(itemId)
        val since = shown?.takeIf { it.first == itemId }?.second
        shown = itemId to time.markNow()
        return since?.let { draft.copy(durationMs = draft.durationMs + it.elapsedNow().inWholeMilliseconds) } ?: draft
    }

    private fun leaveQuestion(itemId: String) {
        if (shown?.first != itemId) return
        unsavedText = null
        saveText()
        persist(withTimeSpent(itemId))
        shown = null
    }

    /** Starts the clock on the question on screen; a forward-only section saves it as visited. */
    private fun syncShown() {
        val current = run.value
        val question = current.question
        if (current.timeUp || question == null) {
            question?.let { leaveQuestion(it.itemId) }
            return
        }
        shown = question.itemId to time.markNow()
        if (current.moves.forwardOnly && question.itemId !in current.drafts) persist(MockDraft(question.itemId))
    }

    private fun watchDeadline(view: MockExam) {
        sectionClock?.cancel()
        val deadline = view.current?.deadline ?: return
        sectionClock =
            viewModelScope.launch {
                delay((deadline - clock.now()).coerceAtLeast(0.milliseconds))
                setTimeUp()
                // Main's `useRefreshPastMockDeadline`: long past it, a read may show it expired.
                delay((deadline + ABANDONMENT_DELAY - clock.now()).coerceAtLeast(0.milliseconds) + 1.milliseconds)
                reread()
            }
    }

    private fun setTimeUp() {
        if (run.value.timeUp) return
        run.value.question?.let { leaveQuestion(it.itemId) }
        run.update { it.copy(timeUp = true) }
    }

    private fun isLastQuestionExpired(view: MockExam): Boolean {
        val current = view.current ?: return false
        val seconds =
            view.sections
                .firstOrNull { it.index == current.section }
                ?.navigation
                ?.itemSeconds
                ?.toInt()
        val last = current.questions.lastOrNull()?.itemId ?: return false
        val draft = current.drafts.firstOrNull { it.itemId == last }
        return isSavedQuestionExpired(draft?.let { MockDraft(it.itemId.toString(), durationMs = it.durationMs) }, seconds)
    }

    private suspend fun send(draft: MockDraft): SendResult {
        if (sessions.current != owner) return SendResult.Stop
        return when (val result = store.save(blockId, draft)) {
            is MutationResult.Done -> if (result.value == SaveOutcome.Stored) SendResult.Stored else SendResult.Refused
            is MutationResult.Failed -> SendResult.Unreachable
            MutationResult.Obsolete -> SendResult.Stop
        }
    }

    private companion object {
        val TEXT_SAVE_DELAY = 1500.milliseconds
        val LEAVE_WAIT = 5.seconds
        val SLOW_AFTER = 10.seconds

        /** A retry after the timeout is safe: a handed-in section stays handed in. */
        val STEP_TIMEOUT = 45.seconds

        /** Core's `MOCK_ABANDONMENT_DELAY_MS`. */
        val ABANDONMENT_DELAY = 10.minutes
    }
}

/** What the device kept for the section on screen; answers to one handed in since can't be saved any more. */
private val OpenedMock.keptHere: List<MockDraft>
    get() {
        val items =
            view.current
                ?.questions
                .orEmpty()
                .map { it.itemId.toString() }
                .toSet()
        return unsent.filter { it.itemId in items }
    }

private fun MockExam.withPlayed(
    setId: String,
    played: Int,
): MockExam {
    val current = current ?: return this
    val plays = current.plays.filter { it.setId.toString() != setId } + MockExamCurrentPlaysInner(played.toLong(), UUID.fromString(setId))
    return copy(current = current.copy(plays = plays))
}

private fun MockAnswer.toAnswer(): Answer = recode()
