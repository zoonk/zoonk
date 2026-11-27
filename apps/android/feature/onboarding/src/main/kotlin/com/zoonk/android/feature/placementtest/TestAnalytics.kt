package com.zoonk.android.feature.placementtest

import android.os.SystemClock
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import com.zoonk.android.data.AnalyticsEvent
import com.zoonk.android.data.LocalEventTracker
import com.zoonk.android.data.TestContext

/** A question on screen: the bar's share of its sitting, and what ✕ there says the learner left. */
internal data class Sitting(
    val share: Float,
    val left: AnalyticsEvent.TestLeft,
)

internal fun sitting(
    test: TestContext,
    answered: Long,
    total: Long,
) = Sitting(
    share = if (total > 0) (answered.toFloat() / total).coerceIn(0f, 1f) else 0f,
    left = AnalyticsEvent.TestLeft(test, questionNumber = answered + 1),
)

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
