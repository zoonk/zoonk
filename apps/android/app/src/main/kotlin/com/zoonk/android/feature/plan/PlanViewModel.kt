package com.zoonk.android.feature.plan

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.zoonk.android.data.MutationResult
import com.zoonk.android.data.value
import com.zoonk.api.models.GoalUpdateInput
import com.zoonk.api.models.Plan
import com.zoonk.api.models.PlanChange
import com.zoonk.api.models.PlanChangeResult
import com.zoonk.api.models.PlanTimeToCover
import kotlinx.coroutines.Deferred
import kotlinx.coroutines.async
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.receiveAsFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import java.util.UUID

/**
 * What a write did that the screen acts on: a refusal said in a snackbar (the menu that started it
 * has closed by then), or an archived goal, which leaves the Plan.
 */
enum class PlanEvent { SaveFailed, GoalLimitReached, Archived }

/** A place that saves plan edits: each waits and fails on its own, as each of main's `usePlanChange` does. */
enum class PlanPart { Date, Schedule, Activities, Writing, Steering, FullCourse, Focus }

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
    private val openingChanges = MutableStateFlow(emptyMap<UUID, EditorChange>())
    private val timeToCoverState = MutableStateFlow<TimeToCoverState>(TimeToCoverState.Idle)
    private var search: TimeToCoverSearch? = null
    private val previewState = MutableStateFlow<PlanPreviewState>(PlanPreviewState.Idle)

    /** Counts the editor's openings, so a change saved in one doesn't show its answer in the next. */
    private var openings = 0

    val isSaving: StateFlow<Boolean> = saving.asStateFlow()

    val events: Flow<PlanEvent> = notices.receiveAsFlow()

    /** Parts whose change is saving, which take no other tap meanwhile. */
    val pending: StateFlow<Set<PlanPart>> = savingParts.asStateFlow()

    /** What each saving part asked for, shown over the plan meanwhile: a tap shows at once and survives turning the device. */
    val asked: StateFlow<Map<PlanPart, List<PlanOp>>> = askedOperations.asStateFlow()

    val failed: StateFlow<Set<PlanPart>> = failedParts.asStateFlow()

    /** Every change this opening of the editor made, so a sheet keeps its own, with its Undo, after a newer one. */
    val changes: StateFlow<Map<UUID, EditorChange>> = openingChanges.asStateFlow()

    /** The change made last, which the editor shows with Undo; answers can arrive out of order. */
    val latest: StateFlow<EditorChange?> =
        openingChanges.map { all -> all.values.maxByOrNull { it.change.createdAt } }.stateIn(viewModelScope, SharingStarted.Eagerly, null)

    /** Read it with [forPlan]: it's the plan revision it was asked of. */
    val timeToCover: StateFlow<TimeToCoverState> = timeToCoverState.asStateFlow()

    /** Read it with [of]: it's the operations and plan it was asked of. */
    val preview: StateFlow<PlanPreviewState> = previewState.asStateFlow()

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
        if (openingChanges.value[change.id]?.undoing == true) return
        update(change.id) { copy(undoing = true, undoFailed = false) }
        viewModelScope.launch {
            val result = store.undo(goalId, change.id)
            val shown = if (result is MutationResult.Done) store.awaitWritesShown(goalId) else null
            update(change.id) {
                copy(
                    undone = undone || shown == PlanShown.Current,
                    undoing = false,
                    undoFailed = result is MutationResult.Failed || shown == PlanShown.Stale,
                )
            }
        }
    }

    private fun report(change: PlanChange) = openingChanges.update { it + (change.id to EditorChange(change)) }

    private fun update(
        id: UUID,
        transform: EditorChange.() -> EditorChange,
    ) = openingChanges.update { all -> all[id]?.let { all + (id to it.transform()) } ?: all }

    /**
     * Main's time-to-cover store: one search per plan revision, which [found] joins while it runs,
     * and an answer stays only for the plan it was found for. Only from the learner's tap: it plans
     * the goal at each daily time.
     */
    fun findTimeToCover(
        plan: Plan,
        found: (TimeToCoverOutcome) -> Unit = {},
    ) {
        val revision = timeToCoverRevision(plan)
        (timeToCoverState.value as? TimeToCoverState.Answered)?.takeIf { it.revision == revision }?.let {
            found(TimeToCoverOutcome.Answered(it.time))
            return
        }
        val running = search?.takeIf { it.revision == revision } ?: startSearch(revision)
        viewModelScope.launch {
            val result = running.result.await()
            found(if (shownRevision() != revision) TimeToCoverOutcome.Stale else result.outcome())
        }
    }

    private fun startSearch(revision: List<Any?>): TimeToCoverSearch {
        timeToCoverState.value = TimeToCoverState.Pending(revision)
        val started = TimeToCoverSearch(revision, viewModelScope.async { store.timeToCover(goalId) })
        search = started
        viewModelScope.launch {
            val result = started.result.await()
            if (search === started) search = null
            timeToCoverState.update { if (it == TimeToCoverState.Pending(revision)) result.state(revision) else it }
        }
        return started
    }

    private fun shownRevision() =
        store.plan[goalId]
            .state.value.value
            ?.plan
            ?.let(::timeToCoverRevision)

    private class TimeToCoverSearch(
        val revision: List<Any?>,
        val result: Deferred<MutationResult<PlanTimeToCover>>,
    )

    private fun MutationResult<PlanTimeToCover>.outcome(): TimeToCoverOutcome =
        when (this) {
            is MutationResult.Done -> if (value.ready) TimeToCoverOutcome.Answered(value) else TimeToCoverOutcome.Building
            is MutationResult.Failed -> TimeToCoverOutcome.Failed
            MutationResult.Obsolete -> TimeToCoverOutcome.Stale
        }

    private fun MutationResult<PlanTimeToCover>.state(revision: List<Any?>): TimeToCoverState =
        when (this) {
            is MutationResult.Done -> if (value.ready) TimeToCoverState.Answered(revision, value) else TimeToCoverState.Building(revision)
            is MutationResult.Failed -> TimeToCoverState.Failed(revision)
            MutationResult.Obsolete -> TimeToCoverState.Idle
        }

    /** What [operations] would do to [plan], from the learner's tap: it saves nothing. */
    fun requestPreview(
        plan: Plan,
        operations: List<PlanOp>,
    ) {
        val request = PlanPreviewState.Loading(operations, plan)
        previewState.value = request
        viewModelScope.launch {
            val result = store.preview(goalId, operations)
            if (result is MutationResult.Obsolete) return@launch
            previewState.update { it.resolve(request, (result as? MutationResult.Done)?.value) }
        }
    }

    fun clearPreview() {
        previewState.value = PlanPreviewState.Idle
    }

    /** The editor opens without the change it showed last time, as main's does. */
    fun forgetLatest() {
        openings++
        openingChanges.value = emptyMap()
        failedParts.value = emptySet()
    }

    private companion object {
        const val TOO_MANY_REQUESTS = 429
    }
}
