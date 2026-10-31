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
        status: Int = 403,
    ) = ApiException(ApiError.Unavailable, code, status = status, details = details?.let(Json::parseToJsonElement))

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
    fun withoutDetailsTheStatusSaysWhoseCapItWasAsOnMain() {
        assertEquals(Limit.Reached(LimitTier.Guest), Limit.of(refusal("USAGE_LIMIT_REACHED", status = 403)))
        assertEquals(Limit.Reached(LimitTier.Free), Limit.of(refusal("USAGE_LIMIT_REACHED", status = 402)))
        assertEquals(Limit.Reached(LimitTier.Plus), Limit.of(refusal("USAGE_LIMIT_REACHED", status = 429)))
        assertEquals(Limit.Reached(LimitTier.Free), Limit.of(refusal("USAGE_LIMIT_REACHED", """{"limit":{"tier":"enterprise"}}""", 402)))
        assertEquals(Limit.SlowDown(60), Limit.of(refusal("SLOW_DOWN", status = 429)))
    }

    @Test
    fun anyOtherErrorIsNoLimit() {
        assertNull(Limit.of(refusal("PLUS_REQUIRED")))
        assertNull(Limit.of(refusal(null)))
    }

    @Test
    fun aGuestNeedsAnAccountAndFreeOrPlusDoesnt() {
        assertTrue(Limit.SignUpRequired.needsAccount)
        assertTrue(Limit.Reached(LimitTier.Guest, LimitPeriod.Day).needsAccount)
        assertFalse(Limit.Reached(LimitTier.Free).needsAccount)
        assertFalse(Limit.SlowDown(5).needsAccount)
    }
}
