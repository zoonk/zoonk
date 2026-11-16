package com.zoonk.android.feature.warmup

import com.zoonk.android.R

/** A wait's quiz is "while you wait" only until the thing is ready; a guess may still be on screen after that. */
data class WaitPresentation(
    val ready: Boolean,
) {
    val quizTitle: Int get() = if (ready) R.string.warm_up_title_ready else R.string.warm_up_title
}
