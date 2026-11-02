package com.zoonk.android.feature.essay

import kotlinx.serialization.Serializable

/** The box's text, and the draft being graded with its attempt, so sending it again after the process ends is graded once. */
@Serializable
data class UnsentEssay(
    val text: String,
    val attemptId: String? = null,
    val sent: String? = null,
)
