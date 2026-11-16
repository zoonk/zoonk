package com.zoonk.api

import com.zoonk.api.models.AnytimeMockInput
import com.zoonk.api.models.MockShape
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
        val body =
            AnytimeMockInput(shape = MockShape(area = null, day = null, kind = MockShape.Kind.HALF))
        assertEquals(
            """{"shape":{"area":null,"day":null,"kind":"half"}}""",
            ApiRequestJson.encodeToString(AnytimeMockInput.serializer(), body),
        )
    }
}
