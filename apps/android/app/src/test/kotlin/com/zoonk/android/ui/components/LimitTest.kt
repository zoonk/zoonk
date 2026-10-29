package com.zoonk.android.ui.components

import com.zoonk.android.data.ApiError
import com.zoonk.android.data.ApiException
import kotlinx.serialization.json.Json
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class LimitTest {
    private fun refusal(
        code: String?,
        details: String? = null,
    ) = ApiException(ApiError.Unavailable, code, status = 403, details = details?.let(Json::parseToJsonElement))

    @Test
    fun readsTheApisRefusals() {
        assertEquals(Limit.SignUpRequired, Limit.of(refusal("SIGN_UP_REQUIRED")))
        assertEquals(Limit.SlowDown(30), Limit.of(refusal("SLOW_DOWN", """{"retryAfterSeconds":30}""")))
        assertEquals(
            Limit.Reached(LimitTier.Free, LimitPeriod.Month),
            Limit.of(refusal("USAGE_LIMIT_REACHED", """{"limit":{"period":"month","tier":"free"}}""")),
        )
        assertEquals(Limit.Reached(LimitTier.Guest), Limit.of(refusal("USAGE_LIMIT_REACHED", """{"limit":{"tier":"guest"}}""")))
    }

    @Test
    fun anyOtherErrorIsNoLimit() {
        assertNull(Limit.of(refusal("PLUS_REQUIRED")))
        assertNull(Limit.of(refusal(null)))
        assertNull(Limit.of(refusal("USAGE_LIMIT_REACHED", """{"limit":{"tier":"enterprise"}}""")))
    }

    @Test
    fun aGuestNeedsAnAccountAndFreeOrPlusDoesnt() {
        assertTrue(Limit.SignUpRequired.needsAccount)
        assertTrue(Limit.Reached(LimitTier.Guest, LimitPeriod.Day).needsAccount)
        assertFalse(Limit.Reached(LimitTier.Free).needsAccount)
        assertFalse(Limit.SlowDown(5).needsAccount)
    }
}
