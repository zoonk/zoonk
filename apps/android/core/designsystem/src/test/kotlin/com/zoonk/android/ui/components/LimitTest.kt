package com.zoonk.android.ui.components

import com.zoonk.android.data.ApiError
import com.zoonk.android.data.ApiException
import kotlinx.serialization.json.Json
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test
import java.time.Instant

class LimitTest {
    /** When each refusal arrived: before every day the fixtures give, whatever the machine's date. */
    private val received = Instant.parse("2026-11-15T12:00:00Z")

    private fun refused(
        code: String?,
        details: String? = null,
        status: Int = 403,
    ) = Limit.of(ApiException(ApiError.Unavailable, code, status = status, details = details?.let(Json::parseToJsonElement)), received)

    @Test
    fun readsTheApisRefusals() {
        assertEquals(Limit.SignUpRequired, refused("SIGN_UP_REQUIRED"))
        assertEquals(Limit.SlowDown(30), refused("SLOW_DOWN", """{"retryAfterSeconds":30}"""))
        assertEquals(
            Limit.Reached(LimitTier.Free, LimitPeriod.Rolling30Days, Instant.parse("2026-12-29T12:00:00Z")),
            refused(
                "USAGE_LIMIT_REACHED",
                """{"limit":{"availableAt":"2026-12-29T12:00:00.000Z","limit":10,"period":"rolling30Days","resource":"mindMap","tier":"free"}}""",
            ),
        )
        assertEquals(Limit.Reached(LimitTier.Guest), refused("USAGE_LIMIT_REACHED", """{"limit":{"tier":"guest"}}"""))
    }

    @Test
    fun aFreeLessonRefusalSaysWhenTheNextOneOpens() {
        assertEquals(
            Limit.Reached(LimitTier.Free, LimitPeriod.Rolling30Days, Instant.parse("2026-12-02T09:15:00Z")),
            refused(
                "USAGE_LIMIT_REACHED",
                """{"limit":{"availableAt":"2026-12-02T09:15:00Z","limit":20,"period":"rolling30Days","resource":"lessonStart","tier":"free"}}""",
                402,
            ),
        )
    }

    /** The device's clock is ahead of the server's: a day already past when the refusal arrives isn't kept, so its gate stands. */
    @Test
    fun aDayPastOnArrivalIsDropped() {
        val refusal = Limit.Reached(LimitTier.Free, LimitPeriod.Rolling30Days, received)

        assertEquals(Limit.Reached(LimitTier.Free, LimitPeriod.Rolling30Days), refusal.received(received))
        assertEquals(refusal, refusal.received(received.minusMillis(1)))
        assertEquals(
            Limit.Reached(LimitTier.Free, LimitPeriod.Rolling30Days),
            refused(
                "USAGE_LIMIT_REACHED",
                """{"limit":{"availableAt":"2026-11-15T11:59:59Z","period":"rolling30Days","tier":"free"}}""",
                402,
            ),
        )
    }

    @Test
    fun withoutDetailsTheStatusSaysWhoseCapItWasAsOnMain() {
        assertEquals(Limit.Reached(LimitTier.Guest), refused("USAGE_LIMIT_REACHED", status = 403))
        assertEquals(Limit.Reached(LimitTier.Free), refused("USAGE_LIMIT_REACHED", status = 402))
        assertEquals(Limit.Reached(LimitTier.Plus), refused("USAGE_LIMIT_REACHED", status = 429))
        assertEquals(Limit.Reached(LimitTier.Free), refused("USAGE_LIMIT_REACHED", """{"limit":{"tier":"enterprise"}}""", 402))
        assertEquals(Limit.SlowDown(60), refused("SLOW_DOWN", status = 429))
    }

    @Test
    fun anyOtherErrorIsNoLimit() {
        assertNull(refused("PLUS_REQUIRED"))
        assertNull(refused(null))
    }
}
