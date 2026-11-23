package com.zoonk.android.feature.onboarding.start

import com.zoonk.api.models.GoalCreateInput
import com.zoonk.api.models.GoalCreateInputOutput
import com.zoonk.api.models.GoalDraft
import com.zoonk.api.models.GoalDraftOutput
import com.zoonk.api.models.GoalUnderstandingOneOf
import com.zoonk.api.models.OnboardingDraft
import com.zoonk.api.models.UnderstoodGoal
import kotlinx.serialization.json.JsonPrimitive
import java.util.TimeZone
import java.util.UUID

private const val EXPLANATION_MINUTES = 5L
private const val MUSICIANSHIP_MINUTES = 15L

/** The card's goals past the [activeGoalsLeft] the learner's plan can still follow are Plus's: shown locked, never sent. */
internal fun GoalUnderstandingOneOf.startableGoals(activeGoalsLeft: Long?): List<UnderstoodGoal> =
    goals.take(activeGoalsLeft?.toInt() ?: goals.size)

internal fun understoodGoalsInput(
    understanding: GoalUnderstandingOneOf,
    activeGoalsLeft: Long?,
    timeZone: String,
): GoalCreateInput =
    GoalCreateInput(
        dailyMinutes = understanding.schedule.dailyMinutes,
        goals = understanding.startableGoals(activeGoalsLeft).map { it.draft.toGoalDraft() },
        studyDays = understanding.schedule.studyDays,
        studyTime = understanding.schedule.studyTime,
        timeZone = timeZone,
    )

internal fun explanationInput(
    draft: OnboardingDraft,
    question: String,
    language: String,
) = GoalCreateInput(
    dailyMinutes = EXPLANATION_MINUTES,
    goals =
        listOf(
            GoalDraft(
                kind = GoalDraft.Kind.EXPLAIN,
                language = language,
                prompt = draft.prompt,
                title = question,
                details = mapOf("onboardingId" to JsonPrimitive(draft.id.toString()), "question" to JsonPrimitive(draft.prompt)),
            ),
        ),
    timeZone = TimeZone.getDefault().id,
)

internal fun musicianshipInput(
    draft: OnboardingDraft,
    instrument: String,
    title: String,
    subject: String,
    language: String,
) = GoalCreateInput(
    dailyMinutes = MUSICIANSHIP_MINUTES,
    goals =
        listOf(
            GoalDraft(
                kind = GoalDraft.Kind.LEARN,
                language = language,
                prompt = draft.prompt,
                title = title,
                details =
                    mapOf(
                        "instrument" to JsonPrimitive(instrument),
                        "onboardingId" to JsonPrimitive(draft.id.toString()),
                        "subject" to JsonPrimitive(subject),
                    ),
            ),
        ),
    timeZone = TimeZone.getDefault().id,
)

/** A goal its card left waiting starts as the card read it; [pauseGoalId] is the goal paused to make room for it. */
fun GoalCreateInputOutput.toGoalCreateInput(pauseGoalId: UUID? = null) =
    GoalCreateInput(
        dailyMinutes = dailyMinutes,
        goals = goals.map { it.toGoalDraft() },
        pauseGoalId = pauseGoalId,
        sourceIds = sourceIds,
        studyDays = studyDays,
        studyTime = studyTime,
        timeZone = TimeZone.getDefault().id,
    )

private fun GoalDraftOutput.toGoalDraft() =
    GoalDraft(
        kind = GoalDraft.Kind.valueOf(kind.name),
        language = language,
        prompt = prompt,
        title = title,
        displayName = displayName,
        dailyMinutes = dailyMinutes,
        details = details,
        examBlueprintId = examBlueprintId,
        primaryCourseId = primaryCourseId,
        targetDate = targetDate,
        targetLanguage = targetLanguage,
    )
