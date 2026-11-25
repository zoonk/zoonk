package com.zoonk.android.feature.onboarding.start

import androidx.compose.foundation.text.input.TextFieldState
import androidx.compose.foundation.text.input.clearText
import androidx.compose.foundation.text.input.setTextAndPlaceCursorAtEnd
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.serialization.saved
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.compose.SavedStateHandleSaveableApi
import androidx.lifecycle.viewmodel.compose.saveable
import com.zoonk.android.data.AnalyticsEvent
import com.zoonk.android.data.EventTracker
import com.zoonk.android.data.GenerationFailure
import com.zoonk.android.data.GenerationFollower
import com.zoonk.android.data.GenerationKind
import com.zoonk.android.data.GenerationRun
import com.zoonk.android.data.LoadState
import com.zoonk.android.data.Visit
import com.zoonk.android.data.value
import com.zoonk.android.feature.onboarding.AttachedSource
import com.zoonk.android.feature.onboarding.GoalError
import com.zoonk.android.feature.onboarding.GoalLimitReason
import com.zoonk.android.feature.onboarding.OnboardingStore
import com.zoonk.android.feature.onboarding.PickedFile
import com.zoonk.android.feature.onboarding.Refusal
import com.zoonk.android.feature.onboarding.WriteOutcome
import com.zoonk.android.feature.onboarding.canAttachMaterial
import com.zoonk.android.feature.onboarding.goalLimitReason
import com.zoonk.android.feature.onboarding.startError
import com.zoonk.api.models.GoalCreateInput
import com.zoonk.api.models.GoalUnderstanding
import com.zoonk.api.models.GoalUnderstandingInput
import com.zoonk.api.models.MaterialQuestionAnswer
import com.zoonk.api.models.OnboardingDraft
import com.zoonk.api.models.OnboardingDraftEdit
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import kotlinx.serialization.Serializable
import java.util.UUID

@Serializable
enum class MaterialIntent { Exam, Understand, Questions }

@Serializable
sealed interface StartScreen {
    @Serializable
    data object Entry : StartScreen

    @Serializable
    data object Questions : StartScreen

    @Serializable
    data class Sending(
        val goal: String,
    ) : StartScreen

    @Serializable
    data class Draft(
        val id: String,
    ) : StartScreen
}

/** What survives process death: the screen, the words and the material, not what was on its way. */
@Serializable
data class StartFlowState(
    val screen: StartScreen = StartScreen.Entry,
    val attached: List<AttachedSource> = emptyList(),
    val intent: MaterialIntent? = null,
    /** When the wait for the draft's read began on this device: its send, a Try again that starts it over or the screen opening on it. */
    val waitStartedAt: Long? = null,
    val attemptId: String? = null,
)

enum class WaitlistOutcome { Joined, SignInRequired, Failed }

/** What a goal made from the card opens: its setup, or the explanation a question asks for. */
enum class GoalOpens { Setup, Explanation }

data class CreatedGoal(
    val id: String,
    val opens: GoalOpens,
)

/** Reading words, reading them again and creating goals are POSTs from the learner's taps; opening a draft only reads it. */
@OptIn(SavedStateHandleSaveableApi::class)
class StartGoalViewModel(
    private val store: OnboardingStore,
    handle: SavedStateHandle,
    goal: String?,
    draftId: String?,
    private val planId: String?,
    private val analytics: EventTracker = EventTracker {},
) : ViewModel() {
    /** This visit to the start screen: the goal it made opens, or its failure shows, only on it. */
    val visit = Visit(::stopWaiting)

    /** The goal the card made, for the screen to open. */
    val created = visit.outcome<CreatedGoal>()

    private val creationFailure = visit.outcome<GoalError>()

    private var saved by handle.saved {
        StartFlowState(
            screen = draftId?.let(StartScreen::Draft) ?: StartScreen.Entry,
            waitStartedAt = draftId?.let { System.currentTimeMillis() },
        )
    }

    var flow by mutableStateOf(
        saved.let {
            if (it.screen is StartScreen.Sending) it.copy(screen = StartScreen.Entry) else it
        },
    )
        private set

    var entryError by mutableStateOf<GoalError?>(null)
        private set

    /** Ids of attached material the last send found gone, marked until it's removed or added again. */
    var gone by mutableStateOf(emptySet<String>())
        private set

    /** A draft whose read hit a limit when started again. */
    var draftLimit by mutableStateOf<GoalError?>(null)
        private set

    /** The read finished, but reading its result didn't. */
    var readFailed by mutableStateOf(false)
        private set

    var isCreating by mutableStateOf(false)
        private set

    val creationError get() = creationFailure.value

    var waitlist by mutableStateOf<WaitlistOutcome?>(null)
        private set

    var isJoining by mutableStateOf(false)
        private set

    var isAttachOpen by mutableStateOf(false)
        private set

    var isAttaching by mutableStateOf(false)
        private set

    private val attachFailed = visit.outcome<WriteOutcome<*>>()

    /** The last attach attempt that didn't add anything, on this visit. */
    val attachFailure get() = attachFailed.value

    var turns by mutableStateOf(emptyList<MaterialTurn>())
        private set

    /** The question on its way: asked, waiting for its answer or for the material to be read. */
    var asking by mutableStateOf<String?>(null)
        private set

    val isAsking get() = asking != null

    private var askJob: Job? = null

    /** Words sent while material was still being added: they go once it's added, with it. */
    var heldGoal by mutableStateOf<String?>(null)
        private set

    /** The question being typed, kept here so one that comes back unasked returns to the box. */
    val question = handle.saveable(key = "materialQuestion", saver = TextFieldState.Saver) { TextFieldState() }

    var isRetrying by mutableStateOf(false)
        private set

    /** The fact being fixed in place, its save on its way, and the last one that didn't save. */
    var editing by mutableStateOf<String?>(null)
        private set

    var savingEdit by mutableStateOf<String?>(null)
        private set

    private val editFailure = visit.outcome<String>()

    val failedEdit get() = editFailure.value

    private var isSending = false

    /** The session this flow's words, material and answers belong to. */
    private var sessionKey: String? = null
    private var sessionHasAccount = false

    /** The run the screen's draft is read by, so the same run isn't followed from the start again. */
    private var followed: String? = null

    val follower =
        GenerationFollower(
            kind = GenerationKind.Understanding,
            scope = viewModelScope,
            source = store.generations,
            restart = ::restartRead,
        )

    init {
        viewModelScope.launch {
            follower.run.collect { run -> if (run.status == GenerationRun.Status.Ready) loadRead() }
        }
    }

    val words =
        handle.saveable(key = "goalWords", saver = TextFieldState.Saver) {
            TextFieldState((saved.screen as? StartScreen.Sending)?.goal ?: goal.orEmpty())
        }

    fun setAttached(attached: List<AttachedSource>) = update { it.copy(attached = attached) }

    fun setIntent(intent: MaterialIntent) = update { it.copy(intent = intent) }

    fun toggleAttach() {
        isAttachOpen = !isAttachOpen
        if (canAttach) attachFailed.clear()
    }

    fun removeAttached(id: String) {
        gone -= id
        update { it.copy(attached = it.attached.filterNot { source -> source.id == id }) }
    }

    fun attachFile(
        file: PickedFile,
        language: String,
    ) = attach { store.attachFile(file, language) }

    fun attachText(
        text: String,
        language: String,
    ) = attach { store.attachText(text, language) }

    fun attachLink(
        url: String,
        language: String,
    ) = attach { store.attachLink(url, language) }

    /** Sending is the request: a question about material still being read is asked again every few seconds until it's read. */
    fun ask(language: String) {
        val asked = question.text.trim().toString()
        if (isAsking || asked.isEmpty()) return
        asking = asked
        question.clearText()
        askJob =
            viewModelScope.launch {
                val outcome = askOnceRead(asked, language)
                if (outcome != WriteOutcome.Obsolete) turns = turns + MaterialTurn(asked, outcome)
                asking = null
            }
    }

    private suspend fun askOnceRead(
        asked: String,
        language: String,
    ): WriteOutcome<MaterialQuestionAnswer> {
        while (true) {
            val outcome = store.askMaterial(asked, flow.attached.map { it.id }, language)
            if (outcome != WriteOutcome.Refused(Refusal.MaterialReading)) return outcome
            delay(READ_CHECK)
        }
    }

    val canAttach: Boolean get() = !isAttaching && attachFailure.canAttachMaterial(java.time.Instant.now())

    /** The most material a goal is sent with, once that many are attached: no more can be added until one is removed. */
    val materialLimitReached: Int? get() = MAX_GOAL_SOURCES.takeIf { flow.attached.size >= it }

    private fun attach(add: suspend () -> WriteOutcome<AttachedSource>) {
        if (!canAttach) return
        isAttaching = true
        attachFailed.clear()
        val started = visit.number
        viewModelScope.launch {
            when (val outcome = add()) {
                is WriteOutcome.Done -> {
                    isAttachOpen = false
                    gone -= outcome.value.id
                    update { it.copy(attached = it.attached.filterNot { source -> source.id == outcome.value.id } + outcome.value) }
                }

                WriteOutcome.Obsolete -> {
                    heldGoal = null
                }

                else -> {
                    // Nothing is sent without the material: the learner stays to see why.
                    heldGoal = null
                    attachFailed.send(started, outcome)
                }
            }
            isAttaching = false
        }
    }

    /** Questions about material stay here; anything else is read. Words sent while material is being added wait for it. */
    fun submit(
        typed: String,
        materialGoal: String,
        language: String,
    ) {
        if (isAttaching) {
            heldGoal = typed
            return
        }
        heldGoal = null
        val withMaterial = if (flow.attached.isNotEmpty()) flow.intent else null
        if (withMaterial == MaterialIntent.Questions) {
            update { it.copy(screen = StartScreen.Questions) }
            return
        }
        send(typed.ifBlank { materialGoal }, language, words = typed)
    }

    /** One goal on its way at a time; a goal that isn't read gives the entry back its [words], what the learner typed. */
    fun send(
        goal: String,
        language: String,
        words: String = goal,
    ) {
        if (isSending) return
        val sourceIds = flow.attached.map { UUID.fromString(it.id) }.ifEmpty { null }
        val materialIntent =
            when (flow.intent.takeIf { sourceIds != null }) {
                MaterialIntent.Exam -> GoalUnderstandingInput.MaterialIntent.EXAM
                MaterialIntent.Understand -> GoalUnderstandingInput.MaterialIntent.UNDERSTAND
                MaterialIntent.Questions, null -> null
            }
        isSending = true
        val attempt = AnalyticsEvent.GoalTyped(hasAttachment = sourceIds != null)
        analytics.track(attempt)
        draftId?.let(store::forgetSent)
        entryError = null
        update { it.copy(screen = StartScreen.Sending(goal), waitStartedAt = attempt.submittedAt, attemptId = attempt.attemptId) }
        viewModelScope.launch {
            val outcome = store.sendGoal(goal, language, sourceIds, materialIntent)
            isSending = false
            when (outcome) {
                is WriteOutcome.Done -> {
                    analytics.track(
                        AnalyticsEvent.OnboardingProgressed(
                            "attempt_linked",
                            onboardingId = outcome.value.id.toString(),
                            attemptId = attempt.attemptId,
                        ),
                    )
                    showDraft(outcome.value)
                }

                WriteOutcome.Obsolete -> {
                    showEntry(words)
                }

                else -> {
                    val missing = ((outcome as? WriteOutcome.Refused)?.refusal as? Refusal.MaterialUnavailable)?.sourceIds
                    showEntry(words, outcome.startError().takeIf { missing == null })
                    gone = missing.orEmpty().toSet()
                }
            }
        }
    }

    fun backToEntry(words: String) = showEntry(words)

    fun editDraft(draft: OnboardingDraft) {
        restoreDraftMaterial(draft)
        showEntry(draft.prompt)
    }

    /**
     * Another learner, or none, sees nothing of this one's words, material or answers. A guest who
     * signs in keeps them: their draft moves to the account, which reads it with its own room.
     */
    fun followSession(
        key: String?,
        hasAccount: Boolean,
    ) {
        val previous = sessionKey
        val upgradesGuest = previous != null && !sessionHasAccount && key != null && hasAccount
        sessionKey = key
        sessionHasAccount = hasAccount
        if (previous == null || previous == key) return
        if (upgradesGuest) {
            entryError = null
            creationFailure.clear()
            draftLimit = null
            waitlist = null
            return
        }
        turns = emptyList()
        isAttachOpen = false
        update { it.copy(attached = emptyList(), intent = null) }
        showEntry("")
    }

    fun edit(field: String?) {
        editing = field
        editFailure.clear()
    }

    /** Follows the draft the screen shows while it's read; a draft read before needs nothing. */
    fun follow(draft: OnboardingDraft) {
        val id = draft.generationId.takeIf { draft.status == OnboardingDraft.Status.UNDERSTANDING }
        if (id == followed) return
        followed = id
        if (id != null) follower.follow(id) else follower.stop()
    }

    /** A read that failed or never started waits for this tap, since starting it is new work. */
    fun retryRead() {
        val id = draftId ?: return
        if (isRetrying) return
        startWaitAgain()
        isRetrying = true
        viewModelScope.launch {
            when (val outcome = store.readAgain(id)) {
                is WriteOutcome.Done -> {
                    readFailed = false
                }

                is WriteOutcome.Refused -> {
                    draftLimit = outcome.startError().takeIf { it !is GoalError.OneMoment && it !is GoalError.CouldNotRead }
                }

                else -> {}
            }
            isRetrying = false
        }
    }

    /** A run started again is a new wait; one whose connection dropped goes on from its bar. */
    fun retryRun() {
        if (follower.run.value.failure != GenerationFailure.Connection) startWaitAgain()
        follower.retry()
    }

    fun reloadRead() {
        viewModelScope.launch { loadRead() }
    }

    /** Reads the card's draft again after that read failed, so the card can offer its create again. */
    fun readDraftAgain() {
        val id = draftId ?: return
        viewModelScope.launch { store.drafts[id].refresh() }
    }

    /** A fact that couldn't be saved keeps its editor open. */
    fun revise(
        field: String,
        edit: OnboardingDraftEdit,
    ) {
        val id = draftId ?: return
        if (savingEdit != null) return
        savingEdit = field
        editFailure.clear()
        val started = visit.number
        viewModelScope.launch {
            when (store.revise(id, edit)) {
                is WriteOutcome.Done -> {
                    if (editing == field) editing = null
                }

                WriteOutcome.Obsolete -> {}

                else -> {
                    editFailure.send(started, field)
                }
            }
            savingEdit = null
        }
    }

    fun rewrite(
        draft: OnboardingDraft,
        words: String,
        language: String,
    ) {
        restoreDraftMaterial(draft)
        send(words, language)
    }

    private fun restoreDraftMaterial(draft: OnboardingDraft) {
        val intent =
            when (draft.materialIntent) {
                OnboardingDraft.MaterialIntent.EXAM -> MaterialIntent.Exam
                OnboardingDraft.MaterialIntent.UNDERSTAND -> MaterialIntent.Understand
                null -> null
            }
        update {
            it.copy(
                attached =
                    draft.sources.map { source ->
                        AttachedSource(source.id.toString(), source.title, source.readStatus)
                    },
                intent = intent,
            )
        }
    }

    fun confirm(input: GoalCreateInput) = create(input, GoalOpens.Setup)

    fun joinWaitlist(
        instrument: String,
        language: String,
    ) {
        if (isJoining) return
        isJoining = true
        creationFailure.clear()
        viewModelScope.launch {
            waitlist =
                when (val outcome = store.joinWaitlist(instrument, language)) {
                    is WriteOutcome.Done -> {
                        WaitlistOutcome.Joined
                    }

                    is WriteOutcome.Refused -> {
                        WaitlistOutcome.SignInRequired.takeIf { outcome.refusal == Refusal.SignUpRequired }
                            ?: WaitlistOutcome.Failed
                    }

                    WriteOutcome.Failed -> {
                        WaitlistOutcome.Failed
                    }

                    WriteOutcome.Obsolete -> {
                        null
                    }
                }
            isJoining = false
        }
    }

    /**
     * A goal this process sent from a tap that turns out to be a question opens its explanation at
     * once; coming back to it later waits for "Explain it".
     */
    fun settle(
        draft: OnboardingDraft,
        explanation: (OnboardingDraft, String) -> GoalCreateInput,
    ) {
        val id = draft.id.toString()
        val read = (draft.understanding as? GoalUnderstanding.GoalUnderstandingOneOf1Value)?.value
        if (draft.status != OnboardingDraft.Status.UNDERSTOOD || !store.wasSentHere(id)) return
        store.forgetSent(id)
        if (read != null) create(explanation(draft, read.question), GoalOpens.Explanation)
    }

    /** A refusal for the goals the plan follows lasts until a draft read after it has room again. */
    fun readRoom(activeGoalsLeft: Long?) {
        if (activeGoalsLeft != 0L && (creationError as? GoalError.Limit)?.reason == GoalLimitReason.ActiveGoals) creationFailure.clear()
    }

    fun isOpeningExplanation(draft: OnboardingDraft) = isCreating || store.wasSentHere(draft.id.toString())

    /** A card creates only from a draft read since its last create whose outcome this device didn't learn. */
    fun create(
        input: GoalCreateInput,
        opens: GoalOpens,
    ) {
        if (isCreating || draftId?.let { store.drafts[it].freshState.value !is LoadState.Loaded } == true) return
        isCreating = true
        creationFailure.clear()
        if (waitlist != WaitlistOutcome.Joined) waitlist = null
        val asked = visit.number
        viewModelScope.launch {
            when (val outcome = store.createGoals(input, planId, draftId)) {
                is WriteOutcome.Done -> {
                    created.send(asked, CreatedGoal(outcome.value, opens))
                }

                is WriteOutcome.Refused -> {
                    val reason = outcome.refusal.goalLimitReason()
                    creationFailure.send(asked, GoalError.Limit(reason))
                    // The draft's room was read before this refusal; read it again so the card counts the goals followed now.
                    if (reason == GoalLimitReason.ActiveGoals) draftId?.let { store.drafts[it].refresh() }
                }

                WriteOutcome.Failed -> {
                    creationFailure.send(asked, GoalError.CouldNotSave)
                }

                WriteOutcome.Obsolete -> {}
            }
            isCreating = false
        }
    }

    private val draftId get() = (flow.screen as? StartScreen.Draft)?.id

    private suspend fun restartRead(): String? {
        val id = draftId ?: return null
        return when (val outcome = store.readAgain(id)) {
            is WriteOutcome.Done -> {
                val draft = outcome.value
                when (draft.status) {
                    OnboardingDraft.Status.UNDERSTOOD -> null
                    else -> (draft.generationId ?: error("The read couldn't start again")).also { followed = it }
                }
            }

            is WriteOutcome.Refused -> {
                draftLimit = outcome.startError()
                error("The read hit a limit")
            }

            else -> {
                error("The read couldn't start again")
            }
        }
    }

    private suspend fun loadRead() {
        val id = draftId ?: return
        val draft = store.drafts[id]
        draft.refresh()
        readFailed = draft.state
            .first()
            .value
            ?.status != OnboardingDraft.Status.UNDERSTOOD
    }

    private fun showDraft(draft: OnboardingDraft) {
        readFailed = false
        draftLimit = null
        waitlist = null
        editing = null
        update { it.copy(screen = StartScreen.Draft(draft.id.toString())) }
    }

    private fun showEntry(
        words: String,
        error: GoalError? = null,
    ) {
        draftId?.let(store::forgetSent)
        follower.stop()
        followed = null
        readFailed = false
        draftLimit = null
        waitlist = null
        editing = null
        creationFailure.clear()
        entryError = error
        stopWaiting()
        gone = emptySet()
        this.words.setTextAndPlaceCursorAtEnd(words)
        update { it.copy(screen = StartScreen.Entry) }
    }

    /** Leaving the questions or the screen stops what still waits: nothing is answered or sent for no one. */
    private fun stopWaiting() {
        heldGoal = null
        askJob?.cancel()
        asking = null
    }

    /** Leaving the draft takes back what the tap that sent it allowed, so a later visit only reads it. */
    override fun onCleared() {
        draftId?.let(store::forgetSent)
    }

    private fun startWaitAgain() = update { it.copy(waitStartedAt = System.currentTimeMillis()) }

    private fun update(transform: (StartFlowState) -> StartFlowState) {
        flow = transform(flow)
        saved = flow
    }
}

/** Core's `MAX_GOAL_SOURCES`: a goal is sent with this many at most. */
private const val MAX_GOAL_SOURCES = 5
