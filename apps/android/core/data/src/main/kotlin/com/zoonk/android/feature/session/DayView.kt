package com.zoonk.android.feature.session

import androidx.compose.runtime.Immutable
import com.zoonk.android.feature.writing.WritingTaskName
import com.zoonk.android.feature.writing.toName
import com.zoonk.android.navigation.AppRoute
import com.zoonk.api.models.StudyBlock
import com.zoonk.api.models.StudyBlockCapsulesInner
import com.zoonk.api.models.StudyBlockWritingAvailability
import com.zoonk.api.models.StudyCheckpoint
import com.zoonk.api.models.StudyDay
import com.zoonk.api.models.StudyExtraTime
import com.zoonk.api.models.StudyMission
import com.zoonk.api.models.StudyMissionDetail
import com.zoonk.api.models.StudyMissionOpens
import com.zoonk.api.models.StudySession
import com.zoonk.api.models.StudySessionCatchUpLater
import com.zoonk.api.models.StudySessionExamAccess
import com.zoonk.api.models.StudySessionFullMeal
import com.zoonk.api.models.StudySessionMinutes
import com.zoonk.api.models.StudySessionWeek
import com.zoonk.api.models.UnstartedStudyDay
import com.zoonk.api.models.UnstartedStudyDayBlocksInner
import com.zoonk.api.models.UnstartedStudyDayMissionsInner
import com.zoonk.api.models.UnstartedStudyDayMissionsInnerOpens
import kotlinx.datetime.LocalDate
import kotlinx.datetime.toJavaLocalDate
import java.util.UUID

/**
 * A study day as Today and the session show it, saved or not opened yet: the API sends an unopened
 * day's blocks and missions without ids, as types of their own.
 */
@Immutable
data class DayView(
    /** Null until the learner opens the day. */
    val sessionId: UUID?,
    val goalId: UUID?,
    val localDate: LocalDate,
    val steps: List<DayStep>,
    val sessionBar: SessionBar,
    val nextPosition: Long?,
    val state: StudySession.State,
    val missions: List<DayMission>,
    val fullMeal: StudySessionFullMeal,
    val emptyDay: EmptyDay?,
    val minutes: StudySessionMinutes,
    val freshStart: FreshStart?,
    val examAccess: StudySessionExamAccess,
    val examTomorrow: Boolean,
    val extraTime: StudyExtraTime,
    val catchUp: CatchUp?,
    val lessonsComing: Boolean,
    val lessonsToPrepare: Boolean,
    /** The plan topic whose lessons the day keeps time for before they're written. */
    val lessonPlaceholderTitle: String?,
    val week: StudySessionWeek,
    val dayEndsAt: Long,
)

/** Core's count of the day's blocks: skipped ones count neither as done nor in the total. */
@Immutable
data class SessionBar(
    val completed: Int,
    val total: Int,
)

enum class WritingRow { DraftSaved, Tomorrow }

private fun writingRow(
    availability: StudyBlockWritingAvailability?,
    hasWritingDraft: Boolean?,
): WritingRow? =
    when {
        availability is StudyBlockWritingAvailability.StudyBlockWritingAvailabilityOneOf1Value -> WritingRow.Tomorrow
        hasWritingDraft == true -> WritingRow.DraftSaved
        else -> null
    }

/** The day a written task waiting for tomorrow's grading returns. */
private fun StudyBlockWritingAvailability.returnsOn(): java.time.LocalDate? =
    (this as? StudyBlockWritingAvailability.StudyBlockWritingAvailabilityOneOf1Value)?.value?.returnsOn?.toJavaLocalDate()

enum class EmptyDay { LessonsComing, LessonsToPrepare, NothingNew }

enum class FreshStart { WelcomeBack, NewWeek, NewPhase }

@Immutable
data class CatchUp(
    val lessonsLeft: Long,
    val positions: List<Long>,
    val later: StudySessionCatchUpLater,
)

/** One of the day's blocks; [id] is null on a day not opened yet, which opens by its work (`ref`). */
@Immutable
data class DayStep(
    val id: UUID?,
    val position: Long,
    val kind: StudyBlock.Kind,
    val status: StudyBlock.Status,
    val screen: StudyBlock.Screen,
    val title: String?,
    val canDo: String?,
    val subject: String?,
    val subjectExtra: StudyBlock.SubjectExtra? = null,
    val areas: List<String>,
    val topics: List<String>,
    val oftenTested: Boolean,
    val estimatedMinutes: Long,
    val questions: Long,
    val answered: Long,
    val lessonId: UUID?,
    val chapterId: UUID?,
    val areaId: String?,
    val planItemId: UUID?,
    val planItemKey: String?,
    val canTestOut: Boolean,
    val checkpoint: StudyCheckpoint?,
    val capsules: List<StudyBlockCapsulesInner>,
    val extra: Boolean,
    val fullReview: Boolean,
    val mistakesOnly: Boolean,
    val refresh: Boolean,
    val reinforcement: Boolean,
    val weakest: Boolean,
    val opensInPlayer: Boolean = false,
    val waitReason: StudyBlock.WaitReason?,
    /** A written task's row: its saved draft goes on, or today's extra grades are used and it waits for tomorrow. */
    val writing: WritingRow? = null,
    /** When a [WritingRow.Tomorrow] task returns: tomorrow, or a later day. */
    val writingReturnsOn: java.time.LocalDate? = null,
    /** Which question of the written test a whole answer is, so its row names it rather than the notice's sentence. */
    val writingTask: WritingTaskName? = null,
    /** A short writing task on what a lesson just taught, rather than a whole answer. */
    val drill: Boolean = false,
    val preparing: Boolean = false,
    val mockPreparationReview: Boolean = false,
    /** Why a lesson is back in the day: the learner keeps missing what it teaches. */
    val returning: StudyBlock.Returning? = null,
    /** The language pattern a [StudyBlock.Screen.PATTERN] step drills. */
    val patternId: UUID? = null,
) {
    val isFinished: Boolean
        get() = status == StudyBlock.Status.COMPLETED || status == StudyBlock.Status.SKIPPED

    val canOpen: Boolean
        get() = !isFinished && waitReason == null && !preparing

    /**
     * A finished lesson opens again on its own, outside the session. A skipped one comes back in the
     * plan, and finished review or practice was made for that day, so neither opens.
     */
    val lessonToReplay: UUID?
        get() = lessonId?.takeIf { status == StudyBlock.Status.COMPLETED && kind == StudyBlock.Kind.LEARN }
}

@Immutable
data class DayMission(
    val kind: StudyMission.Kind,
    val done: Boolean,
    val progress: Long,
    val total: Long,
    val minutes: Double?,
    val firstStep: Boolean,
    val waitReason: StudyMission.WaitReason?,
    val detail: StudyMissionDetail?,
    val opens: MissionOpens?,
)

/** Where a mission's tap leads: one of the day's blocks (by id once saved, by position before), or a page. */
sealed interface MissionOpens {
    data class Block(
        val blockId: UUID?,
        val position: Long?,
    ) : MissionOpens

    data object Pronunciation : MissionOpens

    data class Call(
        val chapterId: UUID,
    ) : MissionOpens

    data object Buddy : MissionOpens

    data class AreaPractice(
        val areaId: UUID,
    ) : MissionOpens

    data object MockChooser : MissionOpens
}

/** The page a mission opens, as Today and the buddy open it; a block opens with its day instead. */
fun MissionOpens.page(goalId: String): AppRoute? =
    when (this) {
        is MissionOpens.Block -> null
        MissionOpens.Pronunciation -> AppRoute.Pronunciation(goalId)
        is MissionOpens.Call -> AppRoute.LanguageUnit(chapterId.toString())
        MissionOpens.Buddy -> AppRoute.Buddy()
        is MissionOpens.AreaPractice -> AppRoute.Chapter(areaId.toString())
        MissionOpens.MockChooser -> AppRoute.MockChooser
    }

/** A checkpoint's facts whichever of its two shapes the API sent (with or without a mock's identity). */
data class CheckpointFacts(
    val kind: Kind,
    val mock: Boolean,
    val phase: Long?,
    val rematch: Boolean,
) {
    enum class Kind { Boss, FinalBoss, Weekly }
}

val DayStep.checkpointFacts: CheckpointFacts?
    get() =
        when (val checkpoint = checkpoint) {
            is StudyCheckpoint.StudyCheckpointOneOfValue -> {
                with(checkpoint.value) { CheckpointFacts(checkpointKind(kind.value), mock, phase, rematch) }
            }

            is StudyCheckpoint.StudyCheckpointOneOf1Value -> {
                with(checkpoint.value) { CheckpointFacts(checkpointKind(kind.value), mock, phase, rematch) }
            }

            null -> {
                null
            }
        }

private fun checkpointKind(value: String) =
    when (value) {
        "finalBoss" -> CheckpointFacts.Kind.FinalBoss
        "weekly" -> CheckpointFacts.Kind.Weekly
        else -> CheckpointFacts.Kind.Boss
    }

fun StudyDay.toDayView(): DayView =
    when (this) {
        is StudyDay.ActiveWrapper -> value.toDayView()
        is StudyDay.CompletedWrapper -> value.toDayView()
        is StudyDay.PlannedWrapper -> value.toDayView()
        is StudyDay.UnstartedWrapper -> value.toDayView()
    }

fun StudySession.toDayView(): DayView =
    DayView(
        sessionId = id,
        goalId = goalId,
        localDate = localDate,
        steps = blocks.map(StudyBlock::toDayStep),
        sessionBar = SessionBar(sessionBar.completed.toInt(), sessionBar.total.toInt()),
        nextPosition = nextPosition,
        state = state,
        missions = missions.map(StudyMission::toDayMission),
        fullMeal = fullMeal,
        emptyDay = emptyDay?.value?.let(::emptyDay),
        minutes = minutes,
        freshStart = freshStart?.value?.let(::freshStart),
        examAccess = examAccess,
        examTomorrow = examTomorrow,
        extraTime = extraTime,
        catchUp = catchUp?.let { CatchUp(it.lessonsLeft, it.positions, it.later) },
        lessonsComing = lessonsComing,
        lessonsToPrepare = lessonsToPrepare,
        lessonPlaceholderTitle = lessonPlaceholder?.title,
        week = week,
        dayEndsAt = dayEndsAt,
    )

private fun UnstartedStudyDay.toDayView(): DayView =
    DayView(
        sessionId = null,
        goalId = goalId,
        localDate = localDate,
        steps = blocks.map(UnstartedStudyDayBlocksInner::toDayStep),
        sessionBar = SessionBar(sessionBar.completed.toInt(), sessionBar.total.toInt()),
        nextPosition = nextPosition,
        state = StudySession.State.entries.first { it.value == state.value },
        missions = missions.map(UnstartedStudyDayMissionsInner::toDayMission),
        fullMeal = fullMeal,
        emptyDay = emptyDay?.value?.let(::emptyDay),
        minutes = minutes,
        freshStart = freshStart?.value?.let(::freshStart),
        examAccess = examAccess,
        examTomorrow = examTomorrow,
        extraTime = extraTime,
        catchUp = catchUp?.let { CatchUp(it.lessonsLeft, it.positions, it.later) },
        lessonsComing = lessonsComing,
        lessonsToPrepare = lessonsToPrepare,
        lessonPlaceholderTitle = lessonPlaceholder?.title,
        week = week,
        dayEndsAt = dayEndsAt,
    )

private fun emptyDay(value: String) =
    when (value) {
        "nothingNew" -> EmptyDay.NothingNew
        "lessonsToPrepare" -> EmptyDay.LessonsToPrepare
        else -> EmptyDay.LessonsComing
    }

private fun freshStart(value: String) =
    when (value) {
        "newWeek" -> FreshStart.NewWeek
        "newPhase" -> FreshStart.NewPhase
        else -> FreshStart.WelcomeBack
    }

fun StudyBlock.toDayStep(): DayStep =
    DayStep(
        id = id,
        position = position,
        kind = kind,
        status = status,
        screen = screen,
        title = title,
        canDo = canDo,
        subject = subject,
        subjectExtra = subjectExtra,
        areas = areas,
        topics = topics,
        oftenTested = oftenTested,
        estimatedMinutes = estimatedMinutes,
        questions = questions,
        answered = answered,
        lessonId = lessonId,
        chapterId = chapterId,
        areaId = areaId,
        planItemId = planItemId,
        planItemKey = planItemKey,
        canTestOut = canTestOut,
        checkpoint = checkpoint,
        capsules = capsules,
        extra = extra,
        fullReview = fullReview,
        mistakesOnly = mistakesOnly,
        refresh = refresh,
        reinforcement = reinforcement,
        weakest = weakest,
        opensInPlayer = opensInPlayer,
        waitReason = waitReason,
        writing = writingRow(writingAvailability, hasWritingDraft),
        writingReturnsOn = writingAvailability?.returnsOn(),
        writingTask = writingTask?.toName(),
        drill = writingUnit == StudyBlock.WritingUnit.DRILL,
        preparing = preparing,
        mockPreparationReview = mockPreparationReview == true,
        returning = returning,
        patternId = patternId,
    )

private fun UnstartedStudyDayBlocksInner.toDayStep(): DayStep =
    DayStep(
        id = null,
        position = position,
        kind = StudyBlock.Kind.entries.first { it.value == kind.value },
        status = StudyBlock.Status.entries.first { it.value == status.value },
        screen = StudyBlock.Screen.entries.first { it.value == screen.value },
        title = title,
        canDo = canDo,
        subject = subject,
        subjectExtra = subjectExtra?.let { extra -> StudyBlock.SubjectExtra.entries.first { it.value == extra.value } },
        areas = areas,
        topics = topics,
        oftenTested = oftenTested,
        estimatedMinutes = estimatedMinutes,
        questions = questions,
        answered = answered,
        lessonId = lessonId,
        chapterId = chapterId,
        areaId = areaId,
        planItemId = planItemId,
        planItemKey = planItemKey,
        canTestOut = canTestOut,
        checkpoint = checkpoint,
        capsules = capsules,
        extra = extra,
        fullReview = fullReview,
        mistakesOnly = mistakesOnly,
        refresh = refresh,
        reinforcement = reinforcement,
        weakest = weakest,
        opensInPlayer = opensInPlayer,
        waitReason = waitReason?.let { reason -> StudyBlock.WaitReason.entries.first { it.value == reason.value } },
        writing = writingRow(writingAvailability, hasWritingDraft),
        writingReturnsOn = writingAvailability?.returnsOn(),
        writingTask = writingTask?.toName(),
        drill = writingUnit == UnstartedStudyDayBlocksInner.WritingUnit.DRILL,
        preparing = preparing,
        mockPreparationReview = mockPreparationReview == true,
        returning = returning?.let { shown -> StudyBlock.Returning.entries.first { it.value == shown.value } },
        patternId = patternId,
    )

fun StudyMission.toDayMission(): DayMission =
    DayMission(
        kind = kind,
        done = status == StudyMission.Status.DONE,
        progress = done,
        total = total,
        minutes = minutes,
        firstStep = firstStep == true,
        waitReason = waitReason,
        detail = detail,
        opens = opens?.toMissionOpens(),
    )

private fun UnstartedStudyDayMissionsInner.toDayMission(): DayMission =
    DayMission(
        kind = StudyMission.Kind.entries.first { it.value == kind.value },
        done = status == UnstartedStudyDayMissionsInner.Status.DONE,
        progress = done,
        total = total,
        minutes = minutes,
        firstStep = firstStep == true,
        waitReason = waitReason?.let { reason -> StudyMission.WaitReason.entries.first { it.value == reason.value } },
        detail = detail,
        opens = opens?.toMissionOpens(),
    )

fun StudyMissionOpens.toMissionOpens(): MissionOpens =
    when (this) {
        is StudyMissionOpens.StudyMissionOpensOneOfValue -> MissionOpens.Block(blockId = value.blockId, position = null)
        is StudyMissionOpens.StudyMissionOpensOneOf1Value -> MissionOpens.Pronunciation
        is StudyMissionOpens.StudyMissionOpensOneOf2Value -> MissionOpens.Call(value.chapterId)
        is StudyMissionOpens.StudyMissionOpensOneOf3Value -> MissionOpens.Buddy
        is StudyMissionOpens.StudyMissionOpensOneOf4Value -> MissionOpens.AreaPractice(value.areaId)
        is StudyMissionOpens.StudyMissionOpensOneOf5Value -> MissionOpens.MockChooser
    }

private fun UnstartedStudyDayMissionsInnerOpens.toMissionOpens(): MissionOpens =
    when (this) {
        is UnstartedStudyDayMissionsInnerOpens.UnstartedStudyDayMissionsInnerOpensAnyOfValue -> {
            MissionOpens.Block(blockId = null, position = value.ref.position)
        }

        is UnstartedStudyDayMissionsInnerOpens.StudyMissionOpensOneOf1Value -> {
            MissionOpens.Pronunciation
        }

        is UnstartedStudyDayMissionsInnerOpens.StudyMissionOpensOneOf2Value -> {
            MissionOpens.Call(value.chapterId)
        }

        is UnstartedStudyDayMissionsInnerOpens.StudyMissionOpensOneOf3Value -> {
            MissionOpens.Buddy
        }

        is UnstartedStudyDayMissionsInnerOpens.StudyMissionOpensOneOf4Value -> {
            MissionOpens.AreaPractice(value.areaId)
        }

        is UnstartedStudyDayMissionsInnerOpens.StudyMissionOpensOneOf5Value -> {
            MissionOpens.MockChooser
        }
    }
