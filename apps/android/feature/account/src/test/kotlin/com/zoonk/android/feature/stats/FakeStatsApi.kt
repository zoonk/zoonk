package com.zoonk.android.feature.stats

import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.api.ApiJson
import com.zoonk.api.models.CurrentUserActivityResponseActivity
import com.zoonk.api.models.CurrentUserEnergyResponseEnergy
import com.zoonk.api.models.CurrentUserProgressResponse
import com.zoonk.api.models.CurrentUserScorePatternsResponsePatterns
import com.zoonk.api.models.CurrentUserScoreResponseScore
import java.time.DayOfWeek
import java.time.LocalDate
import java.time.temporal.ChronoUnit
import java.time.temporal.TemporalAdjusters

internal class FakeStatsApi(
    val studied: Boolean,
) : StatsApi {
    private val verdicts =
        """"dayVerdict":{"kind":"best","points":null},"minimumAnswers":10,"timeVerdict":{"kind":"best","points":null},""" +
            """"weekSpread":{"high":92,"low":74}"""

    override suspend fun progress(session: AuthenticatedSession): CurrentUserProgressResponse =
        ApiJson.decodeFromString(
            if (studied) {
                """{"activity":{"learningDays":12,"totalLearningSeconds":5400,"totalLessonCompletions":20},"energy":{"currentEnergy":64},
                    "level":{"belt":"yellow","bpPerLevel":100,"bpToNextLevel":40,"isMaxLevel":false,"level":3,
                    "nextBelt":{"belt":"orange","brainPowerToGo":740,"startBrainPower":2000},"progressInLevel":60,"totalBrainPower":1260},
                    "score":{"correctAnswers":45,"incorrectAnswers":15,"score":75,"totalAnswers":60}}"""
            } else {
                """{"activity":{"learningDays":0,"totalLearningSeconds":0,"totalLessonCompletions":0}}"""
            },
        )

    override suspend fun energy(session: AuthenticatedSession): CurrentUserEnergyResponseEnergy =
        ApiJson.decodeFromString(
            """{"currentEnergy":64,"insights":{"averageEnergy":58.25,"fullEnergyDays":2},"days":[${yearOf { day, ago ->
                val energy =
                    if (ago == 0) {
                        "64"
                    } else if (ago > 90) {
                        "null"
                    } else {
                        (100 - ago * 7 % 90).toString()
                    }
                """{"date":"$day","energy":$energy}"""
            }}]}""",
        )

    override suspend fun activity(session: AuthenticatedSession): CurrentUserActivityResponseActivity =
        ApiJson.decodeFromString(
            """{"learningDays":12,"totalLearningSeconds":5400,"totalLessonCompletions":20,"days":[${yearOf { day, ago ->
                val count =
                    if (ago == 0) {
                        5
                    } else if (ago == 1) {
                        3
                    } else {
                        (ago * 7 % 11).takeIf { ago < 60 && it < 5 } ?: 0
                    }
                """{"activitiesCompleted":$count,"date":"$day","lessonCompletions":0}"""
            }}]}""",
        )

    override suspend fun score(session: AuthenticatedSession): CurrentUserScoreResponseScore =
        ApiJson.decodeFromString(
            """{"correctAnswers":45,"incorrectAnswers":15,"score":75,"totalAnswers":60,"periodStart":"2026-07-31","periodEnd":"2026-10-28",
                "dataPoints":[{"correctAnswers":20,"incorrectAnswers":10,"score":66.7,"totalAnswers":30,"date":"2026-10-20"},
                {"correctAnswers":25,"incorrectAnswers":5,"score":83.3,"totalAnswers":30,"date":"2026-10-27"}]}""",
        )

    /** Every state a column has: the best, counted ones, one under the minimum (Friday, the evening) and one without answers. */
    override suspend fun patterns(session: AuthenticatedSession): CurrentUserScorePatternsResponsePatterns =
        ApiJson.decodeFromString(
            """{$verdicts,
                "strongestWeekday":{"correctAnswers":46,"incorrectAnswers":4,"score":92,"totalAnswers":50,"dayOfWeek":"tuesday"},
                "weekdays":[{"correctAnswers":39,"incorrectAnswers":11,"score":78,"totalAnswers":50,"dayOfWeek":"sunday"},
                {"correctAnswers":42,"incorrectAnswers":8,"score":84,"totalAnswers":50,"dayOfWeek":"monday"},
                {"correctAnswers":46,"incorrectAnswers":4,"score":92,"totalAnswers":50,"dayOfWeek":"tuesday"},
                {"correctAnswers":40,"incorrectAnswers":10,"score":80,"totalAnswers":50,"dayOfWeek":"wednesday"},
                {"correctAnswers":37,"incorrectAnswers":13,"score":74,"totalAnswers":50,"dayOfWeek":"thursday"},
                {"correctAnswers":5,"incorrectAnswers":2,"score":71.4,"totalAnswers":7,"dayOfWeek":"friday"},
                {"correctAnswers":0,"incorrectAnswers":0,"score":0,"totalAnswers":0,"dayOfWeek":"saturday"}],
                "strongestTime":{"correctAnswers":91,"incorrectAnswers":9,"score":91,"totalAnswers":100,"period":"morning"},
                "times":[{"correctAnswers":0,"incorrectAnswers":0,"score":0,"totalAnswers":0,"period":"night"},
                {"correctAnswers":91,"incorrectAnswers":9,"score":91,"totalAnswers":100,"period":"morning"},
                {"correctAnswers":79,"incorrectAnswers":21,"score":79,"totalAnswers":100,"period":"afternoon"},
                {"correctAnswers":4,"incorrectAnswers":2,"score":66.7,"totalAnswers":6,"period":"evening"}]}""",
        )
}

/** A year of days up to 2026-10-28 from the week's first day, as the API sends them; `ago` counts back from the newest. */
private fun yearOf(day: (LocalDate, Int) -> String): String {
    val newest = LocalDate.of(2026, 10, 28)
    return generateSequence(newest.minusWeeks(52).with(TemporalAdjusters.previousOrSame(DayOfWeek.SUNDAY))) { it.plusDays(1) }
        .takeWhile { !it.isAfter(newest) }
        .joinToString(",") { day(it, ChronoUnit.DAYS.between(it, newest).toInt()) }
}
