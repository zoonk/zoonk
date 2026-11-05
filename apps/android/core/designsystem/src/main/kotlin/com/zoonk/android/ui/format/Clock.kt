package com.zoonk.android.ui.format

/** Main's `formatClock`: "0:08", "1:02:03". */
fun formatClock(millis: Long): String {
    val total = (millis + 999) / 1000
    val hours = total / 3600
    val minutes = total / 60 % 60
    val seconds = total % 60
    return if (hours > 0) "$hours:${pad(minutes)}:${pad(seconds)}" else "$minutes:${pad(seconds)}"
}

private fun pad(value: Long) = value.toString().padStart(2, '0')
