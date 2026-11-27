package com.zoonk.android.feature.mock

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.SheetValue
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.compose.viewModel
import com.zoonk.android.R
import com.zoonk.android.data.LoadState
import com.zoonk.android.data.MutationResult
import com.zoonk.android.data.Visit
import com.zoonk.android.data.collectShown
import com.zoonk.android.feature.challenge.MockScheduleStore
import com.zoonk.android.navigation.AppNavigator
import com.zoonk.android.navigation.AppTab
import com.zoonk.android.ui.ActOn
import com.zoonk.android.ui.VisitOf
import com.zoonk.android.ui.components.ButtonEdge
import com.zoonk.android.ui.components.ButtonSize
import com.zoonk.android.ui.components.LinkButton
import com.zoonk.android.ui.components.ListRow
import com.zoonk.android.ui.components.ModalBottomSheet
import com.zoonk.android.ui.components.OutlinedButton
import com.zoonk.android.ui.components.TextButton
import com.zoonk.android.ui.format.DateStyle
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.formatDate
import com.zoonk.android.ui.scaffold.CloseButton
import kotlinx.coroutines.launch
import kotlinx.datetime.LocalDate
import kotlinx.datetime.toJavaLocalDate
import java.util.UUID

private class MockScheduleModel(
    val store: MockScheduleStore,
    val id: UUID,
) : ViewModel() {
    var saving by mutableStateOf(false)
        private set
    val visit = Visit { saving = false }
    val changed = visit.outcome<Boolean>()
    val failed = visit.outcome<Boolean>()
    val dates = store.dates[id]

    fun refresh() {
        viewModelScope.launch { dates.refresh() }
    }

    fun save(date: LocalDate?) {
        if (saving) return
        saving = true
        val started = visit.number
        failed.clear()
        viewModelScope.launch {
            when (store.change(id, date)) {
                is MutationResult.Done -> {
                    changed.send(started, true)
                }

                is MutationResult.Failed -> {
                    failed.send(started, true)
                    dates.refresh()
                }

                MutationResult.Obsolete -> {}
            }
            if (visit.number == started) saving = false
        }
    }

    fun undo(change: MockScheduleStore.Change) {
        if (saving) return
        saving = true
        val started = visit.number
        failed.clear()
        viewModelScope.launch {
            when (store.undo(change)) {
                is MutationResult.Done -> Unit
                is MutationResult.Failed -> failed.send(started, true)
                MutationResult.Obsolete -> Unit
            }
            if (visit.number == started) saving = false
        }
    }
}

/** Main's `MockSchedule` trigger, a small `link` button: underlined words on the start edge that open [MockScheduleSheet]. */
@Composable
fun ChangeMockSchedule(
    enabled: Boolean = true,
    onClick: () -> Unit,
) = LinkButton(stringResource(R.string.mock_schedule_change), onClick = onClick, enabled = enabled, size = ButtonSize.Small)

@Suppress("DEPRECATION")
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MockScheduleSheet(
    store: MockScheduleStore,
    id: UUID,
    navigator: AppNavigator,
    onDismiss: () -> Unit,
) {
    val model = viewModel(key = "mock-schedule-$id") { MockScheduleModel(store, id) }
    VisitOf(model.visit)
    ActOn(model.changed) {
        onDismiss()
        navigator.showRoot(AppTab.Today)
    }
    val locale = currentLocale()
    val sheet =
        rememberModalBottomSheetState(skipPartiallyExpanded = true, confirmValueChange = { value ->
            value != SheetValue.Hidden ||
                !model.saving
        })
    ModalBottomSheet(onDismissRequest = { if (!model.saving) onDismiss() }, sheetState = sheet) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(
                stringResource(R.string.mock_schedule_title),
                Modifier.semantics { heading() },
                style = MaterialTheme.typography.titleLarge,
            )
            val dates by model.dates.collectShown()
            when (val read = dates) {
                is LoadState.Loaded -> {
                    LazyColumn(Modifier.weight(1f, fill = false)) {
                        items(read.value, key = { it.toString() }) { day ->
                            ListRow(
                                headline = { Text(formatDate(day.toJavaLocalDate(), locale, DateStyle.WeekdayDay)) },
                                onClick = if (model.saving) null else ({ model.save(day) }),
                            )
                        }
                    }
                    TextButton(
                        onClick = { model.save(null) },
                        enabled = !model.saving,
                        edge = ButtonEdge.Start,
                    ) { Text(stringResource(R.string.mock_schedule_skip)) }
                }

                is LoadState.Failed, LoadState.Empty -> {
                    OutlinedButton(onClick = model::refresh) { Text(stringResource(R.string.load_failed_try_again)) }
                }

                LoadState.Idle, LoadState.Loading -> {
                    CircularProgressIndicator()
                }
            }
            if (model.saving) CircularProgressIndicator()
            if (model.failed.value == true) Text(stringResource(R.string.today_save_failed))
        }
    }
}

@Composable
fun MockScheduleNotice(
    store: MockScheduleStore,
    modifier: Modifier = Modifier,
) {
    val change = store.notice ?: return
    val model = viewModel(key = "mock-schedule-undo-${change.changeId}") { MockScheduleModel(store, change.itemId) }
    VisitOf(model.visit)
    val locale = currentLocale()
    Column(modifier) {
        val date = change.date
        Text(
            if (date == null) {
                stringResource(R.string.mock_schedule_skipped)
            } else {
                stringResource(R.string.mock_schedule_moved, formatDate(date.toJavaLocalDate(), locale, DateStyle.WeekdayDay))
            },
        )
        Row {
            TextButton(
                onClick = { model.undo(change) },
                enabled = !model.saving,
                edge = ButtonEdge.Start,
            ) { Text(stringResource(R.string.plan_undo)) }
            CloseButton(onClick = { store.dismiss(change) }, label = stringResource(R.string.plan_editor_close))
        }
        if (model.failed.value == true) Text(stringResource(R.string.today_save_failed))
    }
}
