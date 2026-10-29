package com.zoonk.android.feature.planlink

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.serialization.saved
import androidx.lifecycle.viewModelScope
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
    private var savedMinutes by handle.saved { DEFAULT_MINUTES }

    var minutes by mutableStateOf(savedMinutes)
        private set

    var isStarting by mutableStateOf(false)
        private set

    var failure by mutableStateOf<StartFailure?>(null)
        private set

    fun pick(next: Int) {
        minutes = next
        savedMinutes = next
    }

    fun start(
        planId: String,
        onStarted: () -> Unit,
    ) {
        if (isStarting) return
        isStarting = true
        failure = null
        viewModelScope.launch {
            when (val outcome = store.startFromPlanLink(planId, minutes)) {
                is WriteOutcome.Done -> {
                    onStarted()
                }

                is WriteOutcome.Refused -> {
                    failure = if (outcome.refusal.isGoalCap()) StartFailure.Refused else StartFailure.Failed
                }

                WriteOutcome.Failed -> {
                    failure = StartFailure.Failed
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
