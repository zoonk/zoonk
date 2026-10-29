package com.zoonk.android.feature.today

import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.ComposeContentTestRule
import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.FakeSession
import com.zoonk.android.feature.session.StudyApi
import com.zoonk.android.feature.session.StudyOpener
import com.zoonk.android.feature.session.decodeFixture
import com.zoonk.android.feature.session.fixture
import com.zoonk.android.feature.session.toDayView
import com.zoonk.android.navigation.AppNavigator
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.navigation.rememberAppNavigator
import com.zoonk.android.ui.theme.ZoonkTheme
import com.zoonk.api.models.OpenedStudyDay
import com.zoonk.api.models.StudyBlock
import com.zoonk.api.models.SuggestedGoal
import com.zoonk.api.models.Today
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.annotation.Config
import java.util.UUID

@RunWith(AndroidJUnit4::class)
@Config(qualifiers = "w411dp-h891dp")
class TodayFlowTest {
    @get:Rule
    val rule: ComposeContentTestRule = createComposeRule()

    private lateinit var navigator: AppNavigator
    private val started = mutableListOf<UUID>()
    private val ana = AuthenticatedSession("ana", "token-a", "local-a")
    private val session = "5f0c1f7e-0d3a-4c55-9d1e-6f1b0a3c2d02"
    private val lesson = "5f0c1f7e-0d3a-4c55-9d1e-6f1b0a3c2d31"
    private val lessonBlock = "5f0c1f7e-0d3a-4c55-9d1e-6f1b0a3c2d41"
    private val reviewBlock = "5f0c1f7e-0d3a-4c55-9d1e-6f1b0a3c2d42"

    private fun show(vararg sessionFields: Pair<String, Any?>) {
        val blocks =
            JsonArray(
                listOf(
                    fixture(
                        "study-block",
                        "id" to lessonBlock,
                        "kind" to "learn",
                        "screen" to "lesson",
                        "lessonId" to lesson,
                        "position" to 0,
                        "title" to "Cells",
                    ),
                    fixture(
                        "study-block",
                        "id" to reviewBlock,
                        "kind" to "review",
                        "screen" to "session",
                        "position" to 1,
                        "estimatedMinutes" to 8,
                    ),
                ),
            )
        val minutes =
            buildJsonObject {
                put("dailyGoal", 20)
                put("done", 0)
                put("planned", 20)
            }
        val day =
            fixture(
                "study-session",
                "id" to session,
                "status" to "active",
                "blocks" to blocks,
                "nextPosition" to 0,
                "minutes" to minutes,
                *sessionFields,
            )
        val today = decodeFixture<Today>("today", "session" to day)
        val cache = AppCache(FakeSession(ana), CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate))
        val store = TodayStore(NoTodayApi, cache, CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate), timeZone = { "UTC" })
        val viewModel = TodayViewModel(StudyOpener(StartingApi(), cache, timeZone = { "UTC" }), store)
        val read = TodayRead.Day(today, today.session.toDayView())

        rule.setContent {
            ZoonkTheme {
                navigator = rememberAppNavigator()
                LaunchedEffect(viewModel) { viewModel.routes.collect(navigator::open) }
                TodayDay(read, store.today, MutableStateFlow(null), viewModel, navigator, PaddingValues())
            }
        }
    }

    @Test
    fun startOpensTheWrittenLessonInThePlayerAfterStartingItsBlock() {
        show()

        rule.onNodeWithText("Start session").performClick()
        rule.waitForIdle()

        assertEquals(AppRoute.Lesson(lesson, session), navigator.currentRoute)
        assertEquals(listOf(UUID.fromString(lessonBlock)), started)
    }

    @Test
    fun aReviewRowOpensTheSessionScreenWhichPlaysIt() {
        show()

        rule.onNodeWithText("What you already know").performClick()
        rule.waitForIdle()

        assertEquals(AppRoute.Session(blockId = reviewBlock), navigator.currentRoute)
        assertEquals(emptyList<UUID>(), started)
    }

    @Test
    fun aDoneDayLeadsToItsSummary() {
        val done =
            JsonArray(
                listOf(
                    fixture("study-block", "id" to lessonBlock, "kind" to "learn", "status" to "completed", "position" to 0),
                    fixture("study-block", "id" to reviewBlock, "kind" to "review", "status" to "completed", "position" to 1),
                ),
            )
        show("blocks" to done, "nextPosition" to null, "goalId" to "5f0c1f7e-0d3a-4c55-9d1e-6f1b0a3c2d01")

        rule.onNodeWithText("Today's session is complete.", substring = true).assertIsDisplayed()
        rule.onNodeWithText("See today's summary").performClick()
        rule.waitForIdle()

        assertEquals(AppRoute.Session(goalId = "5f0c1f7e-0d3a-4c55-9d1e-6f1b0a3c2d01"), navigator.currentRoute)
    }

    @Test
    fun aRestDayHasNoActionToTake() {
        val noTime =
            buildJsonObject {
                put("dailyGoal", 0)
                put("done", 0)
                put("planned", 0)
            }
        show("blocks" to JsonArray(emptyList()), "nextPosition" to null, "minutes" to noTime)

        rule.onNodeWithText("No study planned today.", substring = true).assertIsDisplayed()
        assertEquals(0, rule.onAllNodesWithText("Start session").fetchSemanticsNodes().size)
    }

    private inner class StartingApi : StudyApi {
        override suspend fun openDay(
            session: AuthenticatedSession,
            goalId: UUID,
            body: JsonObject,
        ): OpenedStudyDay = error("The day is saved")

        override suspend fun addExtraBlock(
            session: AuthenticatedSession,
            sessionId: UUID,
        ): StudyBlock = error("Not used")

        override suspend fun startBlock(
            session: AuthenticatedSession,
            sessionId: UUID,
            blockId: UUID,
            timeZone: String,
        ) {
            started += blockId
        }
    }

    private object NoTodayApi : TodayApi {
        override suspend fun today(
            session: AuthenticatedSession,
            timeZone: String,
        ): Today = error("Shown from the test's read")

        override suspend fun resumePreview(
            session: AuthenticatedSession,
            goalId: UUID,
        ) = false

        override suspend fun onboardingLeft(
            session: AuthenticatedSession,
            goalId: UUID,
        ) = false

        override suspend fun resume(
            session: AuthenticatedSession,
            goalId: UUID,
        ) = Unit

        override suspend fun answerSuggestedGoal(
            session: AuthenticatedSession,
            suggestionId: UUID,
            accepted: Boolean,
        ): SuggestedGoal = error("Not used")
    }
}
