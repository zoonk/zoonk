package com.zoonk.android.feature.exam

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.zoonk.android.data.MutationResult
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
    private val reportStatus = MutableStateFlow(SaveStatus.Idle)
    private val savedResult = MutableStateFlow<ExamResult?>(null)
    private val dateStatus = MutableStateFlow(SaveStatus.Idle)

    val report: StateFlow<SaveStatus> = reportStatus.asStateFlow()

    /** The result the learner just saved, shown until the exam read again has it. */
    val saved: StateFlow<ExamResult?> = savedResult.asStateFlow()

    /** The exam's date from the notice or the closest sitting, which the learner's tap sets as the plan's. */
    val date: StateFlow<SaveStatus> = dateStatus.asStateFlow()

    fun report(report: ExamResultReport) {
        if (reportStatus.value == SaveStatus.Pending) return
        reportStatus.value = SaveStatus.Pending
        viewModelScope.launch {
            reportStatus.value =
                when (val result = exams.report(goalId, report)) {
                    is MutationResult.Done -> {
                        savedResult.value = result.value
                        SaveStatus.Saved
                    }

                    is MutationResult.Failed -> {
                        SaveStatus.Failed
                    }

                    MutationResult.Obsolete -> {
                        SaveStatus.Idle
                    }
                }
        }
    }

    fun useDate(date: LocalDate) {
        if (dateStatus.value == SaveStatus.Pending) return
        dateStatus.value = SaveStatus.Pending
        viewModelScope.launch {
            dateStatus.value =
                when (val result = plans.change(goalId, listOf(PlanOp.TargetDate(date)))) {
                    is MutationResult.Done -> {
                        if (result.value.status ==
                            PlanChangeResult.Status.APPLIED
                        ) {
                            SaveStatus.Saved
                        } else {
                            SaveStatus.Failed
                        }
                    }

                    is MutationResult.Failed -> {
                        SaveStatus.Failed
                    }

                    MutationResult.Obsolete -> {
                        SaveStatus.Idle
                    }
                }
        }
    }
}
