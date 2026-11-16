package com.zoonk.android.feature.plan

import org.junit.Assert.assertEquals
import org.junit.Test

class PlanNoticeActionsTest {
    @Test fun aChangeOffersUndo() {
        assertEquals(listOf(PlanNoticeAction.Undo), planNoticeActions(failed = false, canUndo = true))
    }

    @Test fun failedUndoOffersRetry() {
        assertEquals(listOf(PlanNoticeAction.Retry), planNoticeActions(failed = true, canUndo = true))
    }

    @Test fun failedSaveOffersRetry() {
        assertEquals(listOf(PlanNoticeAction.Retry), planNoticeActions(failed = true, canUndo = false))
    }
}
