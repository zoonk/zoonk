package com.zoonk.android.feature.onboarding

import com.zoonk.api.ApiJson
import com.zoonk.api.models.Goal
import com.zoonk.api.models.LanguageLevelTest
import com.zoonk.api.models.MockOptions
import com.zoonk.api.models.Placement
import com.zoonk.api.models.Plan
import com.zoonk.api.models.Syllabus
import java.time.LocalDate

const val ITEM_ID = "2b3c4d5e-6f70-4a81-9b2c-3d4e5f607182"
const val NEXT_ITEM_ID = "3c4d5e6f-7081-4b92-8c3d-4e5f60718293"
const val MOCK_ID = "4d5e6f70-8192-4ca3-9d4e-5f6071829304"
private const val SKILL_ID = "5e6f7081-92a3-4db4-8e5f-607182930415"
private const val PLAN_ID = "6f708192-a3b4-4ec5-9f60-718293041526"

private fun choiceQuestion() =
    """
    {"context":null,"image":null,"itemId":"$ITEM_ID","skillId":"$SKILL_ID","visual":null,"format":"multipleChoice",
     "options":["The Supreme Court","A district court","A county court"],"question":"Which court hears appeals from state courts?","select":1}
    """.trimIndent()

fun trueFalseQuestion(itemId: String = ITEM_ID) =
    """
    {"context":null,"image":null,"itemId":"$itemId","skillId":"$SKILL_ID","visual":null,"format":"trueFalse",
     "options":null,"question":"A contract needs consideration to be binding."}
    """.trimIndent()

fun typedQuestion() =
    """
    {"context":"A witness repeats what a neighbor told them.","image":null,"itemId":"$ITEM_ID","skillId":"$SKILL_ID","visual":null,
     "format":"typed","options":null,"question":"In your own words, what is hearsay?"}
    """.trimIndent()

fun placementOf(
    status: String = "asking",
    next: String? = choiceQuestion(),
    answered: Int = 0,
    started: Boolean = false,
    complete: Boolean = false,
    spent: Double = 0.0,
    dayBudgetUsed: Boolean = false,
): Placement =
    ApiJson.decodeFromString(
        """
        {"answered":$answered,"areas":[],"complete":$complete,"dayBudgetSpent":$spent,"dayBudgetUsed":$dayBudgetUsed,
         "knownSkillIds":[],"needsItems":[],"next":${next ?: "null"},"phases":[],"started":$started,"status":"$status",
         "trueFalseLabels":"trueFalse"}
        """.trimIndent(),
    )

fun mockOptionsOf(
    mock: String? = null,
    access: String = "open",
): MockOptions =
    ApiJson.decodeFromString(
        """
        {"access":"$access","examDocument":"notice","examName":"Bar exam","goalId":"$GOAL_ID","lastMock":null,"options":[],
         "placement":{"mock":${mock ?: "null"},"recommended":"short","options":[${listOf(20, 60).joinToString(",") {
            """{"areas":[],"coversAllAreas":true,"estimatedMinutes":$it,"length":"short","minutes":$it,"questions":10}"""
        }}]},
         "running":null,"sizeSource":{"material":false,"questions":"notice","time":"notice"}}
        """.trimIndent(),
    )

fun runningMock() = """{"id":"$MOCK_ID","status":"running"}"""

fun phaseOf(
    index: Int,
    kind: String,
    state: String,
    start: LocalDate,
    end: LocalDate,
    chapters: String = "[]",
) = """
    {"chapterCount":0,"chapters":$chapters,"hours":20,"index":$index,"kind":"$kind","lessonsDone":0,"lessonsTotal":12,
     "mocks":{"count":0,"nextDate":null},"name":"","state":"$state","startDate":"$start","endDate":"$end"}
    """.trimIndent()

fun chapterOf(title: String) =
    """
    {"chapterId":null,"deeper":false,"far":false,"lessonsDone":0,"lessonsTotal":4,"skills":[],"state":"upcoming",
     "testedOut":false,"title":"$title","writing":false}
    """.trimIndent()

private fun examPhases(): List<String> {
    val today = LocalDate.now()
    return listOf(
        phaseOf(0, "foundations", "current", today, today.plusDays(20)),
        phaseOf(1, "practice", "upcoming", today.plusDays(21), today.plusDays(40)),
        phaseOf(2, "finalStretch", "upcoming", today.plusDays(41), today.plusDays(52)),
    )
}

fun planOf(
    ready: Boolean = true,
    phases: List<String> = examPhases(),
    targetDate: LocalDate? = LocalDate.now().plusDays(53),
    notice: String? = null,
    feasibility: String? = null,
    numbers: String? = null,
    endDate: LocalDate? = null,
    examChoices: String = "[]",
): Plan {
    val weekStart = LocalDate.now()
    return ApiJson.decodeFromString(
        """
        {"access":{"freeUntil":null,"freeWeekOver":false,"mocksRequirePlus":false},"areas":[],"changes":[],
         "estimate":{"remainingHours":40,"totalHours":40${endDate?.let { ""","endDate":"$it"""" } ?: ""}},
         "examChoices":$examChoices,"examDocument":"notice","fundedMocks":[],"goalId":"$GOAL_ID","phases":[${phases.joinToString(",")}],
         "planId":"$PLAN_ID","ready":$ready,"sharedExams":[]${notice?.let {
            ""","notice":"$it""""
        } ?: ""}${feasibility?.let { ""","feasibility":$it""" } ?: ""}
         ${numbers?.let { ""","numbers":$it""" } ?: ""},
         "schedule":{"dailyMinutes":30,"dailyTimes":[15,30,45],"fullCourse":false,"lightWeeks":[],"studyDays":5,"targetDateEstimated":false,
           "targetDateNamedMonth":false,
           "shape":{"canDiffer":false,"weekdayDays":[1,2,3,4,5],"weekdays":30,"weekend":null,"weekendDays":[]},
           "weekdayMinutes":[0,30,30,30,30,30,0]${targetDate?.let { ""","targetDate":"$it"""" } ?: ""}},
         "steering":{"difficultyBias":"standard","lessonsStudied":0,"practiceBias":"balanced","skippedActivities":[]},
         "tools":[],"week":{"days":[],"startDate":"$weekStart","endDate":"${weekStart.plusDays(6)}"},
         "weekTime":{"studiedMinutes":0,"targetMinutes":150}}
        """.trimIndent(),
    )
}

fun numbersOf(beforeDeadlineMinutes: Double) =
    """
    {"beforeDeadlineMinutes":$beforeDeadlineMinutes,"scheduledMinutes":${beforeDeadlineMinutes + 60},"context":{"dailyMinutes":30,
     "fromDate":"${LocalDate.now()}","fullCourse":false,"paceFactor":1,"targetDate":"${LocalDate.now().plusDays(53)}",
     "weekdayMinutes":[0,30,30,30,30,30,0]},
     "workload":{"checkpointMinutes":0,"lessonMinutes":0,"practiceMinutes":0,"unwrittenLessonMinutes":0}}
    """.trimIndent()

fun feasibilityOf(
    coreFits: Boolean = true,
    deepensMostAsked: Boolean = true,
) = """
    {"coreFits":$coreFits,"coveredShare":0.8,"deadline":"${LocalDate.now().plusDays(53)}",
     "deepensMostAsked":$deepensMostAsked,"fits":false,"measure":"exam","timeCovers":false}
    """.trimIndent()

fun subjectOf(
    name: String,
    percent: Int? = null,
    assumed: Boolean = false,
) = """
    {"areas":["$name"],"chapters":[],"key":"${name.lowercase().replace(' ', '-')}","lessonsDone":0,"lessonsKnown":0,
     "lessonsTotal":10,"matrix":[],"name":"$name","shortName":"$name","source":"notice","topics":[]
     ${percent?.let {
    ""","displayWeight":{"basis":"${if (assumed) "assumed" else "stated"}","percent":$it,"share":${it / 100.0}}"""
} ?: ""}}
    """.trimIndent()

fun syllabusOf(
    subjects: List<String>,
    kind: String = "notice",
): Syllabus =
    ApiJson.decodeFromString(
        """
        {"examDocument":"notice","fromMaterial":false,"goal":{"id":"$GOAL_ID","kind":"exam","title":"Pass the bar exam"},
         "kind":"$kind","knownTopicsReturn":"practice","lessons":{"done":0,"known":0,"total":40},
         "subjects":[${subjects.joinToString(",")}],"topicCount":0,"topicsMapped":true}
        """.trimIndent(),
    )

fun examGoal(): Goal = goalCreated().goals.single()

private fun readingQuestion() =
    """
    {"kind":"question","question":{"audio":null,"audioPending":false,"id":"reading-1","level":"A2","options":["Every Saturday","Every Sunday","Never"],
     "passage":"Marco va al mercato ogni sabato.","question":"When does Marco go to the market?","skill":"reading"}}
    """.trimIndent()

fun listeningQuestion(
    audioUrl: String? = null,
    audioPending: Boolean = false,
): String {
    val audio =
        audioUrl?.let { """{"durationMs":null,"id":"00000000-0000-4000-8000-0000000000c1","language":"it","url":"$it"}""" } ?: "null"
    return """
        {"kind":"question","question":{"audio":$audio,"audioPending":$audioPending,"id":"listening-1","level":"A2","options":["At the station","At home"],
         "passage":"Ci vediamo alla stazione alle otto.","question":"Where are they meeting?","skill":"listening"}}
        """.trimIndent()
}

const val SPEAKING_NEXT =
    """{"kind":"speaking","speaking":{"level":"A2","sentence":"Vorrei un caffè, per favore.","translation":"I'd like a coffee, please."}}"""

const val DONE_NEXT = """{"kind":"done"}"""

fun skillLevelOf(
    skill: String,
    label: String,
    score: Double,
) = """{"label":"$label","score":$score,"skill":"$skill"}"""

fun levelTestOf(
    next: String = readingQuestion(),
    answered: Int = 0,
    total: Int = 12,
    levels: List<String> = emptyList(),
): LanguageLevelTest =
    ApiJson.decodeFromString(
        """
        {"answered":$answered,"lastCorrect":null,"levels":[${levels.joinToString(",")}],"next":$next,"status":"ready",
         "showAlphabetNote":false,"targetLanguage":"it","total":$total}
        """.trimIndent(),
    )

fun preparingTestOf(startedAt: String? = null): LanguageLevelTest =
    ApiJson.decodeFromString(
        """{"expectedSeconds":120,"showAlphabetNote":false,"startedAt":${startedAt?.let {
            "\"$it\""
        } ?: "null"},"status":"preparing"}""",
    )

/** CGU 2026's specialty choice, with [subject] the option the plan follows or null until the learner picks. */
fun specialtyChoice(subject: String? = null) =
    """
    [{"group":"Especialidade","leftOut":{"examPoints":360,"examQuestions":null,"name":"Conhecimentos específicos (P3)","points":180,"questions":null},
      "options":[{"name":"Auditoria","shortName":null},{"name":"Tecnologia da Informação – Desenvolvimento de Sistemas","shortName":"Desenvolvimento de Sistemas"}],
      "subjects":[${subject?.let { "\"$it\"" }.orEmpty()}],"take":1}]
    """.trimIndent()
