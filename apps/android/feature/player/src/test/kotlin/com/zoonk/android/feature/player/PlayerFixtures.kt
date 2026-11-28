package com.zoonk.android.feature.player

import com.zoonk.android.feature.player.engine.LESSON_MAP_STEP_ID
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
import com.zoonk.api.models.LessonMap
import com.zoonk.api.models.LessonMapIdeasInner
import com.zoonk.api.models.PlayableLibraryStepAnyOf4ContentOneOf
import com.zoonk.api.models.PlayableLibraryStepAnyOf6ContentIdeasInner
import com.zoonk.api.models.PlayableLibraryStepAnyOf8ContentStepsInner
import com.zoonk.api.models.PlayableLibraryStepAnyOf3ContentExampleLineSlot as ExampleLineSlot
import com.zoonk.api.models.PlayableLibraryStepAnyOfContentOneOf11FieldsPicture as OptionPicture

fun explanationStep(
    id: String,
    skillId: String? = null,
    visual: StepVisual? = null,
    exampleIdea: String? = null,
) = LessonStep(
    id,
    skillId,
    StepContent.Explanation(
        ExplanationStepContent(
            text = "Idea $id",
            title = "Title $id",
            visual = visual,
            exampleLineSlot = exampleIdea?.let(::ExampleLineSlot),
        ),
    ),
)

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

/** A spoken screen; [heardInstead] gives it the listening exercise a learner who can't talk does instead. */
fun spokenStep(
    id: String,
    heardInstead: Boolean = false,
) = LessonStep(
    id,
    null,
    StepContent.SpokenAnswer(
        SpokenAnswerStepContent(
            language = "es",
            prompt = "Say that you're hungry",
            targetText = "Tengo hambre",
            translation = "I'm hungry",
        ),
        listening = (fillBlankStep("$id-heard").content as StepContent.Language).exercise.takeIf { heardInstead },
    ),
)

fun lessonMapStep() =
    LessonStep(
        LESSON_MAP_STEP_ID,
        null,
        StepContent.Map(
            LessonMap(ideas = listOf(LessonMapIdeasInner(text = "A cloud is tiny droplets.")), shape = LessonMap.Shape.HUB),
            "Clouds",
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
                 "fillBlankOptions":[],"id":"00000000-0000-4000-8000-000000000001","kind":"fillBlank","matchColumnsRightItems":[],"position":0,"readingPromptWords":[],"sentence":null,
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

private const val RENDERERLESS_FIELDS = """{"elements":["C","O","H"],"formula":"CO2"}"""

/** Every real template gets a renderer in time, so the frame names one that never will. */
private const val RENDERERLESS_TEMPLATE = "notInTheApp"

/** An activity whose template has no renderer: the frame alone asks it. */
fun activityStep(
    id: String,
    check: String = ACTIVITY_CHECK,
): LessonStep {
    val content =
        ApiJson.decodeFromString(
            ActivityStepContent.serializer(),
            """{"template":"moleculeBuilder","prompt":"Compare the two lines.","fields":$RENDERERLESS_FIELDS,"check":$check}""",
        )
    val frame =
        ActivityFrame(RENDERERLESS_TEMPLATE, "Compare the two lines.", ApiJson.decodeFromString(ActivityCheck.serializer(), check))
    return LessonStep(id, null, StepContent.Activity(content, frame))
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

private const val DETECTOR_SCAN =
    """
    {"kind":"plot","title":"Detector scan","xLabel":"Detector position","xUnit":"mm","yLabel":"Count rate","yUnit":"counts/s",
     "series":[{"name":"Scan","mark":"points","points":[{"x":0.5,"y":810,"label":"A"},{"x":1.5,"y":880,"label":"B"},
       {"x":3,"y":952,"label":"C"},{"x":4.5,"y":890,"label":"D"},{"x":5.5,"y":820,"label":"E"}]}],
     "references":[],"source":null}
    """

private const val FINE_SCAN =
    """
    {"kind":"plot","title":"Finer scan, B to D","xLabel":"Detector position","xUnit":"mm","yLabel":"Count rate","yUnit":"counts/s",
     "series":[{"name":"Fine scan","mark":"lineWithPoints","points":[{"x":1.5,"y":880,"label":null},{"x":2,"y":930,"label":null},
       {"x":2.25,"y":968,"label":null},{"x":2.5,"y":992,"label":null},{"x":2.75,"y":975,"label":null},{"x":3,"y":952,"label":null},
       {"x":3.25,"y":925,"label":null},{"x":3.5,"y":905,"label":null},{"x":4,"y":893,"label":null},{"x":4.5,"y":890,"label":null}]}],
     "references":[{"label":"Needed tonight","y":960}],"source":null}
    """

private val CHART_CHALLENGE =
    """
    {"variant":"work","setting":"Beamline 4, 6 pm","title":"Where should the detector sit tonight?",
     "mission":"Pick **one spot** for the detector so tonight's run gets the strongest signal.",
     "team":[{"id":"lead","ai":false,"expertise":"Runs the beamline schedule","role":"Lab lead"},
       {"id":"postdoc","ai":false,"expertise":"Set up the detector","role":"Postdoc"},
       {"id":"ai","ai":true,"expertise":"Runs scans when asked","role":"AI assistant"}],
     "meters":[{"id":"beam","goodWhen":"high","label":"Beam time left","start":90},{"id":"signal","goodWhen":"high","label":"Signal quality","start":50}],
     "panels":[{"title":"Previous run","metrics":[{"label":"Run length","value":"8 hours"}]}],
     "skills":[{"id":"reading","name":"Reading a scan","practice":"Before trusting the highest point, ask what happens between the points."}],
     "startNodeId":"start",
     "nodes":[
       {"id":"start","prompt":"Where do you put the detector for the night?",
        "messages":[{"from":"lead","text":"Scan's done. We get one night of beam, so the detector stays in one spot."},
          {"from":"postdoc","text":"C has the highest count. I'd park it there and go home."}],
        "visual":$DETECTOR_SCAN,
        "choices":[
          {"id":"park-c","text":"Park it at C, where the count peaks","next":"fine","quality":"weak","effects":[{"meter":"signal","change":-20}],
           "notes":[{"kind":"improve","skill":"reading","text":"Five points 1 mm apart can't show where the real peak is."}],
           "replies":[{"from":"lead","text":"Before we lock it at C, let the AI scan finer between B and D."}]},
          {"id":"fine-scan","text":"Scan again in finer steps from B to D","next":"fine","quality":"strong",
           "effects":[{"meter":"beam","change":-10},{"meter":"signal","change":20}],
           "notes":[{"kind":"good","skill":"reading","text":"You checked between the points before trusting the highest one."}],
           "replies":[{"from":"ai","text":"Done. Here's the finer scan between B and D."}]},
          {"id":"park-a","text":"Park it at A, where the noise is lowest","next":"fine","quality":"weak","effects":[{"meter":"signal","change":-30}],
           "notes":[{"kind":"improve","skill":"reading","text":"A has the lowest count on the chart, so it gives the weakest signal."}],
           "replies":[{"from":"lead","text":"A is our weakest spot. Let the AI scan finer between B and D first."}]}]},
       {"id":"fine","prompt":"Where does the detector go?",
        "messages":[{"from":"lead","text":"We need at least 960 counts a second for a clean run."}],
        "visual":$FINE_SCAN,
        "choices":[
          {"id":"park-peak","text":"Park it at the new peak, at 2.5 mm","next":"clean-run","quality":"strong","effects":[{"meter":"signal","change":20}],
           "notes":[{"kind":"good","skill":"reading","text":"You read the peak off the finer scan, not the coarse one."}],
           "replies":[{"from":"lead","text":"2.5 mm it is. Good catch."}]},
          {"id":"park-c-anyway","text":"Stay with C at 3 mm","next":"missed-peak","quality":"fair","effects":[{"meter":"signal","change":-10}],
           "notes":[{"kind":"improve","skill":"reading","text":"The finer scan peaks at 2.5 mm, and C falls under the count you needed."}],"replies":[]}]}],
     "endings":[{"id":"clean-run","outcome":"The run hit 990 counts a second all night: a clean data set."},
       {"id":"missed-peak","outcome":"The detector sat off the peak. The night's data came out too thin to publish."}]}
    """

fun chartChallengeStep(id: String) =
    LessonStep(id, null, StepContent.Challenge(ApiJson.decodeFromString(ChallengeStepContent.serializer(), CHART_CHALLENGE)))

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
