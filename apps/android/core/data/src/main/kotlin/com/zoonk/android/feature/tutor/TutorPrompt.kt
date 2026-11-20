package com.zoonk.android.feature.tutor

data class TutorPrompt(
    val name: String?,
) {
    val asksForHelp: Boolean get() = name.isNullOrBlank()
}
