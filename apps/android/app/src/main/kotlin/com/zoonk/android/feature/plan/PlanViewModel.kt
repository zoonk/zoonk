package com.zoonk.android.feature.plan

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.zoonk.android.data.MutationResult
import com.zoonk.api.models.GoalUpdateInput
import com.zoonk.api.models.PlanChange
import com.zoonk.api.models.PlanChangeResult
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.receiveAsFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import java.util.UUID

/**
 * What a write did that the screen acts on: a refusal said in a snackbar (the menu that started it
 * has closed by then), or an archived goal, which leaves the Plan.
 */
enum class PlanEvent { SaveFailed, GoalLimitReached, Archived }

/** A place that saves plan edits: each waits and fails on its own, as each of main's `usePlanChange` does. */
enum class PlanPart { Date, Schedule, Activities, Writing, Steering }

/** The editor's latest applied change, which it shows with Undo. */
data class EditorChange(
    val change: PlanChange,
    val undone: Boolean = change.status == PlanChange.Status.UNDONE,
    val undoing: Boolean = false,
    val undoFailed: Boolean = false,
)

class PlanViewModel(
    private val store: PlanStore,
    private val goalId: UUID,
) : ViewModel() {
    private val saving = MutableStateFlow(false)
    private val notices = Channel<PlanEvent>(Channel.BUFFERED)
    private val pendingParts = MutableStateFlow(emptySet<PlanPart>())
    private val failedParts = MutableStateFlow(emptySet<PlanPart>())
    private val latestChange = MutableStateFlow<EditorChange?>(null)

    val isSaving: StateFlow<Boolean> = saving.asStateFlow()

    val events: Flow<PlanEvent> = notices.receiveAsFlow()

    val pending: StateFlow<Set<PlanPart>> = pendingParts.asStateFlow()

    val failed: StateFlow<Set<PlanPart>> = failedParts.asStateFlow()

    val latest: StateFlow<EditorChange?> = latestChange.asStateFlow()

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

    /** [answered] gets what the change did, or null when it didn't save, once the plan shown has it. */
    fun change(
        part: PlanPart,
        operations: List<PlanOp>,
        answered: (PlanChangeResult?) -> Unit = {},
    ) {
        pendingParts.update { it + part }
        failedParts.update { it - part }
        viewModelScope.launch {
            val result = store.change(goalId, operations)
            val outcome = (result as? MutationResult.Done)?.value
            if (result is MutationResult.Failed) failedParts.update { it + part }
            pendingParts.update { it - part }
            answered(outcome)
            if (outcome?.status == PlanChangeResult.Status.APPLIED) outcome.change?.let { latestChange.value = EditorChange(it) }
        }
    }

    fun undo(change: PlanChange) {
        if (latestChange.value?.undoing == true) return
        latestChange.update { it?.forChange(change) { copy(undoing = true, undoFailed = false) } }
        viewModelScope.launch {
            val result = store.undo(goalId, change.id)
            latestChange.update {
                it?.forChange(change) {
                    copy(undone = result is MutationResult.Done || undone, undoing = false, undoFailed = result is MutationResult.Failed)
                }
            }
        }
    }

    /** The editor opens without the change it showed last time, as main's does. */
    fun forgetLatest() {
        latestChange.value = null
        failedParts.value = emptySet()
    }

    private fun EditorChange.forChange(
        change: PlanChange,
        transform: EditorChange.() -> EditorChange,
    ) = if (this.change.id == change.id) transform() else this

    private companion object {
        const val TOO_MANY_REQUESTS = 429
    }
}
