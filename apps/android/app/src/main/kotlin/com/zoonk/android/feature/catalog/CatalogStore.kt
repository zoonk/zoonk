package com.zoonk.android.feature.catalog

import com.zoonk.android.data.ApiClients
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.Audience
import com.zoonk.android.data.KeyedResources
import com.zoonk.android.data.LoadState
import com.zoonk.android.data.perform
import com.zoonk.api.apis.CoursesApi
import com.zoonk.api.models.CatalogLesson
import com.zoonk.api.models.ChapterResource
import com.zoonk.api.models.CourseCategoryCounts
import com.zoonk.api.models.CourseChapter
import com.zoonk.api.models.CourseResource
import com.zoonk.api.models.CourseResult
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import java.util.Locale
import java.util.UUID
import kotlin.time.Duration.Companion.hours

interface CatalogApi {
    suspend fun categoryCounts(language: String): CourseCategoryCounts

    suspend fun courses(
        language: String,
        category: String?,
        cursor: String?,
    ): CoursePage

    suspend fun course(courseId: String): CourseResource

    suspend fun chapters(courseId: String): List<CourseChapter>

    suspend fun chapter(
        chapterId: String,
        courseId: String,
    ): ChapterResource

    suspend fun lesson(lessonId: String): CatalogLesson
}

data class CoursePage(
    val courses: List<CourseResult>,
    val nextCursor: String?,
)

/** A course's page: the course and its outline, which its chapters' and lessons' pages draw from too. */
data class CourseDetail(
    val course: CourseResource,
    val chapters: List<CourseChapter>,
)

data class CourseList(
    val language: String,
    val category: String?,
)

data class ChapterInCourse(
    val chapterId: String,
    val courseId: String,
)

/**
 * The catalog is the same for everyone, so its reads send no session and outlive sign-outs. Main's
 * catalog pages are static; an hour keeps a return instant and pull to refresh reads sooner.
 */
class CatalogStore(
    private val api: CatalogApi,
    cache: AppCache,
) {
    val categoryCounts: KeyedResources<String, CourseCategoryCounts> =
        cache.keyed(Audience.Everyone, maxAge = CATALOG_MAX_AGE) { _, language -> api.categoryCounts(language) }

    val courses: KeyedResources<CourseList, CoursePage> =
        cache.keyed(Audience.Everyone, maxAge = CATALOG_MAX_AGE, isEmpty = { it.courses.isEmpty() }) { _, list ->
            api.courses(list.language, list.category, cursor = null)
        }

    val course: KeyedResources<String, CourseDetail> =
        cache.keyed(Audience.Everyone, maxAge = CATALOG_MAX_AGE) { _, courseId ->
            coroutineScope {
                val chapters = async { api.chapters(courseId) }
                CourseDetail(api.course(courseId), chapters.await())
            }
        }

    /** Read only for the lesson the chapter's page offers to try; the rest of the page is its course's outline. */
    val chapter: KeyedResources<ChapterInCourse, ChapterResource> =
        cache.keyed(Audience.Everyone, maxAge = CATALOG_MAX_AGE) { _, key -> api.chapter(key.chapterId, key.courseId) }

    val lesson: KeyedResources<String, CatalogLesson> =
        cache.keyed(Audience.Everyone, maxAge = CATALOG_MAX_AGE) { _, lessonId -> api.lesson(lessonId) }

    /**
     * Appends the list's next page, unless a refresh replaced the list meanwhile. False when the
     * page didn't load, so the list offers to try again.
     */
    suspend fun loadMore(list: CourseList): Boolean {
        val resource = courses[list]
        val page = (resource.state.value as? LoadState.Loaded)?.value ?: return true
        val cursor = page.nextCursor ?: return true
        val revision = resource.revision

        val next =
            try {
                api.courses(list.language, list.category, cursor)
            } catch (e: CancellationException) {
                throw e
            } catch (_: Exception) {
                return false
            }

        if (resource.revision == revision) {
            resource.update { current ->
                val seen = current.courses.map { it.id }.toSet()
                CoursePage(current.courses + next.courses.filter { it.id !in seen }, next.nextCursor)
            }
        }

        return true
    }

    private companion object {
        val CATALOG_MAX_AGE = 1.hours
    }
}

/** Main's catalog lists courses in the app's language, or English when Zoonk has no catalog in it. */
fun catalogLanguage(locale: Locale): String = locale.language.takeIf { it in CATALOG_LANGUAGES } ?: "en"

private val CATALOG_LANGUAGES = setOf("de", "en", "es", "fr", "pt")

class LiveCatalogApi(
    private val api: ApiClients,
) : CatalogApi {
    private val courses get() = api.clients(null).courses

    override suspend fun categoryCounts(language: String) = perform { courses.listCourseCategoryCounts(language) }

    override suspend fun courses(
        language: String,
        category: String?,
        cursor: String?,
    ): CoursePage {
        val category = CoursesApi.CategoryListCourses.entries.firstOrNull { it.value == category }
        val page = perform { courses.listCourses(language, category, cursor, PAGE_SIZE) }
        return CoursePage(page.data, page.pagination.nextCursor?.takeIf { page.pagination.hasMore })
    }

    override suspend fun course(courseId: String) = perform { courses.getCourse(UUID.fromString(courseId)) }

    override suspend fun chapters(courseId: String) =
        perform { api.clients(null).chapters.listCourseChapters(UUID.fromString(courseId)) }.data

    override suspend fun chapter(
        chapterId: String,
        courseId: String,
    ) = perform { api.clients(null).chapters.getChapter(UUID.fromString(chapterId), UUID.fromString(courseId)) }

    override suspend fun lesson(lessonId: String) = perform { api.clients(null).libraryLessons.getCatalogLesson(UUID.fromString(lessonId)) }

    private companion object {
        const val PAGE_SIZE = 20L
    }
}
