package com.zoonk.android.feature.onboarding.start

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.zoonk.android.data.AnalyticsEvent
import com.zoonk.android.data.EventTracker
import com.zoonk.android.feature.onboarding.GoalError
import com.zoonk.android.feature.onboarding.OnboardingStore
import com.zoonk.android.feature.onboarding.WriteOutcome
import com.zoonk.android.feature.onboarding.startError
import kotlinx.coroutines.launch

/**
 * For a goal box outside the start screen: the learner's tap sends the words, and the saved draft
 * opens the start screen, which only reads it.
 */
class GoalSenderViewModel(
    private val store: OnboardingStore,
    private val analytics: EventTracker = EventTracker {},
) : ViewModel() {
    var attemptId by mutableStateOf<String?>(null)
        private set

    var isSending by mutableStateOf(false)
        private set

    var error by mutableStateOf<GoalError?>(null)
        private set

    fun send(
        goal: String,
        language: String,
        onSent: (draftId: String) -> Unit,
    ) {
        if (isSending) return
        isSending = true
        val attempt = AnalyticsEvent.GoalTyped(hasAttachment = false)
        attemptId = attempt.attemptId
        analytics.track(attempt)
        error = null
        viewModelScope.launch {
            when (val outcome = store.sendGoal(goal, language)) {
                is WriteOutcome.Done -> {
                    analytics.track(
                        AnalyticsEvent.OnboardingProgressed(
                            "attempt_linked",
                            onboardingId = outcome.value.id.toString(),
                            attemptId = attempt.attemptId,
                        ),
                    )
                    onSent(outcome.value.id.toString())
                }

                WriteOutcome.Obsolete -> {}

                else -> {
                    error = outcome.startError()
                }
            }
            isSending = false
        }
    }
}
