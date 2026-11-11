package com.zoonk.android.ui.components

import com.zoonk.android.data.ApiException
import com.zoonk.android.data.MutationResult
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.int
import kotlinx.serialization.json.jsonPrimitive

enum class LimitTier { Guest, Free, Plus }

enum class LimitPeriod { Day, Month, Total }

enum class LimitSubject { Help, Lessons, MindMaps, Outlines, Calls }

sealed interface Limit {
    data class SlowDown(
        val retryAfterSeconds: Int,
    ) : Limit

    /** Help without a `period` was the day's. */
    data class Reached(
        val tier: LimitTier,
        val period: LimitPeriod? = null,
    ) : Limit

    data object SignUpRequired : Limit

    companion object {
        /** The API's refusal (`SLOW_DOWN`, `USAGE_LIMIT_REACHED`, `SIGN_UP_REQUIRED`), or null for any other error. */
        fun of(error: ApiException): Limit? = of(error.code, error.status, error.details)

        fun of(failed: MutationResult.Failed): Limit? = of(failed.code, failed.status, failed.details)

        private fun of(
            code: String?,
            status: Int?,
            details: JsonElement?,
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
                    // Like main's readRefusedLimit, the status says whose cap it was when the details don't.
                    Reached(tier ?: tierOf(status), period)
                }

                else -> {
                    null
                }
            }
    }
}

private const val DEFAULT_RETRY_SECONDS = 60

private fun tierOf(status: Int?): LimitTier =
    when (status) {
        403 -> LimitTier.Guest
        402 -> LimitTier.Free
        else -> LimitTier.Plus
    }

private fun JsonElement.field(name: String) = (this as? JsonObject)?.get(name)

private fun <E : Enum<E>> List<E>.named(value: String): E? = firstOrNull { it.name.equals(value, ignoreCase = true) }
