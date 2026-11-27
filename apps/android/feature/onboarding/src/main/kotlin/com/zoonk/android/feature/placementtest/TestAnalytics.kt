package com.zoonk.android.feature.placementtest

import android.os.SystemClock
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import com.zoonk.android.data.AnalyticsEvent
import com.zoonk.android.data.LocalEventTracker
import com.zoonk.android.data.TestContext

/**
 * One visit to a test, for its sittings' first questions: when the wait for one began (the visit, or the learner's
 * start or "Keep going" in it), and whether the question picks up a sitting opened before.
 */
internal class TestVisit {
    private var since = SystemClock.elapsedRealtime()
    private var startedHere = false
    private var said: String? = null

    fun started() {
        startedHere = true
        since = SystemClock.elapsedRealtime()
    }

    /** The first question the visit shows of [sitting] (a part, or a sitting of questions), once. */
    fun firstQuestion(
        test: TestContext,
        number: Long,
        sitting: String,
    ): AnalyticsEvent.TestFirstQuestionShown? {
        if (said == sitting) return null
        said = sitting
        return AnalyticsEvent.TestFirstQuestionShown(test, number, SystemClock.elapsedRealtime() - since, resumed = !startedHere)
    }
}

/** Sends each sitting's first question once, wherever it shows. */
@Composable
internal fun TrackFirstQuestion(
    visit: TestVisit,
    test: TestContext,
    number: Long,
    sitting: String,
) {
    val tracker = LocalEventTracker.current
    LaunchedEffect(visit, sitting) { visit.firstQuestion(test, number, sitting)?.let(tracker::track) }
}
