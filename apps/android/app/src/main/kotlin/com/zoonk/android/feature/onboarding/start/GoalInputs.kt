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

/** The card's goals past the [activeGoalLimit] the learner's plan follows at once are Plus's: shown locked, never sent. */
internal fun GoalUnderstandingOneOf.startableGoals(activeGoalLimit: Long?): List<UnderstoodGoal> =
    goals.take(activeGoalLimit?.toInt() ?: goals.size)

/** The first goal carries what the learner wants from their material. */
internal fun understoodGoalsInput(
    understanding: GoalUnderstandingOneOf,
    activeGoalLimit: Long?,
    materialIntent: MaterialIntent?,
    sourceIds: List<String>,
): GoalCreateInput =
    GoalCreateInput(
        dailyMinutes = understanding.schedule.dailyMinutes,
        goals =
            understanding.startableGoals(activeGoalLimit).mapIndexed { index, goal ->
                goal.draft.toGoalDraft().let { if (index == 0) it.withMaterialIntent(materialIntent) else it }
            },
        sourceIds = sourceIds.map(UUID::fromString).ifEmpty { null },
        studyDays = understanding.schedule.studyDays,
        studyTime = understanding.schedule.studyTime,
        timeZone = TimeZone.getDefault().id,
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

/** A goal its card left waiting starts as the card read it. */
internal fun GoalCreateInputOutput.toGoalCreateInput() =
    GoalCreateInput(
        dailyMinutes = dailyMinutes,
        goals = goals.map { it.toGoalDraft() },
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
        dailyMinutes = dailyMinutes,
        details = details,
        examBlueprintId = examBlueprintId,
        primaryCourseId = primaryCourseId,
        targetDate = targetDate,
        targetLanguage = targetLanguage,
    )

/** Understanding material needs a purpose, so one the words didn't give is "other". */
private fun GoalDraft.withMaterialIntent(intent: MaterialIntent?): GoalDraft {
    val value =
        when (intent) {
            MaterialIntent.Exam -> "exam"
            MaterialIntent.Understand -> "understand"
            MaterialIntent.Questions, null -> return this
        }
    val withIntent = details.orEmpty() + ("materialIntent" to JsonPrimitive(value))
    val needsPurpose = intent == MaterialIntent.Understand && withIntent["purpose"] == null
    return copy(details = if (needsPurpose) withIntent + ("purpose" to JsonPrimitive("other")) else withIntent)
}
