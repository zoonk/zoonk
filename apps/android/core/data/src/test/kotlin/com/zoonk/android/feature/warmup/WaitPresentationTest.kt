package com.zoonk.android.feature.warmup

import com.zoonk.android.R
import org.junit.Assert.assertEquals
import org.junit.Test

class WaitPresentationTest {
    @Test fun aFailedPlacementStopsClaimingItIsBeingPrepared() {
        assertEquals(R.string.generation_failed_ours, placementWaitTitle(ready = false, failed = true))
        assertEquals(R.string.generation_placement, placementWaitTitle(ready = false, failed = false))
        assertEquals(R.string.onboarding_placement_ready, placementWaitTitle(ready = true, failed = false))
    }

    @Test fun aRunningWaitOffersItsQuiz() {
        assertEquals(R.string.warm_up_title, WaitPresentation(ready = false).quizTitle)
    }

    @Test fun onceReadyTheQuizNoLongerSaysWhileYouWait() {
        assertEquals(R.string.warm_up_title_ready, WaitPresentation(ready = true).quizTitle)
    }
}
