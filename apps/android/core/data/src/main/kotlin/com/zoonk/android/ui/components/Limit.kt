package com.zoonk.android.ui.components

import com.zoonk.android.data.ApiException
import com.zoonk.android.data.MutationResult
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.int
import kotlinx.serialization.json.jsonPrimitive
import java.time.Instant

enum class LimitTier { Guest, Free, Plus }

/** [Rolling30Days] counts the last 30 days: each use comes back 30 days after it was made. */
enum class LimitPeriod { Day, Rolling30Days, Total }

/** What ran out: [Help] is anything else the day's AI budget stops (a spoken answer's check, a clip). */
enum class LimitSubject { Help, Messages, Explanations, Lessons, MapLessons, MindMaps, Outlines, Calls, MockExams, Uploads, Questions }

sealed interface Limit {
    data class SlowDown(
        val retryAfterSeconds: Int,
    ) : Limit

    /** Help without a `period` was the day's; [availableAt] is when the next one opens, where the API says. */
    data class Reached(
        val tier: LimitTier,
        val period: LimitPeriod? = null,
        val availableAt: Instant? = null,
    ) : Limit

    data object SignUpRequired : Limit

    companion object {
        /**
         * The API's refusal (`SLOW_DOWN`, `USAGE_LIMIT_REACHED`, `SIGN_UP_REQUIRED`) as received at [receivedAt]
         * ([Reached.received]), or null for any other error.
         */
        fun of(
            error: ApiException,
            receivedAt: Instant = Instant.now(),
        ): Limit? = of(error.code, error.status, error.details, receivedAt)

        fun of(
            failed: MutationResult.Failed,
            receivedAt: Instant = Instant.now(),
        ): Limit? = of(failed.code, failed.status, failed.details, receivedAt)

        private fun of(
            code: String?,
            status: Int?,
            details: JsonElement?,
            receivedAt: Instant,
        ): Limit? =
            when (code) {
                "SIGN_UP_REQUIRED" -> {
                    SignUpRequired
                }

                "SLOW_DOWN" -> {
                    SlowDown(
                        details
                            ?.field("retryAfterSeconds")
                            ?.jsonPrimitive
                            ?.int ?: DEFAULT_RETRY_SECONDS,
                    )
                }

                "USAGE_LIMIT_REACHED" -> {
                    val limit = details?.field("limit")
                    val tier =
                        limit
                            ?.field("tier")
                            ?.jsonPrimitive
                            ?.content
                            ?.let { LimitTier.entries.named(it) }
                    val period =
                        limit
                            ?.field("period")
                            ?.jsonPrimitive
                            ?.content
                            ?.let { LimitPeriod.entries.named(it) }
                    val availableAt =
                        limit
                            ?.field("availableAt")
                            ?.jsonPrimitive
                            ?.contentOrNull
                            ?.let { runCatching { Instant.parse(it) }.getOrNull() }
                    // Like main's readRefusedLimit, the status says whose cap it was when the details don't.
                    Reached(tier ?: tierOf(status), period, availableAt).received(receivedAt)
                }

                else -> {
                    null
                }
            }
    }
}

/**
 * As this device received it (main's `receivedAt`): a day already past on arrival comes from a clock that
 * disagrees with the server's, so the refusal keeps no day and its gate stands until the next try.
 */
fun Limit.Reached.received(now: Instant = Instant.now()): Limit.Reached =
    if (availableAt?.isAfter(now) == false) copy(availableAt = null) else this

private const val DEFAULT_RETRY_SECONDS = 60

private fun tierOf(status: Int?): LimitTier =
    when (status) {
        403 -> LimitTier.Guest
        402 -> LimitTier.Free
        else -> LimitTier.Plus
    }

private fun JsonElement.field(name: String) = (this as? JsonObject)?.get(name)

private fun <E : Enum<E>> List<E>.named(value: String): E? = firstOrNull { it.name.equals(value, ignoreCase = true) }
