package com.zoonk.android.feature.exam

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.zoonk.android.data.MutationResult
import com.zoonk.android.data.Visit
import com.zoonk.android.feature.plan.PlanOp
import com.zoonk.android.feature.plan.PlanStore
import com.zoonk.api.models.ExamResult
import com.zoonk.api.models.PlanChangeResult
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.time.LocalDate
import java.util.UUID

enum class SaveStatus { Idle, Pending, Saved, Failed }

class ExamViewModel(
    private val exams: ExamStore,
    private val plans: PlanStore,
    private val goalId: UUID,
) : ViewModel() {
    /** The exam page's visit: a report or date that didn't save says so only on it. */
    val visit = Visit()

    private var reportStatus by mutableStateOf(SaveStatus.Idle)
    private val savedResult = MutableStateFlow<ExamResult?>(null)
    private var dateStatus by mutableStateOf(SaveStatus.Idle)
    private val reportFailure = visit.outcome<Unit>()
    private val dateFailure = visit.outcome<Unit>()

    /** Failed only on the visit that asked. */
    val report: SaveStatus get() = if (reportFailure.value != null) SaveStatus.Failed else reportStatus

    /** The result the learner just saved, shown until the exam read again has it. */
    val saved: StateFlow<ExamResult?> = savedResult.asStateFlow()

    /** The exam's date from the notice or the closest sitting, which the learner's tap sets as the plan's; failed only on the visit that asked. */
    val date: SaveStatus get() = if (dateFailure.value != null) SaveStatus.Failed else dateStatus

    fun report(report: ExamResultReport) {
        if (reportStatus == SaveStatus.Pending) return
        reportStatus = SaveStatus.Pending
        reportFailure.clear()
        val started = visit.number
        viewModelScope.launch {
            val result = exams.report(goalId, report)
            if (result is MutationResult.Done) savedResult.value = result.value
            reportStatus = if (result is MutationResult.Done) SaveStatus.Saved else SaveStatus.Idle
            if (result is MutationResult.Failed) reportFailure.send(started, Unit)
        }
    }

    fun useDate(date: LocalDate) {
        if (dateStatus == SaveStatus.Pending) return
        dateStatus = SaveStatus.Pending
        dateFailure.clear()
        val started = visit.number
        viewModelScope.launch {
            val result = plans.change(goalId, listOf(PlanOp.TargetDate(date)))
            val applied = (result as? MutationResult.Done)?.value?.status == PlanChangeResult.Status.APPLIED
            dateStatus = if (applied) SaveStatus.Saved else SaveStatus.Idle
            if (result is MutationResult.Failed || (result is MutationResult.Done && !applied)) dateFailure.send(started, Unit)
        }
    }
}
