package com.zoonk.android.feature.warmup

data class WaitPresentation(
    val ready: Boolean,
    val completed: Int,
    val total: Int,
) {
    val showQuiz: Boolean get() = !ready
    val progress: Float get() = if (total <= 0) 0f else completed.coerceIn(0, total).toFloat() / total
}
