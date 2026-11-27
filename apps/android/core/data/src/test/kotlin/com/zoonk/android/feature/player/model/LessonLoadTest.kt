package com.zoonk.android.feature.player.model

import com.zoonk.android.data.ApiError
import com.zoonk.android.data.ApiException
import com.zoonk.android.feature.session.fixture
import com.zoonk.api.ApiJson
import com.zoonk.api.models.ExplanationLesson
import com.zoonk.api.models.PlayableLibraryLessonResponse
import kotlinx.serialization.json.jsonObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Test

class LessonLoadTest {
    @Test
    fun aLessonWithAnUnsupportedStepCannotStartWithAnIncompleteQueue() {
        val check = fixture("mistake-practice-lesson-entry").getValue("lesson").jsonObject.getValue("step")
        val lesson =
            """
            {"id":"00000000-0000-4000-8000-000000000001","description":"","estimatedMinutes":1,
             "language":"en","title":"Test","level":"beginner","skills":[],"steps":[$check,{"kind":"futureQuestion"}]}
            """.trimIndent()
        val library =
            ApiJson.decodeFromString<PlayableLibraryLessonResponse>(
                """{"status":"ready","lesson":$lesson,"tutorSuggestions":[]}""",
            )
        val explanation = ApiJson.decodeFromString<ExplanationLesson>(lesson)

        assertEquals(ApiError.Unavailable, assertThrows(ApiException::class.java) { library.toLessonLoad() }.error)
        assertEquals(ApiError.Unavailable, assertThrows(ApiException::class.java) { explanation.toPlayableLesson() }.error)
    }
}
