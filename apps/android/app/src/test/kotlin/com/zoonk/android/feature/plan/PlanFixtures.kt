package com.zoonk.android.feature.plan

import com.zoonk.api.ApiJson
import com.zoonk.api.models.GoalProgress
import com.zoonk.api.models.LearnerSummary
import com.zoonk.api.models.Plan
import com.zoonk.api.models.PlanTimeToCover
import com.zoonk.api.models.Syllabus
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.decodeFromJsonElement
import kotlinx.serialization.json.jsonObject

internal const val GOAL = "6f1c2c1e-1b8a-4d8e-9a77-2d8f4b0f1a01"
internal const val PLAN_ID = "6f1c2c1e-1b8a-4d8e-9a77-2d8f4b0f1a02"

/** The fewest fields a plan reads with; [extra]'s top-level fields replace or add to them. */
internal fun plan(extra: String = ""): Plan {
    val base =
        ApiJson
            .parseToJsonElement(
                """
                {"access":{"freeWeekOver":false,"mocksRequirePlus":false},"areas":[],"changes":[],
                 "estimate":{"remainingHours":10,"totalHours":12},"examChoices":[],"examDocument":"guide",
                 "fundedMocks":[],"goalId":"$GOAL","phases":[],"planId":"$PLAN_ID","ready":true,
                 "schedule":{"dailyMinutes":20,"fullCourse":false,"lightWeeks":[],"studyDays":5,
                  "targetDateEstimated":false,"targetDateNamedMonth":false,"weekdayMinutes":[0,20,20,20,20,20,0]},
                 "steering":{"difficultyBias":"standard","lessonsStudied":0,"practiceBias":"balanced","skippedActivities":[]},
                 "tools":[],"week":{"days":[],"endDate":"2026-11-01","startDate":"2026-10-26"},
                 "weekTime":{"studiedMinutes":0,"targetMinutes":100}}
                """.trimIndent(),
            ).jsonObject
    val fields = if (extra.isEmpty()) emptyMap() else ApiJson.parseToJsonElement("{$extra}").jsonObject
    return ApiJson.decodeFromJsonElement<Plan>(JsonObject(base + fields))
}

internal fun progress(
    value: Double = 0.42,
    goalId: String = GOAL,
): GoalProgress =
    ApiJson.decodeFromString(
        """
        {"goal":{"id":"$goalId","kind":"learn","targetDate":null,"title":"Learn Python"},"mistakes":{"open":0},
         "stillNeeded":{"areas":[],"left":12,"minutes":240,"rule":"solid"},
         "preparation":{"areas":[],"goalId":"$goalId","sections":[],"stage":"building","value":$value,"weekGain":0.03,
          "skills":{"fading":2,"learning":3,"mastered":1,"new":10,"solid":2,"total":18},
          "components":{"coverage":{"heaviest":{"studiedSkills":2,"totalSkills":5,"value":0.4},"studiedSkills":6,"totalSkills":18,"value":0.33},
           "mastery":{"answered":20,"correct":15,"evidence":0.5,"supported":0.7,"value":0.75},
           "mocks":{"kind":"weeklyChallenges","plusRequired":false,"taken":1,"value":0.6},
           "retention":{"studiedSkills":6,"value":0.8}}}}
        """.trimIndent(),
    )

internal fun syllabus(): Syllabus =
    ApiJson.decodeFromString(
        """
        {"examDocument":"guide","fromMaterial":false,"goal":{"id":"$GOAL","kind":"learn","title":"Learn Python"},
         "kind":"modules","knownTopicsReturn":"practice","lessons":{"done":0,"known":0,"total":0},"subjects":[],
         "topicCount":0,"topicsMapped":true}
        """.trimIndent(),
    )

internal const val CHAPTER_DONE = "6f1c2c1e-1b8a-4d8e-9a77-2d8f4b0f1b01"
internal const val CHAPTER_NEXT = "6f1c2c1e-1b8a-4d8e-9a77-2d8f4b0f1b02"
internal const val CHAPTER_LATER = "6f1c2c1e-1b8a-4d8e-9a77-2d8f4b0f1b03"
internal const val CHECKPOINT_ITEM = "6f1c2c1e-1b8a-4d8e-9a77-2d8f4b0f1c01"
internal const val FAR_SKILL = "6f1c2c1e-1b8a-4d8e-9a77-2d8f4b0f1e01"

internal fun chapter(
    id: String?,
    title: String,
    state: String,
    done: Int,
    total: Int,
    writing: Boolean = false,
    far: Boolean = false,
    nextDate: String? = null,
    skillId: String? = null,
) = """{"chapterId":${id?.let { "\"$it\"" }},"deeper":false,"far":$far,"lessonsDone":$done,"lessonsTotal":$total,
    "nextDate":${nextDate?.let { "\"$it\"" }},"skillId":${skillId?.let { "\"$it\"" }},"skills":[],"state":"$state","testedOut":false,
    "title":"$title","writing":$writing}"""

internal fun phase(
    index: Int,
    name: String,
    state: String,
    start: String,
    end: String,
    done: Int,
    total: Int,
    chapters: List<String> = emptyList(),
    checkpoint: String? = null,
    kind: String = "learn",
    mocks: String = """{"count":0}""",
) = """{"chapterCount":${chapters.size},"chapters":[${chapters.joinToString(",")}],"checkpoint":$checkpoint,"startDate":"$start",
    "endDate":"$end","hours":10,"index":$index,"kind":"$kind","lessonsDone":$done,"lessonsTotal":$total,"mocks":$mocks,
    "name":"$name","state":"$state"}"""

/** A learn goal three weeks into four phases: the second one open, its next chapter half done, a day behind. */
internal fun learnPlan(): Plan =
    plan(
        """
        "phases":[
          ${phase(
            0,
            "Python basics",
            "done",
            "2026-10-01",
            "2026-10-14",
            6,
            6,
            listOf(chapter(CHAPTER_DONE, "Variables and types", "done", 6, 6)),
            """{"locked":false,"planItemId":"$CHECKPOINT_ITEM","state":"done","when":"date","date":"2026-10-14"}""",
        )},
          ${phase(
            1,
            "Data structures",
            "current",
            "2026-10-15",
            "2026-11-10",
            3,
            12,
            listOf(
                chapter(CHAPTER_DONE, "Lists", "done", 4, 4),
                chapter(CHAPTER_NEXT, "Dictionaries", "current", 2, 5, nextDate = "2026-10-28"),
                chapter(CHAPTER_LATER, "Sets and tuples", "upcoming", 0, 3, nextDate = "2026-11-03"),
                chapter(null, "", "upcoming", 0, 0, writing = true),
            ),
            """{"locked":false,"planItemId":null,"state":"upcoming","when":"date","date":"2026-11-10"}""",
        )},
          ${phase(
            2,
            "Web apps",
            "upcoming",
            "2026-11-11",
            "2026-12-20",
            0,
            18,
            listOf(chapter(null, "Flask", "upcoming", 0, 0, writing = true, far = true, nextDate = "2026-11-11", skillId = FAR_SKILL)),
        )},
          ${phase(3, "Projects", "upcoming", "2026-12-21", "2027-01-31", 0, 10)}
        ],
        "currentPhase":1,
        "schedule":{"dailyMinutes":20,"fullCourse":false,"lightWeeks":[],"studyDays":5,"targetDate":"2027-01-31",
          "targetDateEstimated":false,"targetDateNamedMonth":false,"weekdayMinutes":[30,20,20,20,20,20,30]},
        "status":{"kind":"behind","days":2,"extraMinutesPerDay":10,"lessons":null},
        "week":{"startDate":"2026-10-26","endDate":"2026-11-01","days":[
          {"date":"2026-10-26","items":[],"minutes":20,"state":"done"},
          {"date":"2026-10-27","items":[],"minutes":20,"state":"missed"},
          {"date":"2026-10-28","items":[],"minutes":20,"state":"today"},
          {"date":"2026-10-29","items":[],"minutes":20,"state":"upcoming"},
          {"date":"2026-10-30","items":[],"minutes":20,"state":"upcoming"},
          {"date":"2026-10-31","items":[],"minutes":30,"state":"upcoming"},
          {"date":"2026-11-01","items":[],"minutes":0,"state":"rest"}]},
        "weekTime":{"studiedMinutes":20,"targetMinutes":130}
        """.trimIndent(),
    )

internal fun learnerSummary(
    kind: String = "learn",
    status: String = "active",
    title: String = "Learn Python",
): LearnerSummary =
    ApiJson.decodeFromString(
        """
        {"account":{"email":"ana@zoonk.test","image":null,"name":"Ana"},"activeGoalId":"$GOAL",
         "analytics":{"disabled":false,"goal":null,"plan":"free","username":null},
         "buddy":{"beltColor":"white","energy":null,"glasses":"round","kind":"zu","name":null,"studiedToday":false},
         "day":null,"goals":[{"courseId":null,"dailyMinutes":20,"id":"$GOAL","isActive":true,"kind":"$kind","status":"$status",
          "targetDate":"2027-01-31","targetLanguage":null,"title":"$title"}],
         "identity":{"expiresAt":1793186000000,"isAnonymous":false,"signedInAt":1761650000000,"userId":"0b6f8f62-58a5-4e0e-8f0e-2f7d0ad0c0a1"},
         "level":null,"missions":null,"nextChangeAt":1793186000000,
         "places":{"exam":false,"mindMaps":true,"readyMistakes":0,"speaking":false},
         "readAt":1761650000000,"tier":"free","timeZone":null,"today":null}
        """.trimIndent(),
    )

internal const val CHANGE_ID = "6f1c2c1e-1b8a-4d8e-9a77-2d8f4b0f1d01"

/** A saved change; [effect] and [extra] are raw JSON fields. */
internal fun planChange(
    operations: String = "[]",
    kind: String = "edited",
    status: String = "applied",
    source: String = "learner",
    effect: String? = null,
    extra: String = "",
    createdAt: String = "2026-10-28T12:00:00Z",
    id: String = CHANGE_ID,
): com.zoonk.api.models.PlanChange =
    ApiJson.decodeFromString(
        """
        {"canApply":true,"canUndo":true,"createdAt":"$createdAt","examDocument":"notice","id":"$id",
         "kind":"$kind","lessonsSkipped":0,"operations":$operations,"seen":false,"source":"$source","status":"$status"
         ${effect?.let { ""","effect":$it""" }.orEmpty()}${if (extra.isEmpty()) "" else ",$extra"}}
        """.trimIndent(),
    )

internal fun effect(fields: String = ""): String = """{"lessonsAdded":0,"lessonsRemoved":0${if (fields.isEmpty()) "" else ",$fields"}}"""

/** A plan whose time a day doesn't cover everything by its date; [extra]'s top-level fields add to it. */
internal fun coveragePlan(
    kind: String = "goal",
    coreFits: Boolean = true,
    timeCovers: Boolean = false,
    fullCourse: Boolean = false,
    areas: String = "[]",
    extra: String = "",
): Plan =
    plan(
        """
        ${if (extra.isEmpty()) "" else "$extra,"}
        "areas":$areas,
        "feasibility":{"coreFits":$coreFits,"coveredShare":0.6,"deadline":"2027-01-31","deepensMostAsked":false,"fits":false,
         "measure":"$kind","timeCovers":$timeCovers},
        "schedule":{"dailyMinutes":20,"fullCourse":$fullCourse,"lightWeeks":[],"studyDays":5,"targetDate":"2027-01-31",
         "targetDateEstimated":false,"targetDateNamedMonth":false,"weekdayMinutes":[0,20,20,20,20,20,0]}
        """.trimIndent(),
    )

internal fun area(
    name: String,
    focused: Boolean = false,
    partOf: String? = null,
    skipped: Boolean = false,
) = """{"focusPart":null,"focused":$focused,"name":"$name","partOf":${partOf?.let { "\"$it\"" }},"pastBasics":false,
    "reduced":false,"skillCount":4,"skipped":$skipped}"""

internal fun timeToCover(
    recommended: Long? = 45,
    core: Long? = null,
    fittingDate: String? = null,
    ready: Boolean = true,
): PlanTimeToCover =
    PlanTimeToCover(
        coreMinutes = core,
        fittingDate = fittingDate?.let(kotlinx.datetime.LocalDate::parse),
        ready = ready,
        recommendedMinutes = recommended,
        suggested = null,
        targetDate = kotlinx.datetime.LocalDate.parse("2027-01-31"),
        targetDateNamedMonth = false,
    )
