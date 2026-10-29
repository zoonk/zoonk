package com.zoonk.android.feature.onboarding.start

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.serialization.saved
import androidx.lifecycle.viewModelScope
import com.zoonk.android.data.GenerationFollower
import com.zoonk.android.data.GenerationKind
import com.zoonk.android.data.GenerationRun
import com.zoonk.android.data.value
import com.zoonk.android.feature.onboarding.AttachedSource
import com.zoonk.android.feature.onboarding.GoalError
import com.zoonk.android.feature.onboarding.OnboardingStore
import com.zoonk.android.feature.onboarding.PickedFile
import com.zoonk.android.feature.onboarding.Refusal
import com.zoonk.android.feature.onboarding.WriteOutcome
import com.zoonk.android.feature.onboarding.goalLimitReason
import com.zoonk.android.feature.onboarding.startError
import com.zoonk.api.models.GoalCreateInput
import com.zoonk.api.models.GoalUnderstanding
import com.zoonk.api.models.OnboardingDraft
import com.zoonk.api.models.OnboardingDraftEdit
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import kotlinx.serialization.Serializable

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
    val words: String = "",
    val attached: List<AttachedSource> = emptyList(),
    val intent: MaterialIntent? = null,
)

enum class WaitlistOutcome { Joined, SignInRequired, Failed }

/** Reading words, reading them again and creating goals are POSTs from the learner's taps; opening a draft only reads it. */
class StartGoalViewModel(
    private val store: OnboardingStore,
    handle: SavedStateHandle,
    goal: String?,
    draftId: String?,
    private val planId: String?,
) : ViewModel() {
    private var saved by handle.saved {
        StartFlowState(
            screen = draftId?.let(StartScreen::Draft) ?: StartScreen.Entry,
            words = goal.orEmpty(),
        )
    }

    var flow by mutableStateOf(
        saved.let {
            if (it.screen is StartScreen.Sending) it.copy(screen = StartScreen.Entry, words = it.screen.goal) else it
        },
    )
        private set

    var entryError by mutableStateOf<GoalError?>(null)
        private set

    /** A draft whose read hit a limit when started again. */
    var draftLimit by mutableStateOf<GoalError?>(null)
        private set

    /** The read finished, but reading its result didn't. */
    var readFailed by mutableStateOf(false)
        private set

    var isCreating by mutableStateOf(false)
        private set

    var creationError by mutableStateOf<GoalError?>(null)
        private set

    var waitlist by mutableStateOf<WaitlistOutcome?>(null)
        private set

    var isJoining by mutableStateOf(false)
        private set

    var isAttachOpen by mutableStateOf(false)
        private set

    var isAttaching by mutableStateOf(false)
        private set

    /** The last attach attempt that didn't add anything. */
    var attachFailure by mutableStateOf<WriteOutcome<*>?>(null)
        private set

    var turns by mutableStateOf(emptyList<MaterialTurn>())
        private set

    var isAsking by mutableStateOf(false)
        private set

    var isRetrying by mutableStateOf(false)
        private set

    /** The fact being fixed in place, its save on its way, and the last one that didn't save. */
    var editing by mutableStateOf<String?>(null)
        private set

    var savingEdit by mutableStateOf<String?>(null)
        private set

    var failedEdit by mutableStateOf<String?>(null)
        private set

    private var isSending = false

    /** The session this flow's words, material and answers belong to. */
    private var sessionKey: String? = null

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

    fun setWords(words: String) = update { it.copy(words = words) }

    fun setAttached(attached: List<AttachedSource>) = update { it.copy(attached = attached) }

    fun setIntent(intent: MaterialIntent) = update { it.copy(intent = intent) }

    fun toggleAttach() {
        isAttachOpen = !isAttachOpen
        attachFailure = null
    }

    fun removeAttached(id: String) = update { it.copy(attached = it.attached.filterNot { source -> source.id == id }) }

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

    fun ask(
        question: String,
        language: String,
    ) {
        if (isAsking || question.isBlank()) return
        isAsking = true
        viewModelScope.launch {
            val outcome = store.askMaterial(question, flow.attached.map { it.id }, language)
            if (outcome != WriteOutcome.Obsolete) turns = turns + MaterialTurn(question, outcome)
            isAsking = false
        }
    }

    private fun attach(add: suspend () -> WriteOutcome<AttachedSource>) {
        if (isAttaching) return
        isAttaching = true
        attachFailure = null
        viewModelScope.launch {
            when (val outcome = add()) {
                is WriteOutcome.Done -> {
                    isAttachOpen = false
                    update { it.copy(attached = it.attached.filterNot { source -> source.id == outcome.value.id } + outcome.value) }
                }

                WriteOutcome.Obsolete -> {}

                else -> {
                    attachFailure = outcome
                }
            }
            isAttaching = false
        }
    }

    /** Questions about material stay here; anything else is read. */
    fun submit(
        typed: String,
        materialGoal: String,
        language: String,
    ) {
        val withMaterial = if (flow.attached.isNotEmpty()) flow.intent else null
        if (withMaterial == MaterialIntent.Questions) {
            update { it.copy(screen = StartScreen.Questions) }
            return
        }
        send(typed.ifBlank { materialGoal }, language)
    }

    /** One goal on its way at a time. */
    fun send(
        goal: String,
        language: String,
    ) {
        if (isSending) return
        isSending = true
        draftId?.let(store::forgetSent)
        entryError = null
        update { it.copy(screen = StartScreen.Sending(goal)) }
        viewModelScope.launch {
            val outcome = store.sendGoal(goal, language)
            isSending = false
            when (outcome) {
                is WriteOutcome.Done -> showDraft(outcome.value)
                WriteOutcome.Obsolete -> showEntry(goal)
                else -> showEntry(goal, outcome.startError())
            }
        }
    }

    fun backToEntry(words: String) = showEntry(words)

    /** Another learner, or none, sees nothing of this one's words, material or answers. */
    fun followSession(key: String?) {
        val previous = sessionKey
        sessionKey = key
        if (previous == null || previous == key) return
        turns = emptyList()
        isAttachOpen = false
        update { it.copy(attached = emptyList(), intent = null) }
        showEntry("")
    }

    fun edit(field: String?) {
        editing = field
        failedEdit = null
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

    fun reloadRead() {
        viewModelScope.launch { loadRead() }
    }

    /** A fact that couldn't be saved keeps its editor open. */
    fun revise(
        field: String,
        edit: OnboardingDraftEdit,
    ) {
        val id = draftId ?: return
        if (savingEdit != null) return
        savingEdit = field
        failedEdit = null
        viewModelScope.launch {
            when (store.revise(id, edit)) {
                is WriteOutcome.Done -> {
                    if (editing == field) editing = null
                }

                WriteOutcome.Obsolete -> {}

                else -> {
                    failedEdit = field
                }
            }
            savingEdit = null
        }
    }

    fun rewrite(
        words: String,
        language: String,
    ) = send(words, language)

    fun confirm(
        input: GoalCreateInput,
        onCreated: (String) -> Unit,
    ) = create(input, onCreated)

    fun joinWaitlist(
        instrument: String,
        language: String,
    ) {
        if (isJoining) return
        isJoining = true
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
        onCreated: (String) -> Unit,
    ) {
        val id = draft.id.toString()
        val read = (draft.understanding as? GoalUnderstanding.GoalUnderstandingOneOf1Value)?.value
        if (draft.status != OnboardingDraft.Status.UNDERSTOOD || !store.wasSentHere(id)) return
        store.forgetSent(id)
        if (read != null) create(explanation(draft, read.question), onCreated)
    }

    fun isOpeningExplanation(draft: OnboardingDraft) = isCreating || store.wasSentHere(draft.id.toString())

    fun create(
        input: GoalCreateInput,
        onCreated: (String) -> Unit,
    ) {
        if (isCreating) return
        isCreating = true
        creationError = null
        viewModelScope.launch {
            when (val outcome = store.createGoals(input, planId)) {
                is WriteOutcome.Done -> {
                    onCreated(outcome.value)
                }

                is WriteOutcome.Refused -> {
                    creationError = GoalError.Limit(outcome.refusal.goalLimitReason())
                }

                WriteOutcome.Failed -> {
                    creationError = GoalError.CouldNotSave
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
        creationError = null
        entryError = error
        update { it.copy(screen = StartScreen.Entry, words = words) }
    }

    /** Leaving the draft takes back what the tap that sent it allowed, so a later visit only reads it. */
    override fun onCleared() {
        draftId?.let(store::forgetSent)
    }

    private fun update(transform: (StartFlowState) -> StartFlowState) {
        flow = transform(flow)
        saved = flow
    }
}
