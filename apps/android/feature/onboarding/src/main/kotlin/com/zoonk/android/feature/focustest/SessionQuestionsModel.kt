package com.zoonk.android.feature.focustest

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.zoonk.android.data.MutationResult
import com.zoonk.api.models.FocusTest
import com.zoonk.api.models.FocusTestControlsInput
import com.zoonk.api.models.FocusTestSessionQuestions
import kotlinx.coroutines.launch
import java.util.UUID

/** "Ask a few more in my sessions": the test's questions inside the first week's sessions, switched from its result. */
internal class SessionQuestionsModel(
    private val store: FocusTestStore,
    private val goalId: UUID,
) : ViewModel() {
    /** The result the learner last switched on; a newer result from the server says its own. */
    private var over by mutableStateOf<FocusTest?>(null)

    private var chosen by mutableStateOf<FocusTestSessionQuestions?>(null)

    private var saveFailed by mutableStateOf(false)

    var saving by mutableStateOf(false)
        private set

    fun shown(result: FocusTest): FocusTestSessionQuestions = chosen.takeIf { over == result } ?: result.sessionQuestions

    fun failed(result: FocusTest): Boolean = saveFailed && over == result

    fun set(
        result: FocusTest,
        on: Boolean,
    ) {
        if (saving) return
        val before = chosen.takeIf { over == result }
        over = result
        chosen = if (on) FocusTestSessionQuestions.ON else FocusTestSessionQuestions.PAUSED
        saving = true
        saveFailed = false
        viewModelScope.launch {
            val questions = if (on) FocusTestControlsInput.SessionQuestions.ON else FocusTestControlsInput.SessionQuestions.PAUSED
            when (val saved = store.setSessionQuestions(goalId, questions)) {
                is MutationResult.Done -> {
                    chosen = saved.value.sessionQuestions
                }

                is MutationResult.Failed -> {
                    chosen = before
                    saveFailed = true
                }

                MutationResult.Obsolete -> {}
            }
            saving = false
        }
    }
}
