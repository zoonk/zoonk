package com.zoonk.android.feature.player

import androidx.lifecycle.SavedStateHandle
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.DraftStore
import com.zoonk.android.data.DraftsChange
import com.zoonk.android.data.FakeSession
import com.zoonk.android.data.MutationResult
import com.zoonk.android.feature.player.engine.LessonRun
import com.zoonk.android.feature.player.model.LessonLoad
import com.zoonk.android.feature.session.FakeStudyApi
import com.zoonk.android.feature.session.GOAL
import com.zoonk.android.feature.session.StudyOpener
import com.zoonk.android.feature.session.day
import com.zoonk.android.feature.session.step
import com.zoonk.android.navigation.AppRoute
import com.zoonk.api.ApiJson
import com.zoonk.api.models.LibraryLessonStartInputOpening
import com.zoonk.api.models.StudyBlockOpening
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runCurrent
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder

@OptIn(ExperimentalCoroutinesApi::class)
class LessonStartTest {
    @get:Rule val folder = TemporaryFolder()
    private val dispatcher = StandardTestDispatcher()
    private val session = FakeSession(AuthenticatedSession("ana", "token", "local"))
    private val lesson = playable(listOf(explanationStep("first")))
    private val api = FakeLessonPlayerApi(LessonLoad.Ready(lesson))

    @Before fun main() = Dispatchers.setMain(dispatcher)

    @After fun reset() = Dispatchers.resetMain()

    private suspend fun TestScope.player(
        opening: String?,
        tapped: Boolean,
    ): LessonPlayerViewModel {
        val cache = AppCache(session, backgroundScope)
        val drafts = DraftStore(folder.newFolder(), backgroundScope, dispatcher)
        drafts.follow { DraftsChange("ana") }
        return LessonPlayerViewModel(
            lessonId = LESSON_ID,
            studySessionId = null,
            firstAnswer = null,
            opening = opening,
            tapped = tapped,
            store = LessonPlayerStore(api, cache),
            cache = cache,
            sessions = session,
            choices = TodayChoices(drafts),
            drafts = drafts,
            saved = SavedStateHandle(),
        )
    }

    @Test fun writtenStepsNavigateBeforeAdmissionAndStartWithTheirExactOpening() =
        runTest(dispatcher) {
            for (saved in listOf(true, false)) {
                val study = FakeStudyApi()
                val shown = step(0).copy(opensInPlayer = true)
                val opener = StudyOpener(study, study::writeLesson, AppCache(session, backgroundScope)) { "UTC" }
                val result = opener.open(day(listOf(shown), saved = saved), shown, next = true, goalId = GOAL)
                val route = (result as MutationResult.Done).value as AppRoute.Lesson
                assertTrue(study.targets.isEmpty())
                assertTrue(study.opened.isEmpty())
                api.startGate = CompletableDeferred()
                val vm = player(route.opening, tapped = true)
                vm.open(lesson)
                runCurrent()
                assertNotNull(vm.state.value?.currentStep)
                assertTrue(vm.state.value?.run is LessonRun.Starting)
                val expected = ApiJson.decodeFromString(LibraryLessonStartInputOpening.serializer(), route.opening!!)
                assertEquals(expected, api.startOpenings.last())
                api.startGate!!.complete(Unit)
                advanceUntilIdle()
                assertTrue(vm.state.value?.run is LessonRun.Started)
            }
        }

    @Test fun restoredStartWaitsAndOpenedReturnsToToday() =
        runTest(dispatcher) {
            val opening = """{"target":{"kind":"block","blockId":"00000000-0000-0000-0000-000000000001"}}"""
            api.opened = ApiJson.decodeFromString(StudyBlockOpening.serializer(), """{"kind":"today"}""")
            val vm = player(opening, tapped = false)
            vm.open(lesson)
            runCurrent()
            assertNotNull(vm.state.value?.currentStep)
            assertTrue(api.startOpenings.isEmpty())
            vm.dispatch(com.zoonk.android.feature.player.engine.LessonAction.Continue)
            advanceUntilIdle()
            assertEquals(AppRoute.Today, vm.redirect.value)
            assertTrue(vm.state.value?.run !is LessonRun.Started)
            assertEquals(1, api.startOpenings.size)
        }

    @Test fun aRetryableStartRetriesTheSameOpeningOnce() =
        runTest(dispatcher) {
            val opening = """{"target":{"kind":"block","blockId":"00000000-0000-0000-0000-000000000001"}}"""
            api.retryableStarts = 2
            val vm = player(opening, tapped = true)
            vm.open(lesson)
            advanceUntilIdle()
            assertEquals(2, api.startOpenings.size)
            assertEquals(api.startOpenings.first(), api.startOpenings.last())
            assertTrue(vm.state.value?.run is LessonRun.Refused)
        }
}
