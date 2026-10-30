package com.zoonk.android.feature.catalog

import com.zoonk.android.data.ApiError
import com.zoonk.android.data.LoadState
import com.zoonk.android.data.summary
import com.zoonk.api.ApiJson
import com.zoonk.api.models.CourseChapter
import com.zoonk.api.models.LearnerSummaryGoal
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class CourseOutlineLevelTest {
    private fun goal(
        courseId: String,
        level: String?,
    ): LearnerSummaryGoal =
        ApiJson.decodeFromString(
            """
            {"courseChapterId":null,"courseId":"$courseId","courseLevel":${level?.let { "\"$it\"" } ?: "null"},"dailyMinutes":15,
             "id":"7a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d","isActive":true,"isSettingUp":false,"kind":"learn","status":"active",
             "targetDate":null,"targetLanguage":null,"title":"Atoms"}
            """.trimIndent(),
        )

    private fun learner(vararg goals: LearnerSummaryGoal) =
        LoadState.Loaded(summary(readAt = 0, nextChangeAt = 0).copy(goals = goals.toList()))

    @Test
    fun aVisitorSeesTheFirstLevelOpen() {
        assertEquals(CourseChapter.Level.OVERVIEW, outlineLevel(chapters(), COURSE, hasSession = false, summary = LoadState.Idle))
    }

    @Test
    fun aSessionKeepsEveryLevelClosedUntilItsSummaryArrives() {
        assertNull(outlineLevel(chapters(), COURSE, hasSession = true, summary = LoadState.Idle))
        assertNull(outlineLevel(chapters(), COURSE, hasSession = true, summary = LoadState.Loading))
    }

    @Test
    fun aSummaryThatCantBeReadOpensTheFirstLevel() {
        assertEquals(
            CourseChapter.Level.OVERVIEW,
            outlineLevel(chapters(), COURSE, hasSession = true, summary = LoadState.Failed(ApiError.Network)),
        )
    }

    @Test
    fun aPlanOnTheCourseOpensAtItsLevelAndAnyOtherLearnerSeesTheFirst() {
        assertEquals(
            CourseChapter.Level.BEGINNER,
            outlineLevel(chapters(), COURSE, hasSession = true, summary = learner(goal(COURSE, "beginner"))),
        )
        assertEquals(
            CourseChapter.Level.OVERVIEW,
            outlineLevel(chapters(), COURSE, hasSession = true, summary = learner(goal(OTHER_COURSE, "beginner"), goal(COURSE, null))),
        )
    }

    private companion object {
        const val OTHER_COURSE = "33333333-3333-4333-8333-333333333333"
    }
}
