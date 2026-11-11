package com.zoonk.android.feature.onboarding.setup

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.serialization.saved
import androidx.lifecycle.viewModelScope
import com.zoonk.android.data.GenerationFollower
import com.zoonk.android.data.GenerationKind
import com.zoonk.android.data.LoadState
import com.zoonk.android.feature.onboarding.OnboardingStore
import com.zoonk.android.feature.onboarding.Refusal
import com.zoonk.android.feature.onboarding.WriteOutcome
import com.zoonk.android.feature.profile.ProfileDraft
import com.zoonk.android.feature.profile.profileQuestion
import com.zoonk.android.feature.profile.profileSkipAll
import com.zoonk.android.feature.profile.suggestedSupports
import com.zoonk.api.models.Onboarding
import com.zoonk.api.models.OnboardingAnswerInput
import com.zoonk.api.models.OnboardingStep
import com.zoonk.api.models.ProfileQuestion
import com.zoonk.api.models.ProfileQuestionView
import kotlinx.coroutines.Deferred
import kotlinx.coroutines.async
import kotlinx.coroutines.launch
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.contentOrNull

/** The screens one per question, before placement and the plan, that the dots count. */
internal val QUESTION_SCREENS =
    setOf(
        OnboardingStep.PURPOSE,
        OnboardingStep.ROLE,
        OnboardingStep.REASON,
        OnboardingStep.TARGET,
        OnboardingStep.TARGET_DATE,
        OnboardingStep.FOLLOW_UPS,
        OnboardingStep.EXAM_CHOICE,
        OnboardingStep.LEVEL,
        OnboardingStep.SCHEDULE,
        OnboardingStep.BUDDY,
        OnboardingStep.PLACEMENT,
    )

internal data class SetupProgress(
    val answered: Int,
    val total: Int,
)

/**
 * Placement is optional and the plan isn't a question, so neither counts, and placement shows no dots.
 * Each question counts once, where the learner meets it: an earlier one opened again from a later
 * screen keeps its place, and the screen it was opened from is still ahead.
 */
internal fun setupProgress(
    flow: SetupFlow,
    steps: List<OnboardingStep>,
): SetupProgress? {
    val current = flow.current?.takeIf(::countsAsQuestion) ?: return null
    val ahead = steps.filter(::countsAsQuestion)
    val behind = flow.history.filter { countsAsQuestion(it) && (it == current || it !in ahead) }
    val order = (behind + current + ahead).map { if (it.profileQuestion != null) OnboardingStep.WORK else it }.distinct()
    return SetupProgress(order.indexOf(if (current.profileQuestion != null) OnboardingStep.WORK else current), order.size)
}

private fun countsAsQuestion(step: OnboardingStep) =
    (step in QUESTION_SCREENS || step.profileQuestion != null) && step != OnboardingStep.PLACEMENT

@Serializable
data class SetupFlow(
    val goalId: String,
    val current: OnboardingStep? = null,
    val history: List<OnboardingStep> = emptyList(),
)

internal fun SetupFlow.goingBack(): SetupFlow? {
    val index = history.lastIndex
    return if (index < 0) null else copy(current = history[index], history = history.take(index))
}

/** [step] opens from the screen shown, which its Back returns to. */
internal fun SetupFlow.opening(step: OnboardingStep): SetupFlow = current?.let { copy(current = step, history = history + it) } ?: this

/**
 * After [answered] saves, [next] shows. Arriving at a screen already behind the learner cuts the
 * history back to before it, so a screen opened from it and answered adds nothing to Back.
 */
internal fun SetupFlow.arriving(
    goalId: String,
    answered: OnboardingStep,
    next: OnboardingStep,
): SetupFlow {
    if (goalId != this.goalId) return SetupFlow(goalId, next)
    val trail = history + answered
    val seen = trail.indexOf(next)
    return SetupFlow(goalId, next, if (seen < 0) trail else trail.take(seen))
}

/** Each answer is a POST from the learner's tap; its reply is the goal's whole new setup. */
internal class GoalSetupViewModel(
    private val store: OnboardingStore,
    private val drafts: SetupDrafts?,
    private val handle: SavedStateHandle,
    goalId: String,
    revealMoment: Boolean = false,
) : ViewModel() {
    private var saved by handle.saved { SetupFlow(goalId) }
    private var savedProfiles by handle.saved { emptyMap<ProfileQuestion, ProfileDraft>() }
    private var profileDrafts by mutableStateOf(savedProfiles)
    var supportsSuggested by mutableStateOf(false)
        private set

    fun profileDraft(
        question: ProfileQuestionView,
        role: String?,
    ): ProfileDraft = profileDrafts[question.id] ?: ProfileDraft.from(question, role)

    fun changeProfile(
        question: ProfileQuestion,
        draft: ProfileDraft,
    ) {
        profileDrafts = profileDrafts + (question to draft)
        savedProfiles = profileDrafts - ProfileQuestion.CONDITIONS
    }

    init {
        if (!handle.contains("revealMoment")) handle["revealMoment"] = revealMoment
    }

    fun takeRevealMoment(): Boolean = (handle.get<Boolean>("revealMoment") == true).also { handle["revealMoment"] = false }

    fun changeAim(
        plans: com.zoonk.android.feature.plan.PlanStore,
        aim: String,
        onSaved: () -> Unit,
    ) {
        if (isSaving) return
        isSaving = true
        clearFailure()
        viewModelScope.launch {
            when (
                val result =
                    plans.change(
                        java.util.UUID.fromString(goalId),
                        listOf(
                            com.zoonk.android.feature.plan.PlanOp
                                .Aim(aim),
                        ),
                    )
            ) {
                is com.zoonk.android.data.MutationResult.Done -> {
                    if (result.value.status == com.zoonk.api.models.PlanChangeResult.Status.APPLIED) {
                        store.onboardings[goalId].refresh()
                        onSaved()
                    } else {
                        saveFailed = true
                    }
                }

                com.zoonk.android.data.MutationResult.Obsolete -> {}

                else -> {
                    saveFailed = true
                }
            }
            isSaving = false
        }
    }

    fun reveal(onSaved: () -> Unit) {
        if (isSaving) return
        isSaving = true
        clearFailure()
        viewModelScope.launch {
            when (store.markPlanRevealed(goalId)) {
                is WriteOutcome.Done -> onSaved()
                WriteOutcome.Obsolete -> Unit
                else -> saveFailed = true
            }
            isSaving = false
        }
    }

    var flow by mutableStateOf(saved)
        private set

    var isSaving by mutableStateOf(false)
        private set

    var saveFailed by mutableStateOf(false)
        private set

    var dayTooShort by mutableStateOf<Refusal.DayTooShort?>(null)
        private set

    var isStartingOver by mutableStateOf(false)
        private set

    /** How far a placement test is while it asks, which takes the step dots' place and Back's. */
    var placementProgress by mutableStateOf<Float?>(null)

    val goalId: String get() = flow.goalId

    val follower =
        GenerationFollower(
            kind = GenerationKind.Placement,
            scope = viewModelScope,
            source = store.generations,
            readGenerationId = {
                store.generationRuns[this.goalId].run {
                    refresh()
                    (state.value as? LoadState.Loaded)?.value?.generationId
                }
            },
            restart = { (store.writeGoal(this.goalId) as? WriteOutcome.Done)?.value ?: error("The plan couldn't start again") },
        )

    private var followed = false

    fun begin(view: Onboarding) {
        if (!followed) {
            followed = true
            follower.follow(view.generationId)
        }
        if (flow.current != null) return
        update(flow.copy(current = view.steps.firstOrNull() ?: OnboardingStep.PLAN, history = answeredScreens(view)))
    }

    /**
     * One answer saves at a time, so a pick and a Continue never save twice. [from] is the screen the
     * answer belongs to: a placement that finishes after Back still answers placement.
     */
    fun answer(
        input: OnboardingAnswerInput,
        from: OnboardingStep? = flow.current,
        showFailure: Boolean = true,
        profileAnswer: ProfileDraft? = null,
    ): Deferred<WriteOutcome<Onboarding>>? {
        val step = from ?: return null
        if (isSaving) return null
        isSaving = true
        clearFailure()
        val answeredGoal = goalId
        return viewModelScope.async {
            val outcome = store.answer(answeredGoal, input)
            when (outcome) {
                is WriteOutcome.Done -> {
                    drafts?.words(answeredGoal, step.value)?.remove()
                    step.profileQuestion?.takeIf { profileAnswer == null }?.let {
                        // Skipping conditions takes back the supports their picks prechecked.
                        val unchecks = it == ProfileQuestion.CONDITIONS && supportsSuggested
                        profileDrafts = profileDrafts - it - if (unchecks) setOf(ProfileQuestion.LEARNING_SUPPORT) else emptySet()
                        savedProfiles = profileDrafts - ProfileQuestion.CONDITIONS
                        if (unchecks) supportsSuggested = false
                    }
                    if (step == OnboardingStep.CONDITIONS && profileAnswer != null && flow.current == step &&
                        outcome.value.steps.firstOrNull() == OnboardingStep.LEARNING_SUPPORT
                    ) {
                        val picks = profileAnswer.picks
                        val suggestions = suggestedSupports(picks)
                        val support =
                            outcome.value.profile.questions
                                .first { it.id == ProfileQuestion.LEARNING_SUPPORT }
                        val previous = profileDrafts[ProfileQuestion.LEARNING_SUPPORT] ?: ProfileDraft.from(support)
                        if (suggestions.isNotEmpty() && ProfileQuestion.LEARNING_SUPPORT !in profileDrafts) {
                            changeProfile(
                                ProfileQuestion.LEARNING_SUPPORT,
                                previous.copy(picks = (previous.picks + suggestions).distinct(), declined = false),
                            )
                            supportsSuggested = true
                        }
                    }
                    applyAnswer(step, outcome.value)
                }

                WriteOutcome.Obsolete -> {}

                else -> {
                    // Only the screen that saved shows its failure: the learner may have gone Back while it saved.
                    if (showFailure && flow.current == step) {
                        saveFailed = true
                        dayTooShort = (outcome as? WriteOutcome.Refused)?.refusal as? Refusal.DayTooShort
                    }
                }
            }
            isSaving = false
            outcome
        }
    }

    fun back() {
        val previous = flow.goingBack() ?: return
        clearFailure()
        update(previous)
    }

    fun skipProfiles(forever: Boolean) {
        val saving = answer(profileSkipAll(forever)) ?: return
        viewModelScope.launch {
            if (saving.await() is WriteOutcome.Done) {
                profileDrafts = emptyMap()
                savedProfiles = emptyMap()
                supportsSuggested = false
            }
        }
    }

    /** The time question's link to the date question: its Back returns to the time unchanged. */
    fun changeDate() {
        if (isSaving) return
        clearFailure()
        update(flow.opening(OnboardingStep.TARGET_DATE))
    }

    fun startOver(
        goalIds: List<String>,
        onDone: () -> Unit,
    ) {
        if (isStartingOver) return
        isStartingOver = true
        viewModelScope.launch {
            if (store.startOver(goalIds) is WriteOutcome.Done) onDone() else saveFailed = true
            isStartingOver = false
        }
    }

    /** A reply for a screen no longer shown (the learner went Back while it saved) keeps them where they are. */
    private fun applyAnswer(
        step: OnboardingStep,
        view: Onboarding,
    ) {
        val goalId = view.goal.id.toString()
        val movedGoal = goalId != flow.goalId
        if (step == OnboardingStep.SCHEDULE && flow.current == step) handle["revealMoment"] = true
        update(
            if (flow.current == step) {
                flow.arriving(goalId, step, view.steps.firstOrNull { it != step } ?: OnboardingStep.PLAN)
            } else {
                flow.copy(goalId = goalId)
            },
        )
        // "Pass an exam" moved a language goal to an exam goal, whose curriculum starts now.
        if (movedGoal) {
            followed = true
            follower.follow(view.generationId)
        }
    }

    fun reload() {
        viewModelScope.launch { store.onboardings[goalId].refresh() }
    }

    private fun clearFailure() {
        saveFailed = false
        dayTooShort = null
    }

    private fun update(next: SetupFlow) {
        flow = next
        saved = next
    }
}

internal fun answeredScreens(view: Onboarding): List<OnboardingStep> =
    (view.goal.details["answered"] as? JsonArray)
        .orEmpty()
        .mapNotNull { answer -> OnboardingStep.entries.find { it.value == (answer as? JsonPrimitive)?.contentOrNull } }
        .filter { it in QUESTION_SCREENS || it.profileQuestion != null }
