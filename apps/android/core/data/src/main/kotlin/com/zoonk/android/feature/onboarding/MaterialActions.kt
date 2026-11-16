package com.zoonk.android.feature.onboarding

import java.time.Instant

val WriteOutcome<*>?.uploadLimit: UsageLimit?
    get() = ((this as? WriteOutcome.Refused)?.refusal as? Refusal.Limit)?.limit?.takeIf { it.resource == "upload" }

fun WriteOutcome<*>?.canAttachMaterial(now: Instant): Boolean {
    val limit = uploadLimit ?: return true
    val opening = limit.reached.availableAt
    return opening != null && !now.isBefore(opening)
}
