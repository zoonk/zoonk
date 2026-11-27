package com.zoonk.android.feature.buddy

import androidx.lifecycle.SavedStateHandle
import com.zoonk.android.data.ApiError
import com.zoonk.android.data.ApiException
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.Audience
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.FakeSession
import com.zoonk.android.data.LearningProfileApi
import com.zoonk.android.data.LearningProfileStore
import com.zoonk.android.data.value
import com.zoonk.android.feature.plan.learnerSummary
import com.zoonk.android.feature.session.FakeStudyApi
import com.zoonk.android.feature.session.MissionOpens
import com.zoonk.android.feature.session.SESSION
import com.zoonk.android.feature.session.StudyOpener
import com.zoonk.android.feature.session.opening
import com.zoonk.android.feature.tutor.BuddyConversation
import com.zoonk.android.feature.tutor.BuddyConversationList
import com.zoonk.android.feature.tutor.FakeTutorApi
import com.zoonk.android.feature.tutor.TutorStore
import com.zoonk.android.feature.tutor.TutorThread
import com.zoonk.android.feature.tutor.TutorThreadKey
import com.zoonk.android.feature.tutor.tutorStore
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.ui.characters.BuddyGlasses
import com.zoonk.android.ui.characters.BuddyKind
import com.zoonk.api.ApiJson
import com.zoonk.api.models.BuddyStatus
import com.zoonk.api.models.LearningProfile
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import kotlinx.serialization.json.JsonObject
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import java.util.UUID
import kotlin.time.Instant

@OptIn(ExperimentalCoroutinesApi::class)
class BuddyViewModelTest {
    private val dispatcher = StandardTestDispatcher()
    private val session = FakeSession(AuthenticatedSession("ana", "token-a", "local-a"))

    @Before
    fun main() = Dispatchers.setMain(dispatcher)

    @After
    fun reset() = Dispatchers.resetMain()

    @Test
    fun aColdVisitOpensTodaysConversationOrANewOneThatAsksNothing() =
        runTest(dispatcher) {
            val api = FakeTutorApi()
            val tutor = tutorStore(api, AppCache(session, CoroutineScope(SupervisorJob() + dispatcher)), session)
            val today = buddy(tutor = tutor)

            today.choose(GOAL, AppRoute.Buddy(), list = null)
            assertNull(today.openConversation(GOAL))
            today.choose(GOAL, AppRoute.Buddy(), conversations(current = EARLIER))
            assertEquals(EARLIER, today.openConversation(GOAL))

            val newDay = buddy(tutor = tutor)
            newDay.choose(GOAL, AppRoute.Buddy(), conversations(current = null))
            val blank = newDay.openConversation(GOAL)!!
            assertNotEquals(EARLIER, blank)
            val thread = tutor.threads[TutorThreadKey.Plan(GOAL, blank)]
            thread.load()
            assertEquals(TutorThread.Empty, thread.state.value.value)
            assertEquals(0, api.threadReads)
        }

    @Test
    fun aLinkOrSearchOpensItsOwnConversationOnceAndTheChoiceHoldsAfterward() =
        runTest(dispatcher) {
            val linked = buddy()
            linked.choose(GOAL, AppRoute.Buddy(conversationId = LINKED), list = null)
            linked.choose(GOAL, AppRoute.Buddy(conversationId = LINKED), conversations(current = EARLIER))
            assertEquals(LINKED, linked.openConversation(GOAL))

            val saved = SavedStateHandle()
            val searched = buddy(saved = saved)
            searched.choose(GOAL, AppRoute.Buddy(ask = "Why osmosis?"), conversations(current = EARLIER))
            val blank = searched.openConversation(GOAL)!!
            assertNotEquals(EARLIER, blank)
            assertNull(searched.takeAsk(EARLIER))

            // Android closed the app before the composer took the question: it's still owed, once.
            val restored = buddy(saved = saved)
            restored.choose(GOAL, AppRoute.Buddy(ask = "Why osmosis?"), conversations(current = EARLIER))
            assertEquals(blank, restored.openConversation(GOAL))
            assertEquals("Why osmosis?", restored.takeAsk(blank))
            assertNull(restored.takeAsk(blank))
        }

    @Test
    fun aLinkedConversationThatIsntFoundGivesWayToWhatAVisitOpens() =
        runTest(dispatcher) {
            val vm = buddy()
            vm.choose(GOAL, AppRoute.Buddy(conversationId = LINKED), list = null)

            // A read answering for another conversation changes nothing.
            vm.unreadable(GOAL, EARLIER, conversations(current = EARLIER))
            assertEquals(LINKED, vm.openConversation(GOAL))

            vm.unreadable(GOAL, LINKED, conversations(current = EARLIER))
            assertEquals(EARLIER, vm.openConversation(GOAL))

            val blank = buddy()
            blank.choose(GOAL, AppRoute.Buddy(conversationId = LINKED), list = null)
            blank.unreadable(GOAL, LINKED, list = null)
            assertNull(blank.openConversation(GOAL))
            blank.choose(GOAL, AppRoute.Buddy(conversationId = LINKED), conversations(current = null))
            val chosen = blank.openConversation(GOAL)
            assertNotNull(chosen)
            assertNotEquals(LINKED, chosen)
        }

    @Test
    fun anEmptyReadRejectsTheLinkedIdAndKeepsANewConversationWritable() =
        runTest(dispatcher) {
            val api = FakeTutorApi()
            val tutor = tutorStore(api, AppCache(session, backgroundScope), session)
            val saved = SavedStateHandle()
            val vm = buddy(tutor = tutor, saved = saved)
            val route = AppRoute.Buddy(conversationId = LINKED)
            vm.choose(GOAL, route, list = null)

            val linkedThread = tutor.threads[TutorThreadKey.Plan(GOAL, LINKED)]
            linkedThread.load()
            assertEquals(1, api.threadReads)
            assertEquals(TutorThread.Empty, linkedThread.state.value.value)
            assertTrue(vm.isUnreadable(GOAL, route.conversationId, linkedThread.state.value))

            vm.unreadable(GOAL, LINKED, conversations(current = LINKED))
            val draftId = requireNotNull(vm.openConversation(GOAL))
            assertNotEquals(LINKED, draftId)
            val draftThread = tutor.threads[TutorThreadKey.Plan(GOAL, draftId)]
            draftThread.load()
            assertEquals(1, api.threadReads)
            assertEquals(TutorThread.Empty, draftThread.state.value.value)
            val restored = buddy(tutor = tutor, saved = saved)
            assertEquals(draftId, restored.openConversation(GOAL))
            assertFalse(restored.isUnreadable(GOAL, route.conversationId, draftThread.state.value))
        }

    @Test
    fun anotherGoalChoosesItsOwnConversation() =
        runTest(dispatcher) {
            val vm = buddy()
            vm.choose(GOAL, AppRoute.Buddy(), conversations(current = EARLIER))

            assertNull(vm.openConversation(OTHER_GOAL))
            vm.choose(OTHER_GOAL, AppRoute.Buddy(), conversations(current = LINKED))
            assertEquals(LINKED, vm.openConversation(OTHER_GOAL))
        }

    private fun conversations(current: String?) =
        BuddyConversationList(
            listOfNotNull(current).map { BuddyConversation(it, "Why?", Instant.parse("2026-11-26T09:00:00Z")) },
            current,
            nextCursor = null,
        )

    @Test
    fun aMissionNoLongerFreeToStartReadsTheCardsAgain() =
        runTest(dispatcher) {
            val study = FakeStudyApi()
            study.openings = listOf(opening("changed"))
            var statusReads = 0
            val status =
                object : BuddyApi {
                    override suspend fun status(
                        session: AuthenticatedSession,
                        timeZone: String,
                    ): BuddyStatus {
                        statusReads++
                        throw ApiException(ApiError.Unavailable)
                    }
                }
            val vm = buddy(study, status)

            vm.openMission(BuddyTap(MissionOpens.Block(blockId = BLOCK, position = null)), GOAL)
            advanceUntilIdle()

            assertEquals(1, study.targets.size)
            assertEquals(1, statusReads)
        }

    /** A first step can open the same block as a mission: only the tapped row says it failed, until the learner leaves. */
    @Test
    fun aFailedOpenStaysOnTheTappedRowUntilTheVisitEnds() =
        runTest(dispatcher) {
            val study = FakeStudyApi()
            study.failures += ApiException(ApiError.Network)
            val vm = buddy(study, NoStatusApi)
            val firstStep = BuddyTap(MissionOpens.Block(blockId = BLOCK, position = null), firstStep = true)

            vm.openMission(firstStep, GOAL)
            advanceUntilIdle()

            assertNull(vm.opening)
            assertEquals(firstStep, vm.openFailed)

            vm.endVisit()

            assertNull(vm.openFailed)
        }

    @Test
    fun aFailureThatLandsAfterTheLearnerLeftSaysNothing() =
        runTest(dispatcher) {
            val study = FakeStudyApi()
            study.failures += ApiException(ApiError.Network)
            val vm = buddy(study, NoStatusApi)

            vm.openMission(BuddyTap(MissionOpens.Block(blockId = BLOCK, position = null)), GOAL)
            vm.endVisit()
            advanceUntilIdle()

            assertNull(vm.opening)
            assertNull(vm.openFailed)
        }

    @Test
    fun aMissionOpensWhereItsBlockStartedWhileThePageStays() =
        runTest(dispatcher) {
            val vm = buddy(opensALesson(), NoStatusApi)

            vm.openMission(BuddyTap(MissionOpens.Block(blockId = BLOCK, position = null)), GOAL)
            advanceUntilIdle()

            assertEquals(1, shownRoutes(vm).size)
        }

    @Test
    fun aMissionOpenedAfterTheLearnerLeftOpensNothingWhenTheyComeBack() =
        runTest(dispatcher) {
            val vm = buddy(opensALesson(), NoStatusApi)

            vm.openMission(BuddyTap(MissionOpens.Block(blockId = BLOCK, position = null)), GOAL)
            vm.endVisit()
            advanceUntilIdle()

            assertEquals(emptyList<AppRoute>(), shownRoutes(vm))
        }

    @Test
    fun aMissionThatOpensWhileThePageIsRecreatedOpensOnce() =
        runTest(dispatcher) {
            val vm = buddy(opensALesson(), NoStatusApi)

            // A recreation: no page shows while the block starts; the next one shows it.
            vm.openMission(BuddyTap(MissionOpens.Block(blockId = BLOCK, position = null)), GOAL)
            advanceUntilIdle()

            assertEquals(1, shownRoutes(vm).size)
        }

    @Test
    fun aMissionThatOpenedBeforeThePageActedAndThenLeftOpensNothingOnReturn() =
        runTest(dispatcher) {
            val vm = buddy(opensALesson(), NoStatusApi)

            vm.openMission(BuddyTap(MissionOpens.Block(blockId = BLOCK, position = null)), GOAL)
            advanceUntilIdle()
            vm.endVisit()

            assertEquals(emptyList<AppRoute>(), shownRoutes(vm))
        }

    @Test
    fun aSaveThatLandsWhileThePageIsRecreatedClosesTheEditorOnce() =
        runTest(dispatcher) {
            val vm = buddy(FakeStudyApi(), NoStatusApi)

            // A recreation: no page acts while the change saves; the next one closes its editor.
            vm.saveEdit(BuddyKind.Noodle, BuddyGlasses.Star, "Nox")
            advanceUntilIdle()

            assertEquals(Unit, vm.editorSaved.value)
            vm.editorSaved.acted(Unit)
            assertNull(vm.editorSaved.value)
        }

    @Test
    fun aSaveThatLandsAfterTheLearnerLeftClosesNothingOnReturn() =
        runTest(dispatcher) {
            val vm = buddy(FakeStudyApi(), NoStatusApi)

            vm.saveEdit(BuddyKind.Noodle, BuddyGlasses.Star, "Nox")
            vm.endVisit()
            advanceUntilIdle()

            assertNull(vm.editorSaved.value)
        }

    @Test
    fun aSaveThatFailsAfterTheLearnerLeftSaysNothingOnReturn() =
        runTest(dispatcher) {
            val vm = buddy(FakeStudyApi(), NoStatusApi, profileFails = true)

            vm.saveEdit(BuddyKind.Noodle, BuddyGlasses.Star, "Nox")
            vm.endVisit()
            advanceUntilIdle()

            assertEquals(false, vm.editorSaveFailed)
        }

    private fun opensALesson() =
        FakeStudyApi().apply {
            openings =
                listOf(opening("lesson", "lessonId" to LESSON, "sessionId" to SESSION.toString()))
        }

    /** The route the page owes its visit, which `BuddyScreen` opens and then acknowledges. */
    private fun shownRoutes(vm: BuddyViewModel): List<AppRoute> = listOfNotNull(vm.route.value)

    private fun TestScope.buddy(
        study: FakeStudyApi = FakeStudyApi(),
        status: BuddyApi = NoStatusApi,
        profileFails: Boolean = false,
        tutor: TutorStore? = null,
        saved: SavedStateHandle = SavedStateHandle(),
    ): BuddyViewModel {
        val cache = AppCache(session, CoroutineScope(SupervisorJob() + dispatcher))
        return BuddyViewModel(
            BuddyStore(status, cache, { "UTC" }, cache.resource(Audience.SignedIn) { learnerSummary() }, backgroundScope),
            LearningProfileStore(ProfileApi(profileFails), cache),
            StudyOpener(study, { _, _ -> error("Not used") }, cache, { "UTC" }),
            tutor ?: tutorStore(FakeTutorApi(), cache, session),
            saved,
        )
    }

    private object NoStatusApi : BuddyApi {
        override suspend fun status(
            session: AuthenticatedSession,
            timeZone: String,
        ): BuddyStatus = error("Not used")
    }

    private class ProfileApi(
        private val fails: Boolean,
    ) : LearningProfileApi {
        override suspend fun profile(session: AuthenticatedSession): LearningProfile = throw ApiException(ApiError.Network)

        override suspend fun update(
            session: AuthenticatedSession,
            change: JsonObject,
        ): LearningProfile = if (fails) throw ApiException(ApiError.Network) else ApiJson.decodeFromString(PROFILE)
    }

    private companion object {
        const val PROFILE =
            """{"activeGoalId":null,"availableGlasses":["round"],"homeCountry":null,"homeCountryName":null,"suggested":[],"buddy":{"glasses":"star","kind":"noodle","name":"Nox","picked":true},"shareUsageData":null,"soundsEnabled":true}"""
        const val GOAL = "5f0c1f7e-0d3a-4c55-9d1e-6f1b0a3c2d00"
        const val OTHER_GOAL = "6a0c1f7e-0d3a-4c55-9d1e-6f1b0a3c2d00"
        const val EARLIER = "7b0c1f7e-0d3a-4c55-9d1e-6f1b0a3c2d00"
        const val LINKED = "8c0c1f7e-0d3a-4c55-9d1e-6f1b0a3c2d00"
        const val LESSON = "5f0c1f7e-0d3a-4c55-9d1e-6f1b0a3c2d78"
        val BLOCK: UUID = UUID.fromString("5f0c1f7e-0d3a-4c55-9d1e-6f1b0a3c2d77")
    }
}
