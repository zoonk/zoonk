package com.zoonk.android.ui.components

import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.LifecycleEventEffect
import kotlinx.coroutines.delay
import java.time.Duration
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId

/** When the next free lesson opens, in the learner's own calendar (main's `toOpeningDay`). */
sealed interface OpeningDay {
    /** The instant has passed: the lesson can be asked for again. */
    data object Open : OpeningDay

    data object Today : OpeningDay

    data object Tomorrow : OpeningDay

    data class On(
        val date: LocalDate,
    ) : OpeningDay
}

fun openingDay(
    at: Instant,
    now: Instant = Instant.now(),
    zone: ZoneId = ZoneId.systemDefault(),
): OpeningDay {
    if (!at.isAfter(now)) return OpeningDay.Open
    val day = at.atZone(zone).toLocalDate()
    val today = now.atZone(zone).toLocalDate()
    return when {
        !day.isAfter(today) -> OpeningDay.Today
        day == today.plusDays(1) -> OpeningDay.Tomorrow
        else -> OpeningDay.On(day)
    }
}

/** When the open gate reads its day again (main's `watchOpeningClock`): the next local midnight, where "tomorrow" becomes "today", or [at], whichever comes first. */
fun nextLook(
    at: Instant,
    now: Instant,
    zone: ZoneId = ZoneId.systemDefault(),
): Instant =
    minOf(
        at,
        now
            .atZone(zone)
            .toLocalDate()
            .plusDays(1)
            .atStartOfDay(zone)
            .toInstant(),
    )

/**
 * Main's `useOpeningDay`: the day follows the clock while the screen is open, so a passed instant stops
 * being promised. It looks again at each local midnight and the instant, and whenever the app comes back
 * to the front (a phone that slept).
 */
@Composable
fun rememberOpeningDay(at: Instant?): OpeningDay? {
    var looks by remember(at) { mutableIntStateOf(0) }
    LifecycleEventEffect(Lifecycle.Event.ON_START) { looks++ }
    LaunchedEffect(at) {
        while (at != null && at.isAfter(Instant.now())) {
            val now = Instant.now()
            delay(Duration.between(now, nextLook(at, now)).toMillis().coerceAtLeast(1))
            looks++
        }
    }
    return remember(at, looks) { at?.let { openingDay(it) } }
}
