package com.zoonk.android.data

import androidx.compose.runtime.Stable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue

/**
 * One visit to a screen, and the outcomes of the requests started on it (a navigation, a sheet, a failure line), held
 * as state for that visit (the architecture guide's "UI events": an event the UI must act on is UI state it
 * acknowledges, never a message in a channel, which a recreating screen can drop). A recreation (a width change, a
 * fold, a rotation) is the same visit, so an outcome stays until the screen shown then acts on it. Leaving for real
 * ends the visit ([end]): everything owed to it, failures included, is cleared, and a request it started that lands
 * later shows nothing.
 */
@Stable
class Visit {
    /** The current visit, which a request notes when it starts and hands to [VisitOutcome.send]. */
    var number = 0
        private set

    private val outcomes = mutableListOf<VisitOutcome<*>>()
    private val openings = mutableListOf<Visit>()

    fun <T : Any> outcome(): VisitOutcome<T> = VisitOutcome<T>(this).also { outcomes += it }

    /**
     * A narrower asker inside this visit (an editor, a sheet, a picker): it ends on its own when it closes
     * (a `VisitOf` where it's composed), and with this visit when the screen goes.
     */
    fun opening(): Visit = Visit().also { openings += it }

    fun end() {
        number++
        outcomes.forEach { it.clear() }
        openings.forEach { it.end() }
    }
}

/** One outcome owed to a [Visit]: the screen reads [value], acts, and says so with [acted]; until then it stays. */
@Stable
class VisitOutcome<T : Any> internal constructor(
    private val visit: Visit,
) {
    var value by mutableStateOf<T?>(null)
        private set

    /** Holds [outcome] only while the visit that [started] the request is the current one. */
    fun send(
        started: Int,
        outcome: T,
    ) {
        if (started == visit.number) value = outcome
    }

    /** The screen acted on [outcome]; a newer one sent meanwhile stays. */
    fun acted(outcome: T) {
        if (value === outcome) value = null
    }

    fun clear() {
        value = null
    }
}
