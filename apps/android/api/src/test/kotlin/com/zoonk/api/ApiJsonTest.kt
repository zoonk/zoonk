package com.zoonk.api

import com.zoonk.api.models.AnytimeMockInput
import com.zoonk.api.models.MockShape
import org.junit.Assert.assertEquals
import org.junit.Test

class ApiJsonTest {
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
