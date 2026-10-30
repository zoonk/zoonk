package com.zoonk.android.feature.onboarding

import com.zoonk.api.ApiJson
import com.zoonk.api.models.Goal
import com.zoonk.api.models.LanguageLevelTest
import com.zoonk.api.models.MockOptions
import com.zoonk.api.models.Placement
import com.zoonk.api.models.Plan
import com.zoonk.api.models.Syllabus
import java.time.LocalDate

internal const val ITEM_ID = "2b3c4d5e-6f70-4a81-9b2c-3d4e5f607182"
internal const val NEXT_ITEM_ID = "3c4d5e6f-7081-4b92-8c3d-4e5f60718293"
internal const val MOCK_ID = "4d5e6f70-8192-4ca3-9d4e-5f6071829304"
private const val SKILL_ID = "5e6f7081-92a3-4db4-8e5f-607182930415"
private const val PLAN_ID = "6f708192-a3b4-4ec5-9f60-718293041526"

internal fun choiceQuestion(
    itemId: String = ITEM_ID,
    question: String = "Which court hears appeals from state courts?",
    options: List<String> = listOf("The Supreme Court", "A district court", "A county court"),
) = """
    {"context":null,"image":null,"itemId":"$itemId","skillId":"$SKILL_ID","visual":null,"format":"multipleChoice",
     "options":[${options.joinToString(",") { "\"$it\"" }}],"question":"$question","select":1}
    """.trimIndent()

internal fun trueFalseQuestion(
    itemId: String = ITEM_ID,
    statement: String = "A contract needs consideration to be binding.",
    visual: String = "null",
) = """
    {"context":null,"image":null,"itemId":"$itemId","skillId":"$SKILL_ID","visual":$visual,"format":"trueFalse",
     "options":null,"question":"$statement"}
    """.trimIndent()

internal fun typedQuestion(
    itemId: String = ITEM_ID,
    question: String = "In your own words, what is hearsay?",
) = """
    {"context":"A witness repeats what a neighbor told them.","image":null,"itemId":"$itemId","skillId":"$SKILL_ID","visual":null,
     "format":"typed","options":null,"question":"$question"}
    """.trimIndent()

internal fun placementOf(
    status: String = "asking",
    next: String? = choiceQuestion(),
    answered: Int = 0,
    started: Boolean = false,
    complete: Boolean = false,
    spent: Double = 0.0,
    dayBudgetUsed: Boolean = false,
    labels: String = "trueFalse",
): Placement =
    ApiJson.decodeFromString(
        """
        {"answered":$answered,"areas":[],"complete":$complete,"dayBudgetSpent":$spent,"dayBudgetUsed":$dayBudgetUsed,
         "knownSkillIds":[],"needsItems":[],"next":${next ?: "null"},"phases":[],"started":$started,"status":"$status",
         "trueFalseLabels":"$labels"}
        """.trimIndent(),
    )

internal fun mockOptionsOf(
    mock: String? = null,
    access: String = "open",
    minutes: List<Int> = listOf(20, 60),
): MockOptions =
    ApiJson.decodeFromString(
        """
        {"access":"$access","examDocument":"notice","examName":"Bar exam","goalId":"$GOAL_ID","lastMock":null,"options":[],
         "placement":{"mock":${mock ?: "null"},"recommended":"short","options":[${minutes.joinToString(",") {
            """{"areas":[],"coversAllAreas":true,"estimatedMinutes":$it,"length":"short","minutes":$it,"questions":10}"""
        }}]},
         "running":null,"sizeSource":{"material":false,"questions":"notice","time":"notice"}}
        """.trimIndent(),
    )

internal fun runningMock() = """{"id":"$MOCK_ID","status":"running"}"""

internal fun phaseOf(
    index: Int,
    kind: String,
    state: String,
    start: LocalDate,
    end: LocalDate,
    chapters: String = "[]",
    name: String = "",
) = """
    {"chapterCount":0,"chapters":$chapters,"hours":20,"index":$index,"kind":"$kind","lessonsDone":0,"lessonsTotal":12,
     "mocks":{"count":0,"nextDate":null},"name":"$name","state":"$state","startDate":"$start","endDate":"$end"}
    """.trimIndent()

internal fun chapterOf(
    title: String,
    writing: Boolean = false,
) = """
    {"chapterId":null,"deeper":false,"far":false,"lessonsDone":0,"lessonsTotal":4,"skills":[],"state":"upcoming",
     "testedOut":false,"title":"$title","writing":$writing}
    """.trimIndent()

internal fun examPhases(today: LocalDate = LocalDate.now()) =
    listOf(
        phaseOf(0, "foundations", "current", today, today.plusDays(20)),
        phaseOf(1, "practice", "upcoming", today.plusDays(21), today.plusDays(40)),
        phaseOf(2, "finalStretch", "upcoming", today.plusDays(41), today.plusDays(52)),
    )

internal fun planOf(
    ready: Boolean = true,
    phases: List<String> = examPhases(),
    targetDate: LocalDate? = LocalDate.now().plusDays(53),
    dailyMinutes: Int = 30,
    notice: String? = null,
    feasibility: String? = null,
    noticeDay: String? = null,
    freeWeekOver: Boolean = false,
    numbers: String? = null,
    endDate: LocalDate? = null,
    weekStart: LocalDate = LocalDate.now(),
): Plan =
    ApiJson.decodeFromString(
        """
        {"access":{"freeUntil":null,"freeWeekOver":$freeWeekOver,"mocksRequirePlus":false},"areas":[],"changes":[],
         "estimate":{"remainingHours":40,"totalHours":40${endDate?.let { ""","endDate":"$it"""" } ?: ""}},
         "examChoices":[],"examDocument":"notice","fundedMocks":[],"goalId":"$GOAL_ID","phases":[${phases.joinToString(",")}],
         "planId":"$PLAN_ID","ready":$ready${notice?.let {
            ""","notice":"$it""""
        } ?: ""}${feasibility?.let { ""","feasibility":$it""" } ?: ""}
         ${numbers?.let { ""","numbers":$it""" } ?: ""},
         "schedule":{"dailyMinutes":$dailyMinutes,"fullCourse":false,"lightWeeks":[],"studyDays":5,"targetDateEstimated":false,
           "targetDateNamedMonth":false,"shape":{"canDiffer":false,"weekdayDays":[1,2,3,4,5],"weekdays":30,"weekend":null,"weekendDays":[]},"weekdayMinutes":[0,30,30,30,30,30,0]${targetDate?.let { ""","targetDate":"$it"""" } ?: ""}
           ${noticeDay?.let { ""","noticeDay":$it""" } ?: ""}},
         "steering":{"difficultyBias":"standard","lessonsStudied":0,"practiceBias":"balanced","skippedActivities":[]},
         "tools":[],"week":{"days":[],"startDate":"$weekStart","endDate":"${weekStart.plusDays(6)}"},
         "weekTime":{"studiedMinutes":0,"targetMinutes":150}}
        """.trimIndent(),
    )

internal fun numbersOf(beforeDeadlineMinutes: Double) =
    """
    {"beforeDeadlineMinutes":$beforeDeadlineMinutes,"scheduledMinutes":${beforeDeadlineMinutes + 60},"context":{"dailyMinutes":30,
     "fromDate":"${LocalDate.now()}","fullCourse":false,"paceFactor":1,"targetDate":"${LocalDate.now().plusDays(53)}",
     "weekdayMinutes":[0,30,30,30,30,30,0]},
     "workload":{"checkpointMinutes":0,"lessonMinutes":0,"practiceMinutes":0,"unwrittenLessonMinutes":0}}
    """.trimIndent()

internal fun feasibilityOf(
    coveredShare: Double = 0.8,
    coreFits: Boolean = true,
    measure: String = "exam",
    deepensMostAsked: Boolean = true,
) = """
    {"coreFits":$coreFits,"coveredShare":$coveredShare,"deadline":"${LocalDate.now().plusDays(53)}",
     "deepensMostAsked":$deepensMostAsked,"fits":false,"measure":"$measure","timeCovers":false}
    """.trimIndent()

internal fun subjectOf(
    name: String,
    percent: Int? = null,
    assumed: Boolean = false,
    questions: Int? = null,
    topics: String = "[]",
) = """
    {"areas":["$name"],"chapters":[],"key":"${name.lowercase().replace(' ', '-')}","lessonsDone":0,"lessonsKnown":0,
     "lessonsTotal":10,"matrix":[],"name":"$name","shortName":"$name","source":"notice","topics":$topics
     ${questions?.let { ""","questions":$it""" } ?: ""}
     ${percent?.let {
    ""","displayWeight":{"basis":"${if (assumed) "assumed" else "stated"}","percent":$it,"share":${it / 100.0}}"""
} ?: ""}}
    """.trimIndent()

internal fun topicOf(
    name: String,
    status: String = "toStudy",
    notPlannedReason: String? = null,
) = """{"chapters":[],"name":"$name","status":"$status"${notPlannedReason?.let { ""","notPlannedReason":"$it"""" } ?: ""}}"""

internal fun syllabusOf(
    subjects: List<String>,
    kind: String = "notice",
    topicCount: Int = 0,
    topicsMapped: Boolean = true,
    fromMaterial: Boolean = false,
): Syllabus =
    ApiJson.decodeFromString(
        """
        {"examDocument":"notice","fromMaterial":$fromMaterial,"goal":{"id":"$GOAL_ID","kind":"exam","title":"Pass the bar exam"},
         "kind":"$kind","knownTopicsReturn":"practice","lessons":{"done":0,"known":0,"total":40},
         "subjects":[${subjects.joinToString(",")}],"topicCount":$topicCount,"topicsMapped":$topicsMapped}
        """.trimIndent(),
    )

internal fun examGoal(): Goal = goalCreated().goals.single()

internal fun readingQuestion(
    id: String = "reading-1",
    passage: String = "Marco va al mercato ogni sabato.",
) = """
    {"kind":"question","question":{"id":"$id","level":"A2","options":["Every Saturday","Every Sunday","Never"],
     "passage":"$passage","question":"When does Marco go to the market?","skill":"reading"}}
    """.trimIndent()

internal fun listeningQuestion(id: String = "listening-1") =
    """
    {"kind":"question","question":{"id":"$id","level":"A2","options":["At the station","At home"],
     "passage":"Ci vediamo alla stazione alle otto.","question":"Where are they meeting?","skill":"listening"}}
    """.trimIndent()

internal const val SPEAKING_NEXT =
    """{"kind":"speaking","speaking":{"level":"A2","sentence":"Vorrei un caffè, per favore.","translation":"I'd like a coffee, please."}}"""

internal const val DONE_NEXT = """{"kind":"done"}"""

internal fun skillLevelOf(
    skill: String,
    label: String,
    score: Double,
) = """{"label":"$label","score":$score,"skill":"$skill"}"""

internal fun levelTestOf(
    next: String = readingQuestion(),
    answered: Int = 0,
    total: Int = 12,
    levels: List<String> = emptyList(),
): LanguageLevelTest =
    ApiJson.decodeFromString(
        """
        {"answered":$answered,"lastCorrect":null,"levels":[${levels.joinToString(",")}],"next":$next,"status":"ready",
         "targetLanguage":"it","total":$total}
        """.trimIndent(),
    )

internal fun preparingTestOf(startedAt: String? = null): LanguageLevelTest =
    ApiJson.decodeFromString(
        """{"expectedSeconds":120,"startedAt":${startedAt?.let { "\"$it\"" } ?: "null"},"status":"preparing"}""",
    )
