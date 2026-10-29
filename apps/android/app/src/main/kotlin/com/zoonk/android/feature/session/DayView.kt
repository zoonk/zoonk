package com.zoonk.android.feature.session

import androidx.compose.runtime.Immutable
import com.zoonk.android.navigation.AppRoute
import com.zoonk.api.models.DailyTimeLimit
import com.zoonk.api.models.StudyBlock
import com.zoonk.api.models.StudyBlockCapsulesInner
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
    val nextPosition: Long?,
    val missions: List<DayMission>,
    val fullMeal: StudySessionFullMeal,
    val dailyLimit: DailyTimeLimit?,
    val emptyDay: EmptyDay?,
    val minutes: StudySessionMinutes,
    val freshStart: FreshStart?,
    val examAccess: StudySessionExamAccess,
    val examTomorrow: Boolean,
    val extraTime: StudyExtraTime,
    val catchUp: CatchUp?,
    val lessonsComing: Boolean,
    val plusLessons: List<String>,
    val week: StudySessionWeek,
    val dayEndsAt: Long,
)

enum class EmptyDay { LessonsComing, NothingNew }

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
    val waitReason: StudyBlock.WaitReason?,
) {
    val isFinished: Boolean
        get() = status == StudyBlock.Status.COMPLETED || status == StudyBlock.Status.SKIPPED
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

    data object MistakesPractice : MissionOpens

    data class Pattern(
        val patternId: UUID,
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
        MissionOpens.MistakesPractice -> AppRoute.MistakePractice()
        is MissionOpens.Pattern -> AppRoute.Pattern(patternId.toString())
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
        nextPosition = nextPosition,
        missions = missions.map(StudyMission::toDayMission),
        fullMeal = fullMeal,
        dailyLimit = dailyLimit,
        emptyDay = emptyDay?.value?.let(::emptyDay),
        minutes = minutes,
        freshStart = freshStart?.value?.let(::freshStart),
        examAccess = examAccess,
        examTomorrow = examTomorrow,
        extraTime = extraTime,
        catchUp = catchUp?.let { CatchUp(it.lessonsLeft, it.positions, it.later) },
        lessonsComing = lessonsComing,
        plusLessons = plusLessons.map { it.title },
        week = week,
        dayEndsAt = dayEndsAt,
    )

private fun UnstartedStudyDay.toDayView(): DayView =
    DayView(
        sessionId = null,
        goalId = goalId,
        localDate = localDate,
        steps = blocks.map(UnstartedStudyDayBlocksInner::toDayStep),
        nextPosition = nextPosition,
        missions = missions.map(UnstartedStudyDayMissionsInner::toDayMission),
        fullMeal = fullMeal,
        dailyLimit = dailyLimit,
        emptyDay = emptyDay?.value?.let(::emptyDay),
        minutes = minutes,
        freshStart = freshStart?.value?.let(::freshStart),
        examAccess = examAccess,
        examTomorrow = examTomorrow,
        extraTime = extraTime,
        catchUp = catchUp?.let { CatchUp(it.lessonsLeft, it.positions, it.later) },
        lessonsComing = lessonsComing,
        plusLessons = plusLessons.map { it.title },
        week = week,
        dayEndsAt = dayEndsAt,
    )

private fun emptyDay(value: String) = if (value == "nothingNew") EmptyDay.NothingNew else EmptyDay.LessonsComing

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
        waitReason = waitReason,
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
        waitReason = waitReason?.let { reason -> StudyBlock.WaitReason.entries.first { it.value == reason.value } },
    )

internal fun StudyMission.toDayMission(): DayMission =
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

internal fun StudyMissionOpens.toMissionOpens(): MissionOpens =
    when (this) {
        is StudyMissionOpens.StudyMissionOpensOneOfValue -> MissionOpens.Block(blockId = value.blockId, position = null)
        is StudyMissionOpens.StudyMissionOpensOneOf1Value -> MissionOpens.MistakesPractice
        is StudyMissionOpens.StudyMissionOpensOneOf2Value -> MissionOpens.Pattern(value.patternId)
        is StudyMissionOpens.StudyMissionOpensOneOf3Value -> MissionOpens.Pronunciation
        is StudyMissionOpens.StudyMissionOpensOneOf4Value -> MissionOpens.Call(value.chapterId)
        is StudyMissionOpens.StudyMissionOpensOneOf5Value -> MissionOpens.Buddy
        is StudyMissionOpens.StudyMissionOpensOneOf6Value -> MissionOpens.AreaPractice(value.areaId)
        is StudyMissionOpens.StudyMissionOpensOneOf7Value -> MissionOpens.MockChooser
    }

private fun UnstartedStudyDayMissionsInnerOpens.toMissionOpens(): MissionOpens =
    when (this) {
        is UnstartedStudyDayMissionsInnerOpens.UnstartedStudyDayMissionsInnerOpensAnyOfValue -> {
            MissionOpens.Block(blockId = null, position = value.ref.position)
        }

        is UnstartedStudyDayMissionsInnerOpens.StudyMissionOpensOneOf1Value -> {
            MissionOpens.MistakesPractice
        }

        is UnstartedStudyDayMissionsInnerOpens.StudyMissionOpensOneOf2Value -> {
            MissionOpens.Pattern(value.patternId)
        }

        is UnstartedStudyDayMissionsInnerOpens.StudyMissionOpensOneOf3Value -> {
            MissionOpens.Pronunciation
        }

        is UnstartedStudyDayMissionsInnerOpens.StudyMissionOpensOneOf4Value -> {
            MissionOpens.Call(value.chapterId)
        }

        is UnstartedStudyDayMissionsInnerOpens.StudyMissionOpensOneOf5Value -> {
            MissionOpens.Buddy
        }

        is UnstartedStudyDayMissionsInnerOpens.StudyMissionOpensOneOf6Value -> {
            MissionOpens.AreaPractice(value.areaId)
        }

        is UnstartedStudyDayMissionsInnerOpens.StudyMissionOpensOneOf7Value -> {
            MissionOpens.MockChooser
        }
    }
