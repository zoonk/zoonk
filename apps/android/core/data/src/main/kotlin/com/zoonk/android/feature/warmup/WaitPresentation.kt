package com.zoonk.android.feature.warmup

import com.zoonk.android.R

/** A wait's quiz is "while you wait" only until the thing is ready; a guess may still be on screen after that. */
data class WaitPresentation(
    val ready: Boolean,
) {
    val quizTitle: Int get() = if (ready) R.string.warm_up_title_ready else R.string.warm_up_title
}

fun placementWaitTitle(
    ready: Boolean,
    failed: Boolean,
): Int =
    when {
        ready -> R.string.onboarding_placement_ready
        failed -> R.string.generation_failed_ours
        else -> R.string.generation_placement
    }
