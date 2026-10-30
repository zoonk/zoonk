package com.zoonk.android.feature.session

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.zoonk.android.data.MutationResult
import com.zoonk.android.data.value
import com.zoonk.android.navigation.AppRoute
import com.zoonk.api.models.Milestone
import kotlinx.coroutines.Job
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.receiveAsFlow
import kotlinx.coroutines.launch
import java.util.UUID

enum class SessionAction { Start, Stop, KeepGoing, ExtraTime }

/**
 * The session screen's taps, one at a time (its only writes, so opening the screen changes nothing),
 * and what the screen keeps across a rotation.
 */
class SessionViewModel(
    private val opener: StudyOpener,
    private val sessions: StudySessionStore,
) : ViewModel() {
    var busy by mutableStateOf<SessionAction?>(null)
        private set

    var failed by mutableStateOf<SessionAction?>(null)
        private set

    private var heldCeremony by mutableStateOf<Milestone?>(null)
    private var ceremonyClosed by mutableStateOf(false)
    private var rereading: Job? = null

    private val opened = Channel<AppRoute>(Channel.BUFFERED)

    /** Where a tap leads, in place of the session screen. */
    val routes: Flow<AppRoute> = opened.receiveAsFlow()

    /**
     * The ceremony to show over a summary whose read has [read], held from [holdCeremony] until
     * [closeCeremony]: showing it marks it shown, so reading the summary again leaves it out.
     */
    fun ceremony(read: Milestone?): Milestone? = heldCeremony ?: read?.takeUnless { ceremonyClosed }

    fun holdCeremony(milestone: Milestone) {
        if (!ceremonyClosed) heldCeremony = milestone
    }

    fun closeCeremony() {
        heldCeremony = null
        ceremonyClosed = true
    }

    /**
     * A summary with work left was read before that work was added elsewhere: reading the day and the
     * summary again shows it. A day still without a next step leaves out work Today replaces, such as
     * a challenge Plus no longer covers, so the learner goes there.
     */
    fun readUnfinished(sessionId: UUID) {
        if (rereading?.isActive == true) return

        rereading =
            viewModelScope.launch {
                val day = sessions.day[sessionId]
                val summary = sessions.summary[sessionId]
                day.refresh()
                summary.refresh()
                val dayNow = day.state.value.value
                val summaryNow = summary.state.value.value
                if (dayNow?.nextBlockId == null && summaryNow?.finished == false) opened.send(AppRoute.Today)
            }
    }

    fun start(
        day: DayView,
        step: DayStep,
        goalId: UUID,
    ) = run(SessionAction.Start) { opener.open(day, step, next = true, goalId = goalId) }

    fun stop(sessionId: UUID) = run(SessionAction.Stop) { opener.stop(sessionId) }

    fun keepGoing(sessionId: UUID) = run(SessionAction.KeepGoing) { opener.continueSession(sessionId) }

    fun extraTime(
        day: DayView,
        goalId: UUID,
    ) = run(SessionAction.ExtraTime) { opener.addExtraTime(day, goalId) }

    /** A null route means the step can't open now (the day changed, its limit, earlier work first), which Today explains. */
    private fun run(
        action: SessionAction,
        write: suspend () -> MutationResult<AppRoute?>,
    ) {
        if (busy != null) return
        busy = action
        failed = null

        viewModelScope.launch {
            val result = write()
            busy = null
            when (result) {
                is MutationResult.Done -> {
                    opened.send(result.value ?: AppRoute.Today)
                }

                is MutationResult.Failed -> {
                    failed = action
                }

                MutationResult.Obsolete -> {}
            }
        }
    }
}
