package com.zoonk.android.feature.catalog

import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.api.ApiJson
import com.zoonk.api.models.CatalogLesson
import com.zoonk.api.models.CatalogSearchResponse
import com.zoonk.api.models.ChapterResource
import com.zoonk.api.models.CourseCategoryCounts
import com.zoonk.api.models.CourseChapter
import com.zoonk.api.models.CourseResource
import com.zoonk.api.models.CourseResult
import kotlinx.coroutines.CompletableDeferred

internal const val COURSE = "11111111-1111-4111-8111-111111111111"
internal const val CHAPTER_ONE = "22222222-2222-4222-8222-222222222221"
internal const val CHAPTER_TWO = "22222222-2222-4222-8222-222222222222"
internal const val LESSON_ONE = "33333333-3333-4333-8333-333333333331"
internal const val LESSON_TWO = "33333333-3333-4333-8333-333333333332"
internal const val LESSON_THREE = "33333333-3333-4333-8333-333333333333"
private const val ORG = "44444444-4444-4444-8444-444444444444"

private const val QUESTION =
    """{"context":null,"guess":true,"kind":"choice","question":"Does the electron circle the nucleus?",
        "options":[{"id":"planet","text":"Yes, like a tiny planet"},{"id":"cloud","text":"No, it's more like a cloud"}]}"""

internal fun courseResult(
    id: String,
    title: String,
    subject: String? = "science",
): CourseResult =
    ApiJson.decodeFromString(
        """{"description":"A first sentence. A second one.","estimatedMinutes":90,"id":"$id","language":"en",
            "lessonCount":6,"organization":{"id":"$ORG","name":"Zoonk","slug":"zoonk"},"slug":"s","subject":${subject?.let { "\"$it\"" }},
            "title":"$title"}""",
    )

internal fun counts(): CourseCategoryCounts =
    ApiJson.decodeFromString(
        """{"categories":[{"category":"science","courseCount":2},{"category":"math","courseCount":1},{"category":"law","courseCount":0}],"total":3}""",
    )

internal fun course(tryLesson: Boolean = true): CourseResource =
    ApiJson.decodeFromString(
        """{"categories":["science"],"description":"Atoms, from the inside.","editions":[],"format":"core",
            "generationStatus":"completed","id":"$COURSE","language":"en","slug":"atoms","title":"Atoms",
            "landingPage":{"audience":["Curious people"],"outcomes":["Explain what an atom is"],"valueProposition":"See what matter is made of."},
            "examplePlan":{"pace":{"minutes":15,"estimate":{"chapters":[{"chapterId":"$CHAPTER_ONE","week":1,"endWeek":1,"workKinds":[]}],
              "endDate":"2027-03-01","firstDay":[{"chapterId":"$CHAPTER_ONE","dayMinutes":10,"estimatedMinutes":10,"lessonId":"$LESSON_ONE","title":"Inside an atom"}],
              "numbers":{"context":{"dailyMinutes":15,"fromDate":"2026-10-28","fullCourse":true,"paceFactor":1,"weekdayMinutes":[0,15,15,15,15,15,0]},
                "scheduledMinutes":120,"workload":{"checkpointMinutes":10,"lessonMinutes":90,"practiceMinutes":20,"unwrittenLessonMinutes":0}},
              "publishedContent":{"lessons":3,"minutes":90},"weeks":2,
              "workload":{"checkpointMinutes":10,"lessonMinutes":90,"practiceMinutes":20,"unwrittenLessonMinutes":0}}}},
            ${if (tryLesson) """"tryLesson":{"chapterTitle":"Inside the atom","lessonId":"$LESSON_TWO","minutes":7,"number":2,"screen":$QUESTION},""" else ""}
            "organization":{"id":"$ORG","name":"Zoonk","slug":"zoonk"}}""",
    )

internal fun chapters(): List<CourseChapter> =
    listOf(
        chapter(CHAPTER_ONE, "Inside the atom", "overview", 0, listOf(LESSON_ONE to "Inside an atom", LESSON_TWO to "The cloud")),
        chapter(CHAPTER_TWO, "Bonds", "beginner", 1, listOf(LESSON_THREE to "Sharing electrons")),
    )

private fun chapter(
    id: String,
    title: String,
    level: String,
    position: Int,
    lessons: List<Pair<String, String>>,
): CourseChapter =
    ApiJson.decodeFromString(
        """{"courseId":"$COURSE","description":"What $title covers.","generationStatus":"completed","id":"$id","language":"en",
            "level":"$level","objectives":["Name the parts"],"position":$position,"slug":"c","title":"$title","lessonCount":${lessons.size},
            "lessons":[${lessons.joinToString(
            ",",
        ) { (lessonId, lessonTitle) -> """{"estimatedMinutes":7,"id":"$lessonId","slug":"l","title":"$lessonTitle"}""" }}]}""",
    )

internal fun chapterResource(id: String): ChapterResource =
    ApiJson.decodeFromString(
        """{"courseId":"$COURSE","description":"d","generationStatus":"completed","id":"$id","language":"en","level":"beginner",
            "objectives":[],"position":1,"slug":"c","title":"Bonds",
            "tryLesson":{"chapterTitle":"Bonds","lessonId":"$LESSON_THREE","minutes":7,"number":1,"screen":$QUESTION}}""",
    )

internal fun catalogLesson(
    id: String,
    firstScreen: String = QUESTION,
): CatalogLesson =
    ApiJson.decodeFromString(
        """{"description":"Why the planet picture fails.","estimatedMinutes":7,"firstScreen":$firstScreen,"id":"$id","language":"en",
            "summaryIdeas":["The electron is a cloud."],"title":"The cloud"}""",
    )

/** Counts each read, serves pages of [pageSize] from [all], and fails a read while [failing]. */
internal class FakeCatalogApi(
    private val all: List<CourseResult> = (1..5).map { courseResult("55555555-5555-4555-8555-55555555555$it", "Course $it") },
    private val pageSize: Int = 2,
) : CatalogApi {
    val reads = mutableListOf<String>()
    var failing = false

    /** Holds the next page's answer until it completes. */
    var nextPageGate: CompletableDeferred<Unit>? = null
    var course: CourseResource = course()

    override suspend fun categoryCounts(language: String): CourseCategoryCounts {
        reads += "counts:$language"
        return counts()
    }

    override suspend fun courses(
        language: String,
        category: String?,
        cursor: String?,
    ): CoursePage {
        reads += "courses:$language:$category:$cursor"
        if (failing) throw java.io.IOException("offline")
        if (cursor != null) nextPageGate?.await()
        val start = cursor?.toInt() ?: 0
        val end = minOf(start + pageSize, all.size)
        return CoursePage(all.subList(start, end), end.takeIf { it < all.size }?.toString())
    }

    override suspend fun course(courseId: String): CourseResource {
        reads += "course:$courseId"
        return course
    }

    override suspend fun chapters(courseId: String): List<CourseChapter> {
        reads += "chapters:$courseId"
        return chapters()
    }

    override suspend fun chapter(
        chapterId: String,
        courseId: String,
    ): ChapterResource {
        reads += "chapter:$chapterId"
        return chapterResource(chapterId)
    }

    var searchResults: CatalogSearchResponse = CatalogSearchResponse(chapters = emptyList(), courses = emptyList())

    override suspend fun search(
        language: String,
        query: String,
    ): CatalogSearchResponse {
        reads += "search:$language:$query"
        return searchResults
    }

    override suspend fun lesson(
        lessonId: String,
        courseId: String,
    ): CatalogLesson {
        reads += "lesson:$lessonId"
        return catalogLesson(lessonId)
    }

    var startedLessons: Set<String> = emptySet()

    override suspend fun lessonStarted(
        session: AuthenticatedSession,
        lessonId: String,
    ): Boolean {
        reads += "started:$lessonId"
        return lessonId in startedLessons
    }
}
