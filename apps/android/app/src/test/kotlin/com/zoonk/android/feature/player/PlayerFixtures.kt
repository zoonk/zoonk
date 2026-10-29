package com.zoonk.android.feature.player

import com.zoonk.android.feature.player.model.ActivityCheck
import com.zoonk.android.feature.player.model.ActivityFrame
import com.zoonk.android.feature.player.model.ActivityStepContent
import com.zoonk.android.feature.player.model.CheckOption
import com.zoonk.android.feature.player.model.CheckStepContent
import com.zoonk.android.feature.player.model.ExplanationStepContent
import com.zoonk.android.feature.player.model.GuessHook
import com.zoonk.android.feature.player.model.GuessOption
import com.zoonk.android.feature.player.model.LanguageExercise
import com.zoonk.android.feature.player.model.LessonStep
import com.zoonk.android.feature.player.model.SpokenAnswerStepContent
import com.zoonk.android.feature.player.model.StepContent
import com.zoonk.android.feature.player.model.StepKind
import com.zoonk.android.feature.player.model.StepResult
import com.zoonk.android.feature.player.model.StepVisual
import com.zoonk.android.feature.player.model.SummaryStepContent
import com.zoonk.android.feature.player.model.TypedAnswerStepContent
import com.zoonk.android.feature.player.model.WorkedExampleStepContent
import com.zoonk.api.ApiJson
import com.zoonk.api.models.PlayableLibraryStepAnyOf4ContentOneOf
import com.zoonk.api.models.PlayableLibraryStepAnyOf6ContentIdeasInner
import com.zoonk.api.models.PlayableLibraryStepAnyOf8ContentStepsInner

fun explanationStep(
    id: String,
    skillId: String? = null,
    visual: StepVisual? = null,
) = LessonStep(id, skillId, StepContent.Explanation(ExplanationStepContent(text = "Idea $id", title = "Title $id", visual = visual)))

fun workedExampleStep(id: String) =
    LessonStep(
        id,
        null,
        StepContent.WorkedExample(
            WorkedExampleStepContent(
                problem = "What is 25% of 80?",
                result = "20",
                steps =
                    listOf("Split 80 into four parts", "Each part is 20", "So 25% is 20")
                        .map { PlayableLibraryStepAnyOf8ContentStepsInner(text = it) },
            ),
        ),
    )

fun checkStep(
    id: String,
    skillId: String? = null,
) = LessonStep(
    id,
    skillId,
    StepContent.Check(
        CheckStepContent(
            basis = null,
            options =
                listOf(
                    CheckOption(id = "right", isCorrect = true, reason = "Because it is.", text = "Right"),
                    CheckOption(id = "wrong", isCorrect = false, reason = "That's the trap.", text = "Wrong"),
                ),
            question = "Question $id?",
        ),
    ),
)

fun hookGuessStep(id: String) =
    LessonStep(
        id,
        null,
        StepContent.Guess(
            GuessHook(
                options = listOf(GuessOption("yes", false, "Yes"), GuessOption("no", true, "No")),
                question = "Guess?",
                reveal = "No, and here's why.",
                variant = PlayableLibraryStepAnyOf4ContentOneOf.Variant.GUESS,
            ),
        ),
    )

fun typedAnswerStep(id: String) =
    LessonStep(
        id,
        null,
        StepContent.TypedAnswer(
            TypedAnswerStepContent(
                basis = null,
                keyPoints = listOf("Names the cloud"),
                question = "Why a cloud?",
                sampleAnswer = "Because it maps chances.",
            ),
        ),
    )

fun numberAnswerStep(id: String) =
    LessonStep(
        id,
        null,
        StepContent.TypedAnswer(
            TypedAnswerStepContent(
                basis = null,
                keyPoints = listOf("Finds 20"),
                question = "What is 25% of 80?",
                sampleAnswer = "20",
                acceptedAnswers = listOf("20"),
            ),
        ),
    )

fun spokenStep(id: String) =
    LessonStep(
        id,
        null,
        StepContent.SpokenAnswer(
            SpokenAnswerStepContent(
                language = "es",
                prompt = "Say that you're hungry",
                targetText = "Tengo hambre",
                translation = "I'm hungry",
            ),
            listening = null,
        ),
    )

fun summaryStep(id: String) =
    LessonStep(id, null, StepContent.Summary(SummaryStepContent(listOf(PlayableLibraryStepAnyOf6ContentIdeasInner("One idea.")))))

fun fillBlankStep(id: String) =
    LessonStep(
        id,
        null,
        StepContent.Language(
            StepKind.FillBlank,
            ApiJson.decodeFromString(
                LanguageExercise.serializer(),
                """
                {"content":{"answers":["pay"],"distractors":["rent"],"feedback":"You pay rent.","question":"Fill in the blank","template":"I [BLANK] rent."},
                 "fillBlankOptions":[],"id":"00000000-0000-4000-8000-000000000001","kind":"fillBlank","matchColumnsRightItems":[],"position":0,"sentence":null,
                 "sentenceWordOptions":[],"translationOptions":[],"vocabularyOptions":[],"word":null,"wordBankOptions":[]}
                """.trimIndent(),
            ),
            null,
        ),
    )

fun stepResult(
    isCorrect: Boolean,
    attemptId: String? = null,
) = StepResult(
    isCorrect = isCorrect,
    answerText = if (isCorrect) "Right" else "Wrong",
    correctAnswer = if (isCorrect) null else "Right",
    feedback = "Because.",
    attemptId = attemptId,
)

private const val ACTIVITY_CHECK =
    """{"kind":"choice","question":"Which line rises fastest?","options":[{"id":"a","isCorrect":true,"reason":"It doubles every step.","text":"Line A"},{"id":"b","isCorrect":false,"reason":"It stays flat.","text":"Line B"}]}"""

/** A choice activity whose template has no renderer: the frame alone asks it. */
fun activityStep(id: String): LessonStep {
    val content =
        ApiJson.decodeFromString(
            ActivityStepContent.serializer(),
            """{"template":"formulaModel","prompt":"Compare the two lines.","fields":{"outputs":[],"variables":[]},"check":$ACTIVITY_CHECK}""",
        )
    val frame =
        ActivityFrame("formulaModel", "Compare the two lines.", ApiJson.decodeFromString(ActivityCheck.serializer(), ACTIVITY_CHECK))
    return LessonStep(id, null, StepContent.Activity(content, frame, minTolerance = null))
}
