package com.zoonk.android.feature.today

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.zoonk.android.data.MutationResult
import com.zoonk.android.feature.session.DayStep
import com.zoonk.android.feature.session.StudyOpener
import com.zoonk.android.navigation.AppRoute
import com.zoonk.api.models.MemoryInsight
import com.zoonk.api.models.SuggestedGoal
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.receiveAsFlow
import kotlinx.coroutines.launch
import java.util.UUID

/** What a tap on Today is waiting for, so only that control shows it. */
sealed interface TodayTap {
    /** Start or Continue, and Enter. */
    data object Continue : TodayTap

    data class Step(
        val position: Long,
    ) : TodayTap

    /** "Keep learning", "Practice for N minutes" and the up-next list's first row: one request. */
    data object KeepLearning : TodayTap
}

/** Every write starts from a tap; reading Today never writes. */
class TodayViewModel(
    private val opener: StudyOpener,
    private val store: TodayStore,
) : ViewModel() {
    private val opened = Channel<TodayRoute>(Channel.BUFFERED)

    /** Where a tap leads, for the screen's navigator, with the day it was made on. */
    val routes: Flow<TodayRoute> = opened.receiveAsFlow()

    var pending by mutableStateOf<TodayTap?>(null)
        private set

    var failed by mutableStateOf<TodayTap?>(null)
        private set

    fun open(
        read: TodayRead.Day,
        step: DayStep,
        next: Boolean,
    ) = run(read, if (next) TodayTap.Continue else TodayTap.Step(step.position)) {
        opener.open(read.day, step, next, read.today.goal.id)
    }

    fun keepLearning(read: TodayRead.Day) =
        run(read, TodayTap.KeepLearning) {
            opener.addExtraTime(read.day, read.today.goal.id)
        }

    var isCatchingUp by mutableStateOf(false)
        private set

    var catchUpFailed by mutableStateOf(false)
        private set

    fun catchUp(read: TodayRead.Day) {
        if (isCatchingUp) return
        isCatchingUp = true
        catchUpFailed = false

        viewModelScope.launch {
            catchUpFailed = opener.catchUp(read.day, read.today.goal.id) is MutationResult.Failed
            isCatchingUp = false
        }
    }

    var resumeFailure by mutableStateOf<ResumeFailure?>(null)
        private set

    /** The goal being resumed; it stays busy once saved, until Today shows its day ([resumed]). */
    var resuming by mutableStateOf<UUID?>(null)
        private set

    fun resume(goalId: UUID) {
        if (resuming != null) return
        resuming = goalId
        resumeFailure = null

        viewModelScope.launch {
            when (val result = store.resume(goalId)) {
                is MutationResult.Done -> {
                    if (!result.value) {
                        resumeFailure = ResumeFailure.GoalLimit
                        resuming = null
                    }
                }

                is MutationResult.Failed -> {
                    resumeFailure = ResumeFailure.Failed
                    resuming = null
                }

                MutationResult.Obsolete -> {
                    resuming = null
                }
            }
        }
    }

    /** Today no longer shows a paused goal, so a later pause can be resumed again. */
    fun resumed() {
        resuming = null
        resumeFailure = null
    }

    var isAnswering by mutableStateOf(false)
        private set

    var answerFailed by mutableStateOf(false)
        private set

    /** Kept per insight, so its card shows what the answer did once Today no longer carries it. */
    var insightAnswers by mutableStateOf(mapOf<UUID, InsightAnswer>())
        private set

    var isAnsweringInsight by mutableStateOf(false)
        private set

    fun answerInsight(
        insight: MemoryInsight,
        accepted: Boolean,
    ) {
        if (isAnsweringInsight) return
        isAnsweringInsight = true
        insightAnswers -= insight.id

        viewModelScope.launch {
            val saved = store.answerInsight(insight, accepted)
            val answer =
                when {
                    !saved -> InsightAnswer.Failed
                    accepted -> InsightAnswer.Accepted
                    else -> InsightAnswer.Dismissed
                }
            insightAnswers += insight.id to answer
            isAnsweringInsight = false
        }
    }

    /** Goes by the saved answer, not the card, which may be older. */
    fun answer(
        suggestion: SuggestedGoal,
        accepted: Boolean,
        hasGoal: Boolean,
    ) {
        if (isAnswering) return
        isAnswering = true
        answerFailed = false

        viewModelScope.launch {
            when (val result = store.answer(suggestion, accepted)) {
                is MutationResult.Done -> {
                    val answered = result.value
                    when {
                        accepted -> {
                            val route =
                                answered.courseId?.let { AppRoute.CourseStart(it.toString()) } ?: AppRoute.StartGoal(goal = answered.title)
                            opened.send(TodayRoute(route))
                        }

                        !hasGoal -> {
                            opened.send(TodayRoute(AppRoute.StartGoal()))
                        }
                    }
                }

                is MutationResult.Failed -> {
                    answerFailed = true
                }

                MutationResult.Obsolete -> {}
            }
            isAnswering = false
        }
    }

    private fun run(
        read: TodayRead.Day,
        tap: TodayTap,
        write: suspend () -> MutationResult<AppRoute?>,
    ) {
        if (pending != null) return
        pending = tap
        failed = null

        viewModelScope.launch {
            when (val result = write()) {
                is MutationResult.Done -> result.value?.let { opened.send(TodayRoute(it, read.today.goal.id, read.day.localDate)) }
                is MutationResult.Failed -> failed = tap
                MutationResult.Obsolete -> Unit
            }

            pending = null
        }
    }
}

enum class ResumeFailure { Failed, GoalLimit }

/** A tap's destination; one made on a day opens only while Today still shows that goal and day. */
data class TodayRoute(
    val route: AppRoute,
    val goalId: UUID? = null,
    val localDate: kotlinx.datetime.LocalDate? = null,
)

enum class InsightAnswer { Accepted, Dismissed, Failed }
