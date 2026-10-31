package com.zoonk.android.data

data class AppleCallback(
    val state: String,
    val code: String? = null,
    val idToken: String? = null,
    val user: String? = null,
    val error: String? = null,
)
