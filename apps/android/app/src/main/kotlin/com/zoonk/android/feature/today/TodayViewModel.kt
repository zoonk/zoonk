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
    private val opened = Channel<AppRoute>(Channel.BUFFERED)

    /** Where a tap leads, for the screen's navigator. */
    val routes: Flow<AppRoute> = opened.receiveAsFlow()

    var pending by mutableStateOf<TodayTap?>(null)
        private set

    var failed by mutableStateOf<TodayTap?>(null)
        private set

    fun open(
        read: TodayRead.Day,
        step: DayStep,
        next: Boolean,
    ) = run(if (next) TodayTap.Continue else TodayTap.Step(step.position)) {
        opener.open(read.day, step, next, read.today.goal.id)
    }

    fun keepLearning(read: TodayRead.Day) =
        run(TodayTap.KeepLearning) {
            opener.addExtraTime(read.day, read.today.goal.id)
        }

    var resumeFailure by mutableStateOf<ResumeFailure?>(null)
        private set

    var isResuming by mutableStateOf(false)
        private set

    /** Stays busy once saved: Today reads the resumed goal's day, which replaces this state. */
    fun resume(goalId: UUID) {
        if (isResuming) return
        isResuming = true
        resumeFailure = null

        viewModelScope.launch {
            when (val result = store.resume(goalId)) {
                is MutationResult.Done -> {
                    if (!result.value) resumeFailure = ResumeFailure.GoalLimit
                    isResuming = result.value
                }

                is MutationResult.Failed -> {
                    resumeFailure = ResumeFailure.Failed
                    isResuming = false
                }

                MutationResult.Obsolete -> {
                    isResuming = false
                }
            }
        }
    }

    var isAnswering by mutableStateOf(false)
        private set

    var answerFailed by mutableStateOf(false)
        private set

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
                            opened.send(
                                answered.courseId?.let { AppRoute.CourseStart(it.toString()) } ?: AppRoute.StartGoal(goal = answered.title),
                            )
                        }

                        !hasGoal -> {
                            opened.send(AppRoute.StartGoal())
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
        tap: TodayTap,
        write: suspend () -> MutationResult<AppRoute?>,
    ) {
        if (pending != null) return
        pending = tap
        failed = null

        viewModelScope.launch {
            when (val result = write()) {
                is MutationResult.Done -> result.value?.let { opened.send(it) }
                is MutationResult.Failed -> failed = tap
                MutationResult.Obsolete -> Unit
            }

            pending = null
        }
    }
}

enum class ResumeFailure { Failed, GoalLimit }
