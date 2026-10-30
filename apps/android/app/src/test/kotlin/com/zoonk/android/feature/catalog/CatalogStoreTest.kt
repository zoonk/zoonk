package com.zoonk.android.feature.catalog

import com.zoonk.android.data.ApiError
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.FakeSession
import com.zoonk.android.data.LoadState
import com.zoonk.android.data.value
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.async
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.runCurrent
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.util.Locale

@OptIn(ExperimentalCoroutinesApi::class)
class CatalogStoreTest {
    private fun TestScope.store(api: FakeCatalogApi): CatalogStore {
        val scope = CoroutineScope(SupervisorJob() + StandardTestDispatcher(testScheduler))
        return CatalogStore(api, AppCache(FakeSession(null), scope))
    }

    private val all = CourseList("en", null)
    private val chapterOne = ChapterInCourse(CHAPTER_ONE, COURSE)

    @Test
    fun anOwnersPrivateCourseOpensForThemAndStillNotForAnyoneElse() =
        runTest {
            val api = FakeCatalogApi().apply { owner = "ana" }
            val session = FakeSession(AuthenticatedSession("ana", "token-a", "local-a"))
            val cache = AppCache(session, CoroutineScope(SupervisorJob() + StandardTestDispatcher(testScheduler)))
            val store = CatalogStore(api, cache)

            store.course[COURSE].load()
            store.chapter[chapterOne].load()
            assertEquals("Atoms", store.course[COURSE].state.value.value?.course?.title)
            assertTrue(store.chapter[chapterOne].state.value is LoadState.Loaded)

            session.session = AuthenticatedSession("bia", "token-b", "local-b")
            cache.followSession()
            store.course[COURSE].load()
            store.chapter[chapterOne].load()
            assertEquals(LoadState.Failed(ApiError.NotFound), store.course[COURSE].state.value)
            assertEquals(LoadState.Failed(ApiError.NotFound), store.chapter[chapterOne].state.value)
        }

    @Test
    fun aVisitorsCourseAndChapterPagesReadOnceAndStayOnReturn() =
        runTest {
            val api = FakeCatalogApi()
            val store = store(api)

            repeat(2) {
                store.course[COURSE].load()
                store.chapter[chapterOne].load()
            }

            assertEquals(listOf("chapter:$CHAPTER_ONE", "chapters:$COURSE", "course:$COURSE"), api.reads.sorted())
            assertTrue(store.chapter[chapterOne].state.value is LoadState.Loaded)
        }

    @Test
    fun aCourseAndItsOutlineLoadOnceForItsCourseChapterAndLessonPages() =
        runTest {
            val api = FakeCatalogApi()
            val store = store(api)

            store.course[COURSE].load()
            store.course[COURSE].load()

            val detail =
                store.course[COURSE]
                    .state.value.value
            assertEquals("Atoms", detail?.course?.title)
            assertEquals(listOf("Inside the atom", "Bonds"), detail?.chapters?.map { it.title })
            assertEquals(listOf("chapters:$COURSE", "course:$COURSE"), api.reads.sorted())
        }

    @Test
    fun moreCoursesAppendTheNextPageUntilTheLast() =
        runTest {
            val api = FakeCatalogApi()
            val store = store(api)

            store.courses[all].load()
            assertTrue(store.loadMore(all))
            assertTrue(store.loadMore(all))

            val page =
                store.courses[all]
                    .state.value.value
            assertEquals((1..5).map { "Course $it" }, page?.courses?.map { it.title })
            assertNull(page?.nextCursor)

            assertTrue(store.loadMore(all))
            assertEquals(3, api.reads.count { it.startsWith("courses:") })
        }

    @Test
    fun aPageThatFailsKeepsTheListAndSaysSo() =
        runTest {
            val api = FakeCatalogApi()
            val store = store(api)

            store.courses[all].load()
            api.failing = true

            assertFalse(store.loadMore(all))
            assertEquals(2, (store.courses[all].state.value as LoadState.Loaded).value.courses.size)
        }

    @Test
    fun aPageReadWhileTheListWasRefreshedIsDropped() =
        runTest {
            val api = FakeCatalogApi()
            val store = store(api)
            val resource = store.courses[all]
            resource.load()

            val gate = CompletableDeferred<Unit>()
            api.nextPageGate = gate
            val more = async { store.loadMore(all) }
            runCurrent()
            resource.refresh()
            gate.complete(Unit)

            assertTrue(more.await())
            assertEquals(
                listOf("Course 1", "Course 2"),
                resource.state.value.value
                    ?.courses
                    ?.map { it.title },
            )
        }

    @Test
    fun eachCategoryIsItsOwnList() =
        runTest {
            val api = FakeCatalogApi()
            val store = store(api)

            store.courses[all].load()
            store.courses[CourseList("en", "math")].load()

            assertEquals(listOf("courses:en:null:null", "courses:en:math:null"), api.reads)
        }

    @Test
    fun theCatalogIsInTheAppsLanguageWhenZoonkHasOne() {
        assertEquals("pt", catalogLanguage(Locale.forLanguageTag("pt-BR")))
        assertEquals("de", catalogLanguage(Locale.GERMANY))
        assertEquals("en", catalogLanguage(Locale.JAPAN))
    }

    @Test
    fun aDescriptionShowsItsFirstSentence() {
        assertEquals("A first sentence.", firstSentence("  A first sentence. A second one.", "en"))
        assertEquals("No period", firstSentence("No period", "en"))
    }

    @Test
    fun onlyCountriesHaveFlagEmoji() {
        assertEquals("🇧🇷", flagEmoji("br"))
        assertNull(flagEmoji("es-ct"))
        assertNull(flagEmoji("arab"))
    }
}
