package com.zoonk.android.feature.plan

import org.junit.Assert.assertEquals
import org.junit.Test

class PlanNoticeActionsTest {
    @Test fun passedExamOffersBothAnswers() {
        assertEquals(listOf(PlanNoticeAction.KeepStudying, PlanNoticeAction.ArchiveGoal), planNoticeActions(true, false, false))
    }

    @Test fun failedUndoOffersRetry() {
        assertEquals(listOf(PlanNoticeAction.Retry), planNoticeActions(false, true, true))
    }

    @Test fun failedSaveOffersRetry() {
        assertEquals(listOf(PlanNoticeAction.Retry), planNoticeActions(false, true, false))
    }
}
