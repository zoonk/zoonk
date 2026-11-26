package com.zoonk.api

import com.zoonk.api.models.AnytimeMockInput
import com.zoonk.api.models.AnytimeMockInputShape
import com.zoonk.api.models.AnytimeMockInputShapeAnyOf
import com.zoonk.api.models.MatchAnswer
import com.zoonk.api.models.MistakePracticePracticeInnerQuestionsInner
import com.zoonk.api.models.WrittenTestShape
import kotlinx.serialization.Serializable
import org.junit.Assert.assertEquals
import org.junit.Test

class ApiJsonTest {
    @Serializable
    private data class OlderResponse(
        val studied: Boolean,
    )

    @Test
    fun anOlderResponseModelIgnoresFieldsAddedByTheServer() {
        val response = ApiJson.decodeFromString<OlderResponse>("""{"studied":true,"targetDateEstimated":true,"days":[]}""")
        assertEquals(OlderResponse(studied = true), response)
    }

    @Test
    fun notebookMatchReadsTheShownKeyAndWritesMissesInOrder() {
        val question =
            ApiJson.decodeFromString<MistakePracticePracticeInnerQuestionsInner>(
                """{"format":"matchPairs","itemId":"3b4c3e1a-1c2d-4e5f-8a9b-0c1d2e3f4a5b","key":[1,0],"left":["Mars","Moon"],"question":"Match the names.","right":["Satellite","Planet"],"skillId":"5b4c3e1a-1c2d-4e5f-8a9b-0c1d2e3f4a5b"}""",
            )
        assertEquals(listOf(1L, 0L), question.key)

        val reported = """{"matches":[1,0],"misses":[{"left":1,"right":1},{"left":0,"right":0}]}"""
        val answer = ApiJson.decodeFromString<MatchAnswer>(reported)
        assertEquals(reported, ApiRequestJson.encodeToString(MatchAnswer.serializer(), answer))
        assertEquals("""{"matches":[1,0]}""", ApiRequestJson.encodeToString(MatchAnswer(listOf(1L, 0L))))
    }

    @Test
    fun aBodyKeepsTheNullsItsContractRequiresAndLeavesOutWhatItDoesNotSet() {
        val half =
            AnytimeMockInputShape.AnytimeMockInputShapeAnyOfValue(
                AnytimeMockInputShapeAnyOf(area = null, day = null, kind = AnytimeMockInputShapeAnyOf.Kind.HALF),
            )
        assertEquals(
            """{"shape":{"area":null,"day":null,"kind":"half"}}""",
            ApiRequestJson.encodeToString(AnytimeMockInput.serializer(), AnytimeMockInput(shape = half)),
        )
    }

    @Test
    fun theWrittenTestIsSentAsItsOwnShape() {
        val written =
            AnytimeMockInputShape.WrittenTestShapeValue(
                WrittenTestShape(area = null, day = null, kind = WrittenTestShape.Kind.WRITTEN),
            )
        assertEquals(
            """{"shape":{"area":null,"day":null,"kind":"written"}}""",
            ApiRequestJson.encodeToString(AnytimeMockInput.serializer(), AnytimeMockInput(shape = written)),
        )
    }
}
