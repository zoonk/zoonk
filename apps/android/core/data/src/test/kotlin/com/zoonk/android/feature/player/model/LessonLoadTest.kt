package com.zoonk.android.feature.player.model

import com.zoonk.android.data.ApiError
import com.zoonk.android.data.ApiException
import com.zoonk.android.feature.session.fixture
import com.zoonk.api.ApiJson
import com.zoonk.api.models.ExplanationLesson
import com.zoonk.api.models.PlayableLibraryLessonResponse
import com.zoonk.api.models.PlayableLibraryStep
import kotlinx.serialization.json.jsonObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
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

    @Test
    fun anInteractionWithAnUnknownChordQualityCannotStart() {
        val step =
            """
            {"id":"00000000-0000-4000-8000-000000000002","position":1,"imagePending":false,"kind":"activity",
             "content":{"template":"keyboardFretboard","prompt":"unknown_default_open_api",
             "check":{"kind":"interaction","explanation":"Play the chord"},
             "fields":{"instruments":["piano"],"target":{"kind":"chord","root":"C","quality":"major"}}}}
            """.trimIndent()
        val known = ApiJson.decodeFromString<PlayableLibraryStep>(step)
        assertEquals(StepKind.Activity, known.toLessonStep().kind)
        val instruments = step.replace(""""piano"""", """"futureInstrument","piano"""")
        assertEquals(StepKind.Activity, ApiJson.decodeFromString<PlayableLibraryStep>(instruments).toLessonStep().kind)
        assertLessonUnavailable(step.replace("piano", "futureInstrument"))
        val unknown = step.replace("major", "futureQuality")
        assertLessonUnavailable(unknown)

        val choice =
            unknown.replace(
                """{"kind":"interaction","explanation":"Play the chord"}""",
                """{"kind":"choice","question":"Which chord?","options":[{"id":"a","text":"C","reason":"C major","isCorrect":true}]}""",
            )
        val activity = ApiJson.decodeFromString<PlayableLibraryStep>(choice).toLessonStep().content as StepContent.Activity
        assertFalse(activity.frame.hasSupportedCanvas)
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
