package com.zoonk.android.feature.player

import com.zoonk.android.feature.player.model.ActivityCheck
import com.zoonk.android.feature.player.model.ActivityFrame
import com.zoonk.android.feature.player.model.ActivityStepContent
import com.zoonk.android.feature.player.model.ChallengeStepContent
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
import com.zoonk.api.models.PlayableLibraryStepAnyOfContentOneOf11FieldsPicture as OptionPicture

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

/** A check only the template's own canvas can answer, so a template without a renderer can't be played. */
const val INTERACTION_ACTIVITY_CHECK = """{"kind":"interaction","explanation":"The lines cross at x = 2."}"""

const val NUMERIC_ACTIVITY_CHECK =
    """{"kind":"numeric","question":"How much do you pay?","answer":52,"tolerance":{"kind":"absolute","value":0},"unit":"R$","explanation":"You pay 65% of R$80."}"""

private const val RENDERERLESS_FIELDS = """{"pattern":"x..x","rounds":1,"stepsPerBeat":4,"tempo":90,"toleranceMs":100}"""

/** An activity whose template has no renderer: the frame alone asks it. */
fun activityStep(
    id: String,
    check: String = ACTIVITY_CHECK,
): LessonStep {
    val content =
        ApiJson.decodeFromString(
            ActivityStepContent.serializer(),
            """{"template":"rhythmTapper","prompt":"Compare the two lines.","fields":$RENDERERLESS_FIELDS,"check":$check}""",
        )
    val frame =
        ActivityFrame("rhythmTapper", "Compare the two lines.", ApiJson.decodeFromString(ActivityCheck.serializer(), check))
    return LessonStep(id, null, StepContent.Activity(content, frame, minTolerance = null))
}

private const val CHALLENGE =
    """
    {"variant":"work","setting":"Customer support","title":"A refund gone wrong","mission":"Calm the customer {{c1}} called about.",
     "team":[{"id":"c1","ai":false,"expertise":"support","role":"Support lead"},{"id":"ai","ai":true,"expertise":"policy","role":"Policy assistant"}],
     "meters":[{"id":"trust","goodWhen":"high","label":"Customer trust","start":80}],"panels":[],
     "skills":[{"id":"listen","name":"Listening","practice":"Repeat back what you heard."},{"id":"policy","name":"Policy","practice":"Read the policy."}],
     "startNodeId":"n1",
     "nodes":[{"id":"n1","prompt":"What do you say first?","messages":[{"from":"c1","text":"The customer is upset."}],
       "choices":[
         {"id":"ask","text":"Ask what happened","next":"end","quality":"strong","effects":[{"meter":"trust","change":30}],
          "notes":[{"kind":"good","skill":"listen","text":"You listened first."}],"replies":[{"from":"c1","text":"That calmed them."}]},
         {"id":"quote","text":"Quote the policy","next":"end","quality":"weak","effects":[{"meter":"trust","change":-10}],
          "notes":[{"kind":"improve","skill":"listen","text":"Listen before quoting rules.","example":"Tell me what happened."}],"replies":[]}]}],
     "endings":[{"id":"end","outcome":"The customer left calmer."}]}
    """

fun challengeContent(): ChallengeStepContent = ApiJson.decodeFromString(ChallengeStepContent.serializer(), CHALLENGE)

fun challengeStep(id: String) = LessonStep(id, null, StepContent.Challenge(challengeContent()))

/** A check whose options are pictures: their names show only once it's checked. */
fun pictureCheckStep(id: String): LessonStep {
    val check = checkStep(id)
    val content = (check.content as StepContent.Check).content
    val options =
        content.options.map {
            it.copy(picture = OptionPicture(alt = "A doorway with a ${it.text.lowercase()} arch", prompt = "A doorway"))
        }
    return check.copy(content = StepContent.Check(content.copy(options = options)))
}
