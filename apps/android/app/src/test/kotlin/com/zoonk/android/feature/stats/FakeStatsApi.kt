package com.zoonk.android.feature.stats

import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.api.ApiJson
import com.zoonk.api.models.CurrentUserActivityResponseActivity
import com.zoonk.api.models.CurrentUserEnergyResponseEnergy
import com.zoonk.api.models.CurrentUserProgressResponse
import com.zoonk.api.models.CurrentUserScorePatternsResponsePatterns
import com.zoonk.api.models.CurrentUserScoreResponseScore

internal class FakeStatsApi(
    val studied: Boolean,
) : StatsApi {
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
            """{"currentEnergy":64,"days":[{"date":"2026-10-27","energy":50},{"date":"2026-10-28","energy":64}],"insights":{"averageEnergy":58,"fullEnergyDays":2}}""",
        )

    override suspend fun activity(session: AuthenticatedSession): CurrentUserActivityResponseActivity =
        ApiJson.decodeFromString(
            """{"learningDays":12,"totalLearningSeconds":5400,"totalLessonCompletions":20,
                "days":[{"activitiesCompleted":3,"date":"2026-10-27","lessonCompletions":2},{"activitiesCompleted":5,"date":"2026-10-28","lessonCompletions":3}]}""",
        )

    override suspend fun score(session: AuthenticatedSession): CurrentUserScoreResponseScore =
        ApiJson.decodeFromString(
            """{"correctAnswers":45,"incorrectAnswers":15,"score":75,"totalAnswers":60,"periodStart":"2026-07-31","periodEnd":"2026-10-28",
                "dataPoints":[{"correctAnswers":20,"incorrectAnswers":10,"score":66.7,"totalAnswers":30,"date":"2026-10-20"},
                {"correctAnswers":25,"incorrectAnswers":5,"score":83.3,"totalAnswers":30,"date":"2026-10-27"}]}""",
        )

    override suspend fun patterns(session: AuthenticatedSession): CurrentUserScorePatternsResponsePatterns =
        ApiJson.decodeFromString(
            """{"strongestWeekday":{"correctAnswers":18,"incorrectAnswers":2,"score":90,"totalAnswers":20,"dayOfWeek":"tuesday"},
                "weekdays":[{"correctAnswers":18,"incorrectAnswers":2,"score":90,"totalAnswers":20,"dayOfWeek":"tuesday"},
                {"correctAnswers":12,"incorrectAnswers":8,"score":60,"totalAnswers":20,"dayOfWeek":"friday"}],"times":[]}""",
        )
}
