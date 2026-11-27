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
        assertLessonUnavailable("""{"kind":"futureQuestion"}""")
    }

    @Test
    fun aCodeRunnerInAnUnsupportedLanguageCannotStart() {
        assertLessonUnavailable(
            """
            {"id":"00000000-0000-4000-8000-000000000002","position":1,"imagePending":false,"kind":"activity",
             "content":{"template":"codeRunner","prompt":"Run","check":{"kind":"interaction","explanation":"Output"},
             "fields":{"language":"futureLanguage","editableLines":[1],"expectedOutput":"1","mistakes":[],
             "starterCode":"print(0)","solution":"print(1)"}}}
            """.trimIndent(),
        )
    }

    private fun assertLessonUnavailable(unsupported: String) {
        val check = fixture("mistake-practice-lesson-entry").getValue("lesson").jsonObject.getValue("step")
        val lesson =
            """
            {"id":"00000000-0000-4000-8000-000000000001","description":"","estimatedMinutes":1,
             "language":"en","title":"Test","level":"beginner","skills":[],"steps":[$check,$unsupported]}
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
