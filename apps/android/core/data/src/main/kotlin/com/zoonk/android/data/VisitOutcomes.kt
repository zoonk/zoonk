package com.zoonk.android.data

import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.receiveAsFlow

/**
 * What follows a request a screen started (a navigation, a sheet), owed to the visit that started it. A
 * recreation (a width change, a fold, a rotation) is the same visit, so the outcome still arrives, once, at
 * whichever screen shows it then. Leaving for real ends the visit ([endVisit]): a late outcome opens nothing,
 * and the next visit starts clean.
 */
class VisitOutcomes<T> {
    private val channel = Channel<T>(Channel.UNLIMITED)

    /** The current visit, which a request notes when it starts and hands to [send]. */
    var visit = 0
        private set

    val outcomes: Flow<T> = channel.receiveAsFlow()

    /** Delivers [outcome] only while the visit that [started] the request is the current one. */
    fun send(
        started: Int,
        outcome: T,
    ) {
        if (started == visit) channel.trySend(outcome)
    }

    /** The learner left for real: outcomes still owed to this visit, delivered or not, open nothing. */
    fun endVisit() {
        visit++
        do {
            val drained = channel.tryReceive().isSuccess
        } while (drained)
    }
}
