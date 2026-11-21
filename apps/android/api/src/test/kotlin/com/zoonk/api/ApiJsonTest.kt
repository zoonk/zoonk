package com.zoonk.api

import com.zoonk.api.models.AnytimeMockInput
import com.zoonk.api.models.AnytimeMockInputShape
import com.zoonk.api.models.AnytimeMockInputShapeAnyOf
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
