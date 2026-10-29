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
    private val savingParts = MutableStateFlow(emptySet<PlanPart>())
    private val askedOperations = MutableStateFlow(emptyMap<PlanPart, List<PlanOp>>())
    private val failedParts = MutableStateFlow(emptySet<PlanPart>())
    private val latestChange = MutableStateFlow<EditorChange?>(null)

    /** Counts the editor's openings, so a change saved in one doesn't show its answer in the next. */
    private var openings = 0

    val isSaving: StateFlow<Boolean> = saving.asStateFlow()

    val events: Flow<PlanEvent> = notices.receiveAsFlow()

    /** Parts whose change is saving, which take no other tap meanwhile. */
    val pending: StateFlow<Set<PlanPart>> = savingParts.asStateFlow()

    /** What each saving part asked for, shown over the plan meanwhile: a tap shows at once and survives turning the device. */
    val asked: StateFlow<Map<PlanPart, List<PlanOp>>> = askedOperations.asStateFlow()

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

    /**
     * The part takes no other tap until the plan shown has the change. [answered] gets what it did,
     * or null when it didn't save or the plan couldn't be read again, as main's page couldn't be.
     */
    fun change(
        part: PlanPart,
        operations: List<PlanOp>,
        answered: (PlanChangeResult?) -> Unit = {},
    ) {
        if (part in savingParts.value) return
        val opening = openings
        savingParts.update { it + part }
        failedParts.update { it - part }
        askedOperations.update { it + (part to operations) }
        viewModelScope.launch {
            val result = store.change(goalId, operations)
            val saved = (result as? MutationResult.Done)?.value
            val shown = if (saved != null) store.awaitWritesShown(goalId) else null
            val sameOpening = opening == openings
            if (saved != null && shown == PlanShown.Current) {
                if (sameOpening && saved.status == PlanChangeResult.Status.APPLIED) saved.change?.let(::report)
                answered(saved)
            } else if (result is MutationResult.Failed || shown == PlanShown.Stale) {
                if (sameOpening) failedParts.update { it + part }
                answered(null)
            }
            askedOperations.update { it - part }
            savingParts.update { it - part }
        }
    }

    fun undo(change: PlanChange) {
        if (latestChange.value?.undoing == true) return
        latestChange.update { it?.forChange(change) { copy(undoing = true, undoFailed = false) } }
        viewModelScope.launch {
            val result = store.undo(goalId, change.id)
            val shown = if (result is MutationResult.Done) store.awaitWritesShown(goalId) else null
            latestChange.update {
                it?.forChange(change) {
                    copy(
                        undone = undone || shown == PlanShown.Current,
                        undoing = false,
                        undoFailed = result is MutationResult.Failed || shown == PlanShown.Stale,
                    )
                }
            }
        }
    }

    /** Answers can arrive out of order: the change made last stays the one shown, with its Undo. */
    private fun report(change: PlanChange) =
        latestChange.update { if (it == null || it.change.createdAt <= change.createdAt) EditorChange(change) else it }

    /** The editor opens without the change it showed last time, as main's does. */
    fun forgetLatest() {
        openings++
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
