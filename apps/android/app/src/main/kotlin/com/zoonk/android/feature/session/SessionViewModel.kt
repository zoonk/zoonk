package com.zoonk.android.feature.session

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.zoonk.android.data.MutationResult
import com.zoonk.android.navigation.AppRoute
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.receiveAsFlow
import kotlinx.coroutines.launch
import java.util.UUID

enum class SessionAction { Start, KeepGoing, ExtraTime }

/** The session screen's taps, one at a time: its only writes, so opening the screen changes nothing. */
class SessionViewModel(
    private val opener: StudyOpener,
) : ViewModel() {
    var busy by mutableStateOf<SessionAction?>(null)
        private set

    var failed by mutableStateOf<SessionAction?>(null)
        private set

    private val opened = Channel<AppRoute>(Channel.BUFFERED)

    /** Where a tap leads, in place of the session screen. */
    val routes: Flow<AppRoute> = opened.receiveAsFlow()

    fun start(
        day: DayView,
        step: DayStep,
        goalId: UUID,
    ) = run(SessionAction.Start) { opener.open(day, step, next = true, goalId = goalId) }

    fun keepGoing(sessionId: UUID) = run(SessionAction.KeepGoing) { opener.continueSession(sessionId) }

    fun extraTime(
        day: DayView,
        goalId: UUID,
    ) = run(SessionAction.ExtraTime) { opener.addExtraTime(day, goalId) }

    /** A null route means the day changed meanwhile: its read refreshes, and nothing opens. */
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
                    result.value?.let { opened.send(it) }
                }

                is MutationResult.Failed -> {
                    failed = action
                }

                MutationResult.Obsolete -> {}
            }
        }
    }
}
