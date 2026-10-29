package com.zoonk.android.feature.plan

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.zoonk.android.data.MutationResult
import com.zoonk.api.models.GoalUpdateInput
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.receiveAsFlow
import kotlinx.coroutines.launch
import java.util.UUID

/**
 * What a write did that the screen acts on: a refusal said in a snackbar (the menu that started it
 * has closed by then), or an archived goal, which leaves the Plan.
 */
enum class PlanEvent { SaveFailed, GoalLimitReached, Archived }

/** The Plan's writes from the learner's taps; its reads stay in [PlanStore]. */
class PlanViewModel(
    private val store: PlanStore,
    private val goalId: UUID,
) : ViewModel() {
    private val saving = MutableStateFlow(false)
    private val notices = Channel<PlanEvent>(Channel.BUFFERED)

    val isSaving: StateFlow<Boolean> = saving.asStateFlow()

    val events: Flow<PlanEvent> = notices.receiveAsFlow()

    fun setStatus(status: GoalUpdateInput.Status) {
        if (saving.value) return
        saving.value = true
        viewModelScope.launch {
            when (val result = store.setStatus(goalId, status)) {
                is MutationResult.Done -> {
                    if (status == GoalUpdateInput.Status.ARCHIVED) notices.send(PlanEvent.Archived)
                }

                is MutationResult.Failed -> {
                    notices.send(if (result.status == TOO_MANY_REQUESTS) PlanEvent.GoalLimitReached else PlanEvent.SaveFailed)
                }

                MutationResult.Obsolete -> {}
            }
            saving.value = false
        }
    }

    private companion object {
        const val TOO_MANY_REQUESTS = 429
    }
}
