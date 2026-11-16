package com.zoonk.android.feature.warmup

import com.zoonk.android.R
import org.junit.Assert.assertEquals
import org.junit.Test

class WaitPresentationTest {
    @Test fun aRunningWaitOffersItsQuiz() {
        assertEquals(R.string.warm_up_title, WaitPresentation(ready = false).quizTitle)
    }

    @Test fun onceReadyTheQuizNoLongerSaysWhileYouWait() {
        assertEquals(R.string.warm_up_title_ready, WaitPresentation(ready = true).quizTitle)
    }
}
