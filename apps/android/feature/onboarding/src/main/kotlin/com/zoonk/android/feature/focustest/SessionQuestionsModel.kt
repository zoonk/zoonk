package com.zoonk.android.feature.focustest

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.zoonk.android.data.MutationResult
import com.zoonk.android.data.Visit
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
    /** The result's visit: a switch that didn't save says so only on it. */
    val visit = Visit()

    /** The result the learner last switched on; a newer result from the server says its own. */
    private var over by mutableStateOf<FocusTest?>(null)

    private var chosen by mutableStateOf<FocusTestSessionQuestions?>(null)

    private val saveFailure = visit.outcome<Unit>()

    var saving by mutableStateOf(false)
        private set

    fun shown(result: FocusTest): FocusTestSessionQuestions = chosen.takeIf { over == result } ?: result.sessionQuestions

    /** The switch for [result] didn't save, on this visit. */
    fun failed(result: FocusTest): Boolean = saveFailure.value != null && over == result

    fun set(
        result: FocusTest,
        on: Boolean,
    ) {
        if (saving) return
        val before = chosen.takeIf { over == result }
        over = result
        chosen = if (on) FocusTestSessionQuestions.ON else FocusTestSessionQuestions.PAUSED
        saving = true
        saveFailure.clear()
        val started = visit.number
        viewModelScope.launch {
            val questions = if (on) FocusTestControlsInput.SessionQuestions.ON else FocusTestControlsInput.SessionQuestions.PAUSED
            when (val saved = store.setSessionQuestions(goalId, questions)) {
                is MutationResult.Done -> {
                    chosen = saved.value.sessionQuestions
                }

                is MutationResult.Failed -> {
                    chosen = before
                    saveFailure.send(started, Unit)
                }

                MutationResult.Obsolete -> {}
            }
            saving = false
        }
    }
}
