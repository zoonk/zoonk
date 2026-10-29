package com.zoonk.android.ui.components

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.material3.FilledTonalButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.data.ApiException
import com.zoonk.android.data.MutationResult
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.int
import kotlinx.serialization.json.jsonPrimitive

enum class LimitTier { Guest, Free, Plus }

enum class LimitPeriod { Day, Month, Total }

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

/** What ran out: each has main's own words for it. */
enum class LimitSubject { Help, Lessons, MindMaps, Outlines, Calls }

/**
 * Main's limit notice: what ran out and when it comes back, with "Create a free account" for a guest
 * and "See Plus" on Free. Plus and a slow-down only say when.
 */
@Composable
fun LimitNotice(
    limit: Limit,
    subject: LimitSubject,
    onCreateAccount: () -> Unit,
    onSeePlus: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(modifier, verticalArrangement = Arrangement.spacedBy(8.dp), horizontalAlignment = Alignment.Start) {
        Text(
            text = limitMessage(limit, subject),
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            style = MaterialTheme.typography.bodyMedium,
        )

        LimitActions(limit, onCreateAccount, onSeePlus)
    }
}

/** "Create a free account" for a guest, "See Plus" on Free, nothing when the limit only waits. */
@Composable
fun LimitActions(
    limit: Limit,
    onCreateAccount: () -> Unit,
    onSeePlus: () -> Unit,
) {
    when {
        limit.needsAccount -> {
            FilledTonalButton(onClick = onCreateAccount) { Text(stringResource(R.string.limit_create_account)) }
        }

        limit is Limit.Reached && limit.tier == LimitTier.Free -> {
            FilledTonalButton(onClick = onSeePlus) { Text(stringResource(R.string.limit_see_plus)) }
        }
    }
}

val Limit.needsAccount: Boolean
    get() = this == Limit.SignUpRequired || (this is Limit.Reached && tier == LimitTier.Guest)

@Composable
fun limitMessage(
    limit: Limit,
    subject: LimitSubject,
): String =
    when (limit) {
        is Limit.SlowDown -> stringResource(R.string.limit_slow_down)
        Limit.SignUpRequired -> stringResource(R.string.limit_sign_up_required)
        is Limit.Reached -> reachedMessage(limit.tier, limit.period ?: LimitPeriod.Day, subject)
    }

@Composable
private fun reachedMessage(
    tier: LimitTier,
    period: LimitPeriod,
    subject: LimitSubject,
): String {
    val month = period != LimitPeriod.Day

    return stringResource(
        when (subject) {
            LimitSubject.Help -> {
                when (tier) {
                    LimitTier.Guest -> if (month) R.string.limit_help_guest_total else R.string.limit_help_guest_day
                    LimitTier.Plus -> R.string.limit_help_plus
                    LimitTier.Free -> if (month) R.string.limit_help_free_month else R.string.limit_help_free_day
                }
            }

            LimitSubject.Lessons -> {
                when (tier) {
                    LimitTier.Guest -> {
                        R.string.limit_lessons_guest
                    }

                    LimitTier.Plus -> {
                        R.string.limit_lessons_plus
                    }

                    LimitTier.Free -> {
                        if (period ==
                            LimitPeriod.Month
                        ) {
                            R.string.limit_lessons_free_month
                        } else {
                            R.string.limit_lessons_free_day
                        }
                    }
                }
            }

            LimitSubject.MindMaps -> {
                when (tier) {
                    LimitTier.Guest -> {
                        R.string.limit_mind_maps_guest
                    }

                    LimitTier.Plus -> {
                        R.string.limit_mind_maps_plus
                    }

                    LimitTier.Free -> {
                        if (period ==
                            LimitPeriod.Month
                        ) {
                            R.string.limit_mind_maps_free_month
                        } else {
                            R.string.limit_mind_maps_free_day
                        }
                    }
                }
            }

            LimitSubject.Outlines -> {
                when (tier) {
                    LimitTier.Guest -> {
                        R.string.limit_outlines_guest
                    }

                    LimitTier.Plus -> {
                        R.string.limit_outlines_plus
                    }

                    LimitTier.Free -> {
                        if (period ==
                            LimitPeriod.Month
                        ) {
                            R.string.limit_outlines_free_month
                        } else {
                            R.string.limit_outlines_free_day
                        }
                    }
                }
            }

            LimitSubject.Calls -> {
                when (tier) {
                    LimitTier.Guest -> R.string.limit_calls_guest
                    LimitTier.Plus -> if (period == LimitPeriod.Month) R.string.limit_calls_plus_month else R.string.limit_calls_plus_day
                    LimitTier.Free -> if (period == LimitPeriod.Month) R.string.limit_calls_free_month else R.string.limit_calls_free_day
                }
            }
        },
    )
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
