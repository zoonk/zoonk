package com.zoonk.android.feature.goalcontent

import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.feature.plan.FakePlanApi
import com.zoonk.android.feature.plan.PlanApi
import com.zoonk.api.ApiJson
import com.zoonk.api.models.AreaPractice
import com.zoonk.api.models.AreaPracticeInput
import com.zoonk.api.models.GoalChapter
import com.zoonk.api.models.Syllabus
import java.util.UUID

internal const val GOAL = "6f1c2c1e-1b8a-4d8e-9a77-2d8f4b0f1a01"
internal const val SESSION = "6f1c2c1e-1b8a-4d8e-9a77-2d8f4b0f1a03"
internal const val BLOCK = "6f1c2c1e-1b8a-4d8e-9a77-2d8f4b0f1a04"

/** A chapter id per position, so a fixture's links say which chapter they open. */
internal fun chapterId(position: Int) = "c0000000-0000-4000-8000-%012d".format(position)

internal fun lessonId(position: Int) = "10000000-0000-4000-8000-%012d".format(position)

internal fun chapter(
    position: Int,
    title: String,
    state: String = "upcoming",
    done: Int = 0,
    total: Int = 4,
    known: Boolean = false,
    writing: Boolean = false,
    far: Boolean = false,
    plannedLessons: Int? = null,
    nextDate: String? = null,
    skillId: String? = null,
) = """
    {"chapterId":${if (writing) "null" else "\"${chapterId(position)}\""},"far":$far,"known":$known,
     "lessonsDone":$done,"lessonsTotal":$total,"nextDate":${nextDate?.let { "\"$it\"" } ?: "null"},
     "plannedLessons":${plannedLessons ?: "null"},"position":$position,"skillId":${skillId?.let { "\"$it\"" } ?: "null"},
     "state":"$state","title":"$title","writing":$writing}
    """.trimIndent()

private val natureChapters =
    listOf(
        chapter(1, "Motion and forces", state = "done", done = 4),
        chapter(2, "Energy", state = "done", done = 0, known = true),
        chapter(3, "Waves and sound", state = "current", done = 2, total = 5, nextDate = "2026-10-29"),
        chapter(4, "Electricity", nextDate = "2026-11-03"),
        chapter(5, "Atoms and the periodic table", nextDate = "2026-11-06"),
        chapter(6, "Chemical reactions", nextDate = "2026-11-10"),
        chapter(7, "Cells", nextDate = "2026-11-13"),
        chapter(8, "Genetics", nextDate = "2026-11-17"),
        chapter(
            9,
            "Ecology",
            writing = true,
            far = true,
            plannedLessons = 6,
            nextDate = "2027-01-11",
            skillId = "50000000-0000-4000-8000-000000000009",
        ),
    )

private val natureTopics =
    """
    {"chapters":[${natureChapters[0]}],"frequency":"high","heading":"Physics","name":"1 Mechanics","nextDate":null,"notPlannedReason":null,"status":"studied"},
    {"chapters":[${natureChapters[0]}],"frequency":null,"heading":"Physics","name":"1.1 Kinematics","nextDate":null,"notPlannedReason":null,"status":"studied"},
    {"chapters":[${natureChapters[1]}],"frequency":null,"heading":"Physics","name":"1.2 Energy and work","nextDate":null,"notPlannedReason":null,"status":"known"},
    {"chapters":[${natureChapters[2]}],"frequency":"high","heading":"Physics","name":"2 Waves","nextDate":"2026-10-29","notPlannedReason":null,"status":"inProgress"},
    {"chapters":[${natureChapters[3]}],"frequency":null,"heading":"Physics","name":"3 Electricity","nextDate":"2026-11-03","notPlannedReason":null,"status":"toStudy"},
    {"chapters":[${natureChapters[4]}],"frequency":null,"heading":"Chemistry","name":"4 Atomic structure","nextDate":"2026-11-06","notPlannedReason":null,"status":"toStudy"},
    {"chapters":[],"frequency":"low","heading":"Chemistry","name":"5 Radioactivity","nextDate":null,"notPlannedReason":"time","status":"notPlanned"},
    {"chapters":[${natureChapters[6]}],"frequency":null,"heading":"Biology","name":"6 Cells","nextDate":"2026-11-13","notPlannedReason":null,"status":"toStudy"}
    """.trimIndent()

private val natureSubject =
    """
    {"areas":["Natural sciences"],"chapters":[${natureChapters.joinToString(",")}],"displayWeight":null,
     "group":"Day 2","imageUrl":null,"key":"natural-sciences","lessonsDone":6,"lessonsKnown":4,"lessonsTotal":40,
     "mastery":{"answered":8,"correct":6},
     "matrix":["Competency 1 – Understand the natural sciences and their technologies","H1 - Recognize physical phenomena in everyday situations","H2 - Relate energy to its transformations","Competency 2 – Apply scientific methods","H3 - Interpret experiment data","Competency 3 – Weigh the environment's balance"],
     "name":"Natural sciences and their technologies","nextDate":"2026-10-29","notPlannedReason":null,"preparation":0.42,
     "questions":45,"share":0.25,"shortName":"Natural sciences","source":"notice",
     "topicFrequencySource":{"basis":"ENEM 2009–2024","title":null,"url":"https://www.qconcursos.com/enem"},
     "topics":[$natureTopics],"topicsKnown":1,"topicsStudied":2}
    """.trimIndent()

private val spanishSubject =
    """
    {"areas":["Spanish"],"chapters":[],"displayWeight":null,"group":"Day 1","imageUrl":null,"key":"spanish",
     "lessonsDone":0,"lessonsKnown":0,"lessonsTotal":0,"mastery":null,"matrix":[],"name":"Spanish","nextDate":null,
     "notPlannedReason":"skipped","preparation":null,"questions":5,"share":0.03,"shortName":"Spanish","source":"notice",
     "topicFrequencySource":null,"topics":[],"topicsKnown":null,"topicsStudied":null}
    """.trimIndent()

private val essaySubject =
    """
    {"areas":["Essay"],"chapters":[${chapter(1, "Writing the argument", state = "current", done = 1, total = 3)}],"displayWeight":null,
     "group":"Day 1","imageUrl":null,"key":"essay","lessonsDone":1,"lessonsKnown":0,"lessonsTotal":3,"mastery":null,"matrix":[],
     "name":"Essay","nextDate":"2026-10-30","notPlannedReason":null,"preparation":0.2,"questions":null,"share":null,
     "shortName":"Essay","source":"notice","topicFrequencySource":null,"topics":[],"topicsKnown":null,"topicsStudied":null}
    """.trimIndent()

private val studySkills =
    """
    {"areas":["Study skills"],"chapters":[${chapter(1, "Planning your weeks", done = 1, total = 2)}],"displayWeight":null,"group":null,
     "imageUrl":null,"key":"study-skills","lessonsDone":1,"lessonsKnown":0,"lessonsTotal":2,"mastery":null,"matrix":[],
     "name":"Study skills","nextDate":"2026-11-02","notPlannedReason":null,"preparation":null,"questions":null,"share":null,
     "shortName":"Study skills","source":"plan","topicFrequencySource":null,"topics":[],"topicsKnown":null,"topicsStudied":null}
    """.trimIndent()

/** ENEM as a notice exam: two days of subjects, one taken out, a written test and an extra area. */
internal fun examSyllabus(): Syllabus =
    ApiJson.decodeFromString(
        """
        {"courseWeights":{"course":"Medicine","edition":null,"institution":"USP","source":{"title":null,"url":"https://www.fuvest.br/pesos"},
          "subjects":[{"name":"Natural sciences and their technologies","weight":3},{"name":"Spanish","weight":1},{"name":"Essay","weight":1}]},
         "examDocument":"notice","fromMaterial":false,"goal":{"id":"$GOAL","kind":"exam","title":"Pass ENEM"},
         "kind":"notice","knownTopicsReturn":"practice","lessons":{"done":8,"known":4,"total":45},"noticeUrl":null,"passMarks":null,
         "questionsSource":{"edition":"2024 edition","title":null,"url":"https://www.gov.br/inep"},
         "subjects":[$spanishSubject,$essaySubject,$natureSubject,$studySkills],"topicCount":8,"topicsMapped":true,
         "writtenPractice":{"cadence":"weekly","finalWeeksFrom":"2027-10-01","parts":["Essay"]}}
        """.trimIndent(),
    )

/** A plan of its own modules, without a notice or topics. */
internal fun modulesSyllabus(): Syllabus =
    ApiJson.decodeFromString(
        """
        {"courseWeights":null,"examDocument":"guide","fromMaterial":false,"goal":{"id":"$GOAL","kind":"learn","title":"Learn Python"},
         "kind":"modules","knownTopicsReturn":"practice","lessons":{"done":3,"known":2,"total":20},"noticeUrl":null,"passMarks":null,
         "questionsSource":null,
         "subjects":[
          {"areas":["Basics"],"chapters":[${chapter(
            1,
            "Values",
            state = "done",
            done = 3,
            total = 3,
        )},${chapter(2, "Loops", state = "current", done = 0, total = 4)}],
           "displayWeight":null,"group":null,"imageUrl":null,"key":"basics","lessonsDone":3,"lessonsKnown":2,"lessonsTotal":10,"mastery":null,
           "matrix":[],"name":"Python basics","nextDate":"2026-10-29","notPlannedReason":null,"preparation":null,"questions":null,"share":null,
           "shortName":"Basics","source":"plan","topicFrequencySource":null,"topics":[],"topicsKnown":null,"topicsStudied":null},
          {"areas":["Data"],"chapters":[${chapter(3, "Lists")}],
           "displayWeight":null,"group":null,"imageUrl":null,"key":"data","lessonsDone":0,"lessonsKnown":0,"lessonsTotal":10,"mastery":null,
           "matrix":[],"name":"Working with data","nextDate":"2026-11-04","notPlannedReason":null,"preparation":null,"questions":null,"share":null,
           "shortName":"Data","source":"plan","topicFrequencySource":null,"topics":[],"topicsKnown":null,"topicsStudied":null}
         ],"topicCount":0,"topicsMapped":false,"writtenPractice":null}
        """.trimIndent(),
    )

internal fun lesson(
    position: Int,
    title: String,
    state: String,
    minutes: Int = 6,
    plusRequired: Boolean = false,
) = """{"lessonId":"${lessonId(
    position,
)}","minutes":$minutes,"plusRequired":$plusRequired,"skillIds":[],"state":"$state","title":"$title","written":true}"""

internal fun goalChapter(
    testOut: Boolean = true,
    mistakes: Int = 3,
): GoalChapter =
    ApiJson.decodeFromString(
        """
        {"chapter":{"chapterId":"${chapterId(3)}","level":"beginner","position":3,"state":"current",
          "subject":{"key":"natural-sciences","name":"Natural sciences"},"title":"Waves and sound"},
         "counts":{"fading":1,"learning":1,"mastered":1,"new":1,"solid":0,"total":4},
         "goal":{"id":"$GOAL","kind":"exam","title":"Pass ENEM"},
         "lessons":[${lesson(1, "What a wave carries", "done")},${lesson(2, "Frequency and pitch", "done", minutes = 8)},
          ${lesson(3, "Echoes and resonance", "next")},${lesson(4, "The Doppler effect", "upcoming", plusRequired = true)},
          ${lesson(5, "Light as a wave", "upcoming", minutes = 0)}],
         "mistakes":{"open":$mistakes},
         "skills":[
          {"description":null,"fading":false,"name":"Describe a wave by its amplitude and wavelength","prerequisiteIds":[],"retrievability":0.9,"skillId":"50000000-0000-4000-8000-000000000001","state":"mastered"},
          {"description":null,"fading":true,"name":"Relate frequency to pitch","prerequisiteIds":[],"retrievability":0.4,"skillId":"50000000-0000-4000-8000-000000000002","state":"learning"},
          {"description":null,"fading":false,"name":"Explain an echo","prerequisiteIds":[],"retrievability":null,"skillId":"50000000-0000-4000-8000-000000000003","state":"new"}],
         "summaries":[{"ideas":["A wave carries **energy**, not matter.","Speed is $\\lambda f$."],"lessonId":"${lessonId(
            1,
        )}","title":"What a wave carries"}],
         "testOut":{"available":$testOut,"plusRequired":false}}
        """.trimIndent(),
    )

internal fun practiceBlock(
    kind: String,
    lessonId: String? = null,
): AreaPractice =
    ApiJson.decodeFromString(
        """
        {"sessionId":"$SESSION","block":{"answered":0,"brainPower":0,"canTestOut":false,"capsules":[],"estimatedBrainPower":10,
          "estimatedMinutes":5,"extra":true,"fullReview":false,"id":"$BLOCK","kind":"$kind","lessonId":${lessonId?.let {
            "\"$it\""
        } ?: "null"},
          "mistakesOnly":false,"netScored":false,"oftenTested":false,"position":3,"questions":8,"refresh":false,"reinforcement":false,
          "screen":"session","status":"pending","weakest":false}}
        """.trimIndent(),
    )

internal class FakeGoalContentApi : GoalContentApi {
    var chapters = 0
    var practice: () -> AreaPractice = { practiceBlock("practice") }
    val practiced = mutableListOf<AreaPracticeInput>()

    override suspend fun chapter(
        session: AuthenticatedSession,
        key: ChapterKey,
    ): GoalChapter {
        chapters++
        return goalChapter()
    }

    override suspend fun practiceArea(
        session: AuthenticatedSession,
        goalId: UUID,
        input: AreaPracticeInput,
    ): AreaPractice {
        practiced += input
        return practice()
    }
}

/** The Plan's fake, reading the exam's syllabus and counting its reads. */
internal class SyllabusPlanApi(
    private val base: PlanApi = FakePlanApi(),
) : PlanApi by base {
    var syllabi = 0

    override suspend fun syllabus(
        session: AuthenticatedSession,
        goalId: UUID,
    ): Syllabus {
        syllabi++
        return examSyllabus()
    }
}
