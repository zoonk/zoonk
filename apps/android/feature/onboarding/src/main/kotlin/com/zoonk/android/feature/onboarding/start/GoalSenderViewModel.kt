package com.zoonk.android.feature.onboarding.start

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.zoonk.android.data.AnalyticsEvent
import com.zoonk.android.data.EventTracker
import com.zoonk.android.data.Visit
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
    /** This visit to the goal box: the draft it sent opens, or its failure shows, only on it. */
    val visit = Visit()

    /** The draft the words were saved as, for the start screen to open. */
    val sent = visit.outcome<String>()

    private val failure = visit.outcome<GoalError>()

    var attemptId by mutableStateOf<String?>(null)
        private set

    var isSending by mutableStateOf(false)
        private set

    val error get() = failure.value

    fun send(
        goal: String,
        language: String,
    ) {
        if (isSending) return
        isSending = true
        val attempt = AnalyticsEvent.GoalTyped(hasAttachment = false)
        attemptId = attempt.attemptId
        analytics.track(attempt)
        failure.clear()
        val started = visit.number
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
                    sent.send(started, outcome.value.id.toString())
                }

                WriteOutcome.Obsolete -> {}

                else -> {
                    failure.send(started, outcome.startError())
                }
            }
            isSending = false
        }
    }
}
