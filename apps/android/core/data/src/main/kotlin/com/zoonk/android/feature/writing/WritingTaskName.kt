package com.zoonk.android.feature.writing

import androidx.compose.runtime.Immutable
import com.zoonk.api.models.WritingTask

/** A written task as it's named before its question is assigned: its place in the written test and its line limit. */
@Immutable
data class WritingTaskName(
    val lines: Int?,
    /** Its 1-based place in the written test. */
    val number: Int,
    val total: Int,
    /** No other task of the test has its line limit, so the limit names it. */
    val distinctLines: Boolean,
)

fun WritingTask.toName(): WritingTaskName = WritingTaskName(lines?.toInt(), number.toInt(), total.toInt(), distinctLines)
