package com.zoonk.android.feature.onboarding

import java.time.Instant

fun WriteOutcome<*>?.canAttachMaterial(now: Instant): Boolean {
    val refusal = (this as? WriteOutcome.Refused)?.refusal as? Refusal.Limit ?: return true
    if (refusal.limit.resource != "upload") return true
    val opening = refusal.limit.reached.availableAt
    return opening != null && !now.isBefore(opening)
}
