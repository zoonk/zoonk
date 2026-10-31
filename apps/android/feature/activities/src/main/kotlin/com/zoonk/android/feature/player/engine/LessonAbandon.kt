package com.zoonk.android.feature.player.engine

import com.zoonk.android.data.AnalyticsEvent

/** Main's `getAbandonEvent`: a started run left before its end; null otherwise. */
fun LessonPlayerState.abandonEvent(): AnalyticsEvent.ActivityAbandoned? {
    if (run !is LessonRun.Started || phase == LessonPhase.Completed) return null
    return AnalyticsEvent.ActivityAbandoned(
        lessonId = lessonId,
        screen = position + 1,
        stepKind = currentStep?.kind,
        wrongInARow = wrongInARow(),
    )
}

/** Wrong verdicts since the last right one, counting each screen seen so far once, at its latest answer. */
private fun LessonPlayerState.wrongInARow(): Int {
    val verdicts =
        queue
            .take(position + 1)
            .asReversed()
            .distinct()
            .mapNotNull { results[it]?.takeIf { result -> result.checked }?.isCorrect }
    val firstRight = verdicts.indexOf(true)
    return if (firstRight == -1) verdicts.size else firstRight
}
