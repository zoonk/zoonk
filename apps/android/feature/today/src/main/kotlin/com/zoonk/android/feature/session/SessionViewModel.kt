package com.zoonk.android.feature.session

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.GenerationFollower
import com.zoonk.android.data.GenerationKind
import com.zoonk.android.data.GenerationRun
import com.zoonk.android.data.GenerationSource
import com.zoonk.android.data.MutationResult
import com.zoonk.android.data.Visit
import com.zoonk.android.data.value
import com.zoonk.android.navigation.AppRoute
import com.zoonk.api.models.LessonReadiness
import com.zoonk.api.models.Milestone
import com.zoonk.api.models.StudyBlockLesson
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import kotlinx.coroutines.withTimeoutOrNull
import java.util.UUID

enum class SessionAction { Start, Stop, KeepGoing, ExtraTime }

internal enum class SummaryVisit { First, Repeat, Failed }

internal enum class SummaryExit { Repeat, DayChanged }

/**
 * The session screen's actions and their outcomes across a rotation.
 */
class SessionViewModel(
    private val opener: StudyOpener,
    private val sessions: StudySessionStore,
    private val cache: AppCache,
    private val readiness: suspend (AuthenticatedSession, UUID) -> LessonReadiness,
    private val generations: () -> GenerationSource,
) : ViewModel() {
    var busy by mutableStateOf<SessionAction?>(null)
        private set

    /** The position of the step whose lesson was written while the learner waited on it. */
    var writtenWhileWaiting by mutableStateOf<Long?>(null)
        private set

    /** The position of the step the learner is waiting on. */
    private var waiting: Long? = null

    /** The shown step's lesson as its last readiness read found it, while the next stop waits on it. */
    var lesson by mutableStateOf<LessonState?>(null)
        private set

    private var followedRun: String? = null

    private val follower =
        GenerationFollower(
            kind = GenerationKind.Lesson,
            scope = viewModelScope,
            source =
                object : GenerationSource {
                    override fun events(id: String) = generations().events(id)

                    override suspend fun status(id: String) = generations().status(id)
                },
        )

    /** The run writing the shown step's lesson. */
    val run: StateFlow<GenerationRun> = follower.run

    /** A tap's answer that comes back after the learner left the screen opens and says nothing. */
    internal val visit = Visit()

    /** Where a tap leads, in place of the session screen. */
    val route = visit.outcome<AppRoute>()

    private val failure = visit.outcome<SessionAction>()
    private var claimingSummary: Job? = null
    internal val summaryOpening =
        visit.opening {
            claimingSummary?.cancel()
            claimingSummary = null
        }
    private val visitResult = summaryOpening.outcome<SummaryVisit>()
    internal val summaryExit = summaryOpening.outcome<SummaryExit>()

    internal val summaryVisit get() = visitResult.value

    /** The action that failed on this visit. */
    val failed get() = failure.value

    private var heldCeremony by mutableStateOf<Milestone?>(null)
    private var ceremonyClosed by mutableStateOf(false)
    private var rereading: Job? = null

    internal fun recordSummaryVisit(
        sessionId: UUID,
        visitId: UUID,
        requested: Boolean,
    ) {
        if (claimingSummary?.isActive == true || summaryExit.value != null) return
        if (summaryVisit == SummaryVisit.First || summaryVisit == SummaryVisit.Repeat) return

        visitResult.clear()
        val started = summaryOpening.number
        claimingSummary =
            viewModelScope.launch {
                when (val result = sessions.recordSummaryVisit(sessionId, visitId)) {
                    is MutationResult.Done -> {
                        if (!result.value && !requested) {
                            summaryExit.send(started, SummaryExit.Repeat)
                        } else {
                            visitResult.send(started, if (result.value) SummaryVisit.First else SummaryVisit.Repeat)
                        }
                    }

                    is MutationResult.Failed -> {
                        if (result.code == "STUDY_SUMMARY_NOT_READY") {
                            summaryExit.send(started, SummaryExit.DayChanged)
                        } else {
                            visitResult.send(started, SummaryVisit.Failed)
                        }
                    }

                    MutationResult.Obsolete -> {}
                }
            }
    }

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

        val started = visit.number
        rereading =
            viewModelScope.launch {
                val day = sessions.day[sessionId]
                val summary = sessions.summary[sessionId]
                day.refresh()
                summary.refresh()
                val dayNow = day.state.value.value
                val summaryNow = summary.state.value.value
                if (dayNow?.nextBlockId == null && summaryNow?.finished == false) route.send(started, AppRoute.Today)
            }
    }

    fun waitForLesson(position: Long) {
        waiting = position
    }

    /**
     * Asks [lessonId]'s readiness now and every few seconds, following the run that writes it. An
     * answer that differs from the last one, or from what the day showed ([shown]), shows at once and
     * reads the day again ([readDay]); a written lesson reads it until the day has it. A run whose
     * updates stop, and a read the server couldn't answer, decide nothing: they only ask again. It
     * ends once nothing is on its way: a lesson nobody writes, or one its checks set aside.
     */
    suspend fun followLesson(
        lessonId: UUID,
        shown: StudyBlockLesson?,
        readDay: suspend () -> Unit,
    ) {
        try {
            var last = shown?.let { it.status.value to it.setAside }
            while (true) {
                // Taken before the read, since following its run can fail at once.
                val seen = follower.run.value
                when (val read = cache.mutate { readiness(it, lessonId) }) {
                    MutationResult.Obsolete -> {
                        return
                    }

                    is MutationResult.Failed -> {}

                    is MutationResult.Done -> {
                        val answer = read.value
                        val status = answer.status
                        if (status != LessonReadiness.Status.READY) lesson = answer.toState(lessonId)
                        if (status == LessonReadiness.Status.GENERATING) follow(answer.generationId)
                        val moved = last != status.value to answer.setAside
                        last = status.value to answer.setAside
                        if (moved || status == LessonReadiness.Status.READY) readDay()
                        if (status == LessonReadiness.Status.NOT_STARTED || answer.setAside) return
                    }
                }
                withTimeoutOrNull(LESSON_CHECK_MILLIS) { follower.run.first { it != seen && it.status == GenerationRun.Status.Failed } }
            }
        } finally {
            follower.stop()
            followedRun = null
        }
    }

    private fun follow(generationId: String?) {
        if (generationId == null || (generationId == followedRun && follower.run.value.status != GenerationRun.Status.Failed)) return
        followedRun = generationId
        follower.follow(generationId)
    }

    fun lessonWritten(position: Long) {
        if (waiting != position) return
        waiting = null
        writtenWhileWaiting = position
    }

    /** A saved day's shown step may be one the learner asked for, so only a day not saved yet starts it as the next one. */
    fun start(
        day: DayView,
        step: DayStep,
        goalId: UUID,
    ) = run(SessionAction.Start) { opener.open(day, step, next = day.sessionId == null, goalId = goalId) }

    fun stop(sessionId: UUID) = run(SessionAction.Stop) { opener.stop(sessionId) }

    fun keepGoing(sessionId: UUID) = run(SessionAction.KeepGoing) { opener.continueSession(sessionId) }

    fun extraTime(
        day: DayView,
        goalId: UUID,
    ) = run(SessionAction.ExtraTime) { opener.addExtraTime(day, goalId) }

    /** A null route means the day changed meanwhile, which Today shows. */
    private fun run(
        action: SessionAction,
        write: suspend () -> MutationResult<AppRoute?>,
    ) {
        if (busy != null) return
        busy = action
        failure.clear()
        val started = visit.number

        viewModelScope.launch {
            val result = write()
            busy = null
            when (result) {
                is MutationResult.Done -> {
                    route.send(started, result.value ?: AppRoute.Today)
                }

                is MutationResult.Failed -> {
                    failure.send(started, action)
                }

                MutationResult.Obsolete -> {}
            }
        }
    }
}

internal const val LESSON_CHECK_MILLIS = 5_000L

/** Main's `NextStopLesson`: what the next stop shows of its step's lesson; [Unknown] until a server that doesn't say answers its readiness. */
enum class NextStopLesson { Ready, Unknown, Writing, Failed }

private fun LessonReadiness.toState(lessonId: UUID) =
    LessonState(
        lessonId,
        status,
        setAside,
        warmUpId?.toString(),
        if (kind == LessonReadiness.Kind.CHALLENGE) GenerationKind.Challenge else GenerationKind.Lesson,
    )

data class LessonState(
    val id: UUID,
    val status: LessonReadiness.Status,
    val setAside: Boolean,
    /** The goal's deck while this is its first lesson; kept once the lesson is written, so a learner who guessed can finish the card. */
    val warmUpId: String?,
    val kind: GenerationKind,
)
