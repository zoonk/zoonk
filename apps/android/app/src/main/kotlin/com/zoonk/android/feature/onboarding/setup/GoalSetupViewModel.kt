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
import com.zoonk.android.feature.onboarding.WriteOutcome
import com.zoonk.api.models.Onboarding
import com.zoonk.api.models.OnboardingAnswerInput
import com.zoonk.api.models.OnboardingStep
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

@Serializable
data class SetupFlow(
    val goalId: String,
    val current: OnboardingStep? = null,
    val history: List<OnboardingStep> = emptyList(),
)

/** Each answer is a POST from the learner's tap; its reply is the goal's whole new setup. */
internal class GoalSetupViewModel(
    private val store: OnboardingStore,
    private val drafts: SetupDrafts?,
    handle: SavedStateHandle,
    goalId: String,
) : ViewModel() {
    private var saved by handle.saved { SetupFlow(goalId) }

    var flow by mutableStateOf(saved)
        private set

    var isSaving by mutableStateOf(false)
        private set

    var saveFailed by mutableStateOf(false)
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
    ) {
        val step = from ?: return
        if (isSaving) return
        isSaving = true
        saveFailed = false
        val answeredGoal = goalId
        viewModelScope.launch {
            when (val outcome = store.answer(goalId, input)) {
                is WriteOutcome.Done -> {
                    drafts?.words(answeredGoal, step.value)?.remove()
                    applyAnswer(step, outcome.value)
                }

                WriteOutcome.Obsolete -> {}

                else -> {
                    saveFailed = true
                }
            }
            isSaving = false
        }
    }

    fun back() {
        val previous = flow.history.lastOrNull() ?: return
        update(flow.copy(current = previous, history = flow.history.dropLast(1)))
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
        update(
            if (flow.current == step) {
                SetupFlow(goalId, view.steps.firstOrNull { it != step } ?: OnboardingStep.PLAN, flow.history + step)
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

    private fun update(next: SetupFlow) {
        flow = next
        saved = next
    }
}

internal fun answeredScreens(view: Onboarding): List<OnboardingStep> =
    (view.goal.details["answered"] as? JsonArray)
        .orEmpty()
        .mapNotNull { answer -> OnboardingStep.entries.find { it.value == (answer as? JsonPrimitive)?.contentOrNull } }
        .filter { it in QUESTION_SCREENS }
