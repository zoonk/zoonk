package com.zoonk.android.feature.placementtest

import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.res.stringResource
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.compose.viewModel
import com.zoonk.android.R
import com.zoonk.android.data.MutationResult
import com.zoonk.android.data.Visit
import com.zoonk.android.feature.plan.PlanStore
import com.zoonk.android.ui.VisitOf
import com.zoonk.android.ui.components.ButtonIcon
import com.zoonk.android.ui.components.OutlinedButton
import kotlinx.coroutines.launch
import java.util.UUID

@Composable
internal fun rememberPlacementUndo(
    plans: PlanStore,
    goalId: UUID,
    changeId: UUID?,
): PlacementUndoViewModel? {
    if (changeId == null) return null
    val vm = viewModel(key = "placement-undo:$goalId:$changeId") { PlacementUndoViewModel(plans, goalId, changeId) }
    VisitOf(vm.visit)
    return vm
}

@Composable
internal fun PlacementUndoButton(
    undo: PlacementUndoViewModel?,
    enabled: Boolean,
) {
    if (undo == null || undo.restoredLessons != null) return
    OutlinedButton(
        busy = undo.saving,
        enabled = enabled && !undo.saving,
        onClick = undo::undo,
        leadingIcon = { ButtonIcon(R.drawable.ic_undo) },
    ) {
        Text(stringResource(R.string.plan_undo))
    }
}

internal class PlacementUndoViewModel(
    private val plans: PlanStore,
    private val goalId: UUID,
    private val changeId: UUID,
) : ViewModel() {
    val visit = Visit()
    private val failure = visit.outcome<Unit>()

    var saving by mutableStateOf(false)
        private set

    var restoredLessons by mutableStateOf<Int?>(null)
        private set

    val failed get() = failure.value != null

    fun undo() {
        if (saving || restoredLessons != null) return
        saving = true
        failure.clear()
        val asked = visit.number
        viewModelScope.launch {
            when (val result = plans.undo(goalId, changeId)) {
                is MutationResult.Done -> restoredLessons = result.value.lessonsSkipped.toInt()
                is MutationResult.Failed -> failure.send(asked, Unit)
                MutationResult.Obsolete -> Unit
            }
            saving = false
        }
    }
}
