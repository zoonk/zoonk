package com.zoonk.android.feature.today

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.zoonk.android.data.MutationResult
import com.zoonk.android.feature.plan.PlanStore
import com.zoonk.android.feature.session.DayStep
import com.zoonk.android.feature.session.StudyOpener
import com.zoonk.android.navigation.AppRoute
import com.zoonk.api.models.MemoryInsight
import com.zoonk.api.models.PlanChange
import com.zoonk.api.models.PlanChangeDecisionInput
import com.zoonk.api.models.PlanChangeResult
import com.zoonk.api.models.SuggestedGoal
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.receiveAsFlow
import kotlinx.coroutines.launch
import kotlinx.datetime.LocalDate
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

    /** "Get today's lessons" on a day nobody is writing yet. */
    data object Prepare : TodayTap
}

/** Every write starts from a tap; reading Today never writes. */
class TodayViewModel(
    private val opener: StudyOpener,
    private val store: TodayStore,
    private val plans: PlanStore,
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

    fun prepareLessons(read: TodayRead.Day) =
        run(read, TodayTap.Prepare) {
            when (val result = store.prepareLessons(read.today.goal.id)) {
                is MutationResult.Done -> MutationResult.Done(null)
                is MutationResult.Failed -> result
                MutationResult.Obsolete -> MutationResult.Obsolete
            }
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

    var noticeHold by mutableStateOf<NoticeHold?>(null)
        private set

    fun holdNotice(
        read: TodayRead.Day,
        picked: TodayNoticeKind?,
    ) {
        noticeHold = noticeHold.next(read.today.goal.id, read.day.localDate, picked, read.today.insight)
    }

    /** Today left the screen (a task over it, another tab), so the next notice can show on return. */
    fun endVisit() {
        visit++
        noticeHold = null
        planChangeAnswer = null
        planChangeFailedOn = null
        examChoiceMade = null
        examChoiceFailedOn = null
    }

    /** An answer that comes back after the learner left Today belongs to no card. */
    private var visit = 0

    /** A plan change answered here, so its card says what the answer did after Today moves on. */
    var planChangeAnswer by mutableStateOf<PlanChangeAnswer?>(null)
        private set

    /** The goal and day whose plan change didn't save, so the error shows on that notice only. */
    var planChangeFailedOn by mutableStateOf<NoticeVisit?>(null)
        private set

    var isSavingPlanChange by mutableStateOf(false)
        private set

    /** A change offered again (an undo can do that) isn't an answer: its card follows Today's read again. */
    fun decidePlanChange(
        read: TodayRead.Day,
        change: PlanChange,
        status: PlanChangeDecisionInput.Status,
    ) {
        if (isSavingPlanChange) return
        isSavingPlanChange = true
        val on = read.noticeVisit()
        val started = visit
        planChangeFailedOn = null

        viewModelScope.launch {
            val result = plans.decideChange(on.goalId, change.id, status)
            isSavingPlanChange = false
            if (visit != started) return@launch
            when (result) {
                is MutationResult.Done -> {
                    planChangeAnswer =
                        result.value.takeIf { it.status != PlanChange.Status.PROPOSED }?.let { PlanChangeAnswer(on, status, it) }
                }

                is MutationResult.Failed -> {
                    planChangeFailedOn = on
                }

                MutationResult.Obsolete -> {}
            }
        }
    }

    /** Shows the change Today offers next, after this one's answer. */
    fun nextPlanChange() {
        planChangeAnswer = null
    }

    /** The exam choice just made, so its card says what it did after Today stops asking. */
    var examChoiceMade by mutableStateOf<ExamChoiceMade?>(null)
        private set

    /** The goal and day whose exam choice didn't save, so the error shows on that notice only. */
    var examChoiceFailedOn by mutableStateOf<NoticeVisit?>(null)
        private set

    var isSavingExamChoice by mutableStateOf(false)
        private set

    fun chooseExamOption(
        read: TodayRead.Day,
        group: String,
        subject: String,
    ) {
        if (isSavingExamChoice) return
        isSavingExamChoice = true
        val on = read.noticeVisit()
        val started = visit
        examChoiceFailedOn = null

        viewModelScope.launch {
            val result = plans.chooseExamOption(on.goalId, group, subject)
            isSavingExamChoice = false
            if (visit != started) return@launch
            when (result) {
                is MutationResult.Done -> {
                    val change = result.value.change?.takeIf { result.value.status == PlanChangeResult.Status.APPLIED }
                    if (change == null) examChoiceFailedOn = on else examChoiceMade = ExamChoiceMade(on, change)
                }

                is MutationResult.Failed -> {
                    examChoiceFailedOn = on
                }

                MutationResult.Obsolete -> {}
            }
        }
    }

    fun undoExamChoice(made: ExamChoiceMade) {
        if (isSavingExamChoice) return
        isSavingExamChoice = true
        val started = visit
        examChoiceFailedOn = null

        viewModelScope.launch {
            val result = plans.decideChange(made.visit.goalId, made.change.id, PlanChangeDecisionInput.Status.UNDONE)
            isSavingExamChoice = false
            if (visit != started) return@launch
            when (result) {
                is MutationResult.Done -> {
                    if (examChoiceMade == made) examChoiceMade = null
                }

                is MutationResult.Failed -> {
                    examChoiceFailedOn = made.visit
                }

                MutationResult.Obsolete -> {}
            }
        }
    }

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
            val answer =
                when (store.answerInsight(insight, accepted)) {
                    is MutationResult.Done -> if (accepted) InsightAnswer.Accepted else InsightAnswer.Dismissed
                    is MutationResult.Failed -> InsightAnswer.Failed
                    MutationResult.Obsolete -> null
                }
            answer?.let { insightAnswers += insight.id to it }
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

/** The goal and day a notice belongs to: an answer shows only on them. */
data class NoticeVisit(
    val goalId: UUID,
    val date: LocalDate,
)

fun TodayRead.Day.noticeVisit(): NoticeVisit = NoticeVisit(today.goal.id, day.localDate)

data class PlanChangeAnswer(
    val visit: NoticeVisit,
    val status: PlanChangeDecisionInput.Status,
    val change: PlanChange,
)

data class ExamChoiceMade(
    val visit: NoticeVisit,
    val change: PlanChange,
)
