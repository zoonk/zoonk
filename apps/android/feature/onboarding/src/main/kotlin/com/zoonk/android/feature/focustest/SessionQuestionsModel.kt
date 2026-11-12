package com.zoonk.android.feature.focustest

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.zoonk.android.data.MutationResult
import com.zoonk.api.models.FocusTestControlsInput
import com.zoonk.api.models.FocusTestSessionQuestions
import kotlinx.coroutines.launch
import java.util.UUID

/** "Ask a few more in my sessions": the test's questions inside the first week's sessions, switched from its result. */
internal class SessionQuestionsModel(
    private val store: FocusTestStore,
    private val goalId: UUID,
) : ViewModel() {
    /** What the learner set in this visit, shown over the result they opened, which was read before. */
    var shown by mutableStateOf<FocusTestSessionQuestions?>(null)
        private set

    var saving by mutableStateOf(false)
        private set

    var failed by mutableStateOf(false)
        private set

    fun set(on: Boolean) {
        if (saving) return
        val before = shown
        shown = if (on) FocusTestSessionQuestions.ON else FocusTestSessionQuestions.PAUSED
        saving = true
        failed = false
        viewModelScope.launch {
            val questions = if (on) FocusTestControlsInput.SessionQuestions.ON else FocusTestControlsInput.SessionQuestions.PAUSED
            when (val result = store.setSessionQuestions(goalId, questions)) {
                is MutationResult.Done -> {
                    shown = result.value.sessionQuestions
                }

                is MutationResult.Failed -> {
                    shown = before
                    failed = true
                }

                MutationResult.Obsolete -> {}
            }
            saving = false
        }
    }
}
