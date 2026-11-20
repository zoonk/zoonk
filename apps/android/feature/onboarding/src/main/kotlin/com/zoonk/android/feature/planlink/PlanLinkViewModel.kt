package com.zoonk.android.feature.planlink

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.serialization.saved
import androidx.lifecycle.viewModelScope
import com.zoonk.android.data.Visit
import com.zoonk.android.feature.onboarding.OnboardingStore
import com.zoonk.android.feature.onboarding.Refusal
import com.zoonk.android.feature.onboarding.WriteOutcome
import kotlinx.coroutines.launch

internal enum class StartFailure { Refused, Failed }

/** Opening a shared plan only reads it; the learner's Start makes their own goal from it. */
internal class PlanLinkViewModel(
    private val store: OnboardingStore,
    handle: SavedStateHandle,
) : ViewModel() {
    /** This visit to the shared plan: the goal it started opens, or its failure shows, only on it. */
    val visit = Visit()

    /** The learner's own goal from the plan started: their Plan opens. */
    val started = visit.outcome<Unit>()

    private val startFailure = visit.outcome<StartFailure>()

    private var savedMinutes by handle.saved { DEFAULT_MINUTES }

    var minutes by mutableStateOf(savedMinutes)
        private set

    var isStarting by mutableStateOf(false)
        private set

    val failure get() = startFailure.value

    fun pick(next: Int) {
        minutes = next
        savedMinutes = next
    }

    fun start(planId: String) {
        if (isStarting) return
        isStarting = true
        startFailure.clear()
        val asked = visit.number
        viewModelScope.launch {
            when (val outcome = store.startFromPlanLink(planId, minutes)) {
                is WriteOutcome.Done -> {
                    started.send(asked, Unit)
                }

                is WriteOutcome.Refused -> {
                    startFailure.send(asked, if (outcome.refusal.isGoalCap()) StartFailure.Refused else StartFailure.Failed)
                }

                WriteOutcome.Failed -> {
                    startFailure.send(asked, StartFailure.Failed)
                }

                WriteOutcome.Obsolete -> {}
            }
            isStarting = false
        }
    }
}

/** Only a goal cap is "can't start another goal"; a busy moment just asks to try again. */
private fun Refusal.isGoalCap() = this is Refusal.Limit || this == Refusal.SignUpRequired

private const val DEFAULT_MINUTES = 30
