package com.zoonk.android.feature.onboarding.start

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
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
) : ViewModel() {
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
        error = null
        viewModelScope.launch {
            when (val outcome = store.sendGoal(goal, language)) {
                is WriteOutcome.Done -> onSent(outcome.value.id.toString())
                WriteOutcome.Obsolete -> Unit
                else -> error = outcome.startError()
            }
            isSending = false
        }
    }
}
