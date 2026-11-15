package com.zoonk.android.feature.tutor

import com.zoonk.android.R

data class TutorPrompt(
    val name: String?,
) {
    val asksForHelp: Boolean get() = name.isNullOrBlank()
    val label: Int get() = if (asksForHelp) R.string.tutor_empty_title else R.string.tutor_ask
}
