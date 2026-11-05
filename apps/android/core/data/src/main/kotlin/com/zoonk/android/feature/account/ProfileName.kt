package com.zoonk.android.feature.account

/** `@zoonk/auth/name-rules`: a changed name fits in 150 code points; one saved before the limit stays until it changes. */
fun isNameChangeTooLong(
    name: String,
    savedName: String,
): Boolean {
    val trimmedName = name.trim()
    return trimmedName != savedName.trim() && trimmedName.codePointCount(0, trimmedName.length) > 150
}
