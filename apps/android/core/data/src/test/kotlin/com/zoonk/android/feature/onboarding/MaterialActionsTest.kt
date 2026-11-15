package com.zoonk.android.feature.onboarding

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.Instant

class MaterialActionsTest {
    private val now = Instant.parse("2026-11-15T12:00:00Z")

    @Test fun allAttachmentsStopAtTheUploadCap() {
        val failure = WriteOutcome.Refused(Refusal.Limit(UsageLimit("rolling30Days", "upload", "free", "2026-11-16T12:00:00Z")))
        assertFalse(failure.canAttachMaterial(now))
    }

    @Test fun attachmentsReturnWhenTheAllowanceOpens() {
        val failure = WriteOutcome.Refused(Refusal.Limit(UsageLimit("rolling30Days", "upload", "free", "2026-11-15T11:00:00Z")))
        assertTrue(failure.canAttachMaterial(now))
    }

    @Test fun aNetworkFailureDoesNotDisableRetry() {
        assertTrue((null as WriteOutcome<*>?).canAttachMaterial(now))
    }
}
