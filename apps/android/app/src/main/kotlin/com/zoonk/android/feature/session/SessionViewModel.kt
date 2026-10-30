package com.zoonk.android.feature.session

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.MutationResult
import com.zoonk.android.data.value
import com.zoonk.android.feature.player.LessonWritingApi
import com.zoonk.android.navigation.AppRoute
import com.zoonk.api.models.LessonReadiness
import com.zoonk.api.models.Milestone
import kotlinx.coroutines.Job
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.receiveAsFlow
import kotlinx.coroutines.launch
import java.util.UUID

enum class SessionAction { Start, Stop, KeepGoing, ExtraTime }

/**
 * The session screen's taps, one at a time, and what the screen keeps across a rotation. Opening
 * the screen writes nothing but, once a lesson the learner waited on is written, how long that took.
 */
class SessionViewModel(
    private val opener: StudyOpener,
    private val sessions: StudySessionStore,
    private val writingApi: LessonWritingApi,
    private val cache: AppCache,
    private val readiness: suspend (AuthenticatedSession, UUID) -> LessonReadiness,
    private val now: () -> Long = System::currentTimeMillis,
) : ViewModel() {
    var busy by mutableStateOf<SessionAction?>(null)
        private set

    /** The position of the step whose lesson was written while the learner waited on it. */
    var writtenWhileWaiting by mutableStateOf<Long?>(null)
        private set

    private var waiting: LessonWait? = null

    /** The step's lesson while a run writes it: the next stop waits on its readiness alone. */
    var lessonBeingWritten by mutableStateOf<UUID?>(null)
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

    fun waitForLesson(position: Long) {
        if (waiting?.position != position) waiting = LessonWait(position, now())
    }

    /**
     * Reads [lessonId]'s readiness while a run writes it, and the day again only once that changes:
     * a written lesson keeps the wait until the day shows it, so its step is offered as ready.
     */
    suspend fun followWriting(
        lessonId: UUID,
        readDay: suspend () -> Unit,
    ) {
        while (true) {
            when (val read = cache.mutate { readiness(it, lessonId) }) {
                MutationResult.Obsolete -> {
                    lessonBeingWritten = null
                    return
                }

                is MutationResult.Failed -> {}

                is MutationResult.Done -> {
                    when (read.value.status) {
                        LessonReadiness.Status.GENERATING -> {
                            lessonBeingWritten = lessonId
                        }

                        LessonReadiness.Status.READY -> {
                            readDay()
                        }

                        else -> {
                            if (lessonBeingWritten == lessonId) readDay()
                            lessonBeingWritten = null
                            return
                        }
                    }
                }
            }
            delay(LESSON_CHECK_MILLIS)
        }
    }

    fun lessonWritten(position: Long) {
        val wait = waiting?.takeIf { it.position == position } ?: return
        waiting = null
        writtenWhileWaiting = position
        viewModelScope.launch { cache.mutate { writingApi.recordWait(it, now() - wait.since) } }
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

internal const val LESSON_CHECK_MILLIS = 5_000L

private data class LessonWait(
    val position: Long,
    val since: Long,
)
