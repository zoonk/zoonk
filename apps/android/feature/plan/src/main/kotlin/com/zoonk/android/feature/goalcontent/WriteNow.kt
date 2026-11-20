package com.zoonk.android.feature.goalcontent

import androidx.compose.runtime.Composable
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.compose.viewModel
import com.zoonk.android.app.AppContainer
import com.zoonk.android.data.MutationResult
import com.zoonk.android.data.Visit
import com.zoonk.android.feature.essay.EssayStore
import com.zoonk.android.navigation.AppNavigator
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.ui.ActOn
import com.zoonk.android.ui.VisitOf
import kotlinx.coroutines.launch
import java.util.UUID

/**
 * "Write" on a page: the learner's own writing block, then its start, as the tap's one request
 * chain; the essay opens on its question, or on what stands before it.
 */
internal class WriteNowViewModel(
    private val essays: EssayStore,
    private val goalId: UUID,
) : ViewModel() {
    val visit = Visit()
    val opened = visit.outcome<AppRoute.Essay>()
    val failed = visit.outcome<Unit>()

    var busy by mutableStateOf(false)
        private set

    fun write() {
        if (busy) return
        busy = true
        failed.clear()
        val started = visit.number
        viewModelScope.launch {
            when (val result = essays.writeNow(goalId)) {
                is MutationResult.Done -> opened.send(started, result.value)
                is MutationResult.Failed -> failed.send(started, Unit)
                MutationResult.Obsolete -> Unit
            }
            busy = false
        }
    }
}

@Immutable
data class WriteNow(
    val busy: Boolean,
    val failed: Boolean,
    val write: () -> Unit,
)

@Composable
internal fun rememberWriteNow(
    app: AppContainer,
    goalId: UUID,
    navigator: AppNavigator,
): WriteNow {
    val viewModel = viewModel(key = "write-now-$goalId") { WriteNowViewModel(app.essays, goalId) }
    VisitOf(viewModel.visit)
    ActOn(viewModel.opened) { navigator.open(it) }
    return WriteNow(viewModel.busy, viewModel.failed.value != null, viewModel::write)
}
