package com.zoonk.android.feature.today

import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
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
import com.zoonk.android.data.LoadState
import com.zoonk.android.feature.plan.FakePlanApi
import com.zoonk.android.feature.plan.PlanStore
import com.zoonk.android.feature.session.StudyApi
import com.zoonk.android.feature.session.StudyOpener
import com.zoonk.android.feature.session.decodeFixture
import com.zoonk.android.feature.session.fixture
import com.zoonk.android.feature.session.toDayView
import com.zoonk.android.navigation.AppNavigator
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.navigation.rememberAppNavigator
import com.zoonk.android.ui.theme.ZoonkTheme
import com.zoonk.api.models.LanguageToday
import com.zoonk.api.models.LanguageTodayPronunciation
import com.zoonk.api.models.OpenedStudyDay
import com.zoonk.api.models.StudyBlock
import com.zoonk.api.models.StudySession
import com.zoonk.api.models.StudySessionSummary
import com.zoonk.api.models.SuggestedGoal
import com.zoonk.api.models.Today
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.jsonObject
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

    private var language by mutableStateOf<LoadState<LanguageToday>?>(null)

    private fun show(
        vararg sessionFields: Pair<String, Any?>,
        todayFields: List<Pair<String, Any?>> = emptyList(),
    ) {
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
        val today = decodeFixture<Today>("today", "session" to day, *todayFields.toTypedArray())
        val cache = AppCache(FakeSession(ana), CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate))
        val store = TodayStore(NoTodayApi, cache, CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate), timeZone = { "UTC" })
        val viewModel =
            TodayViewModel(
                StudyOpener(
                    StartingApi(),
                    cache,
                    timeZone = { "UTC" },
                    scope =
                        CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate),
                ),
                store,
                PlanStore(FakePlanApi(), cache),
            )
        val read = TodayRead.Day(today, today.session.toDayView())

        rule.setContent {
            ZoonkTheme {
                navigator = rememberAppNavigator()
                LaunchedEffect(viewModel) { viewModel.routes.collect { navigator.open(it.route) } }
                TodayDay(
                    read,
                    store.today,
                    false,
                    viewModel,
                    navigator,
                    PaddingValues(),
                    buddy =
                        com.zoonk.android.ui.characters
                            .BuddyLook(),
                    buddyName = "Zu",
                    language = language,
                )
            }
        }
    }

    @Test
    fun aLanguageGoalsWordsToSayAgainWinOverASuggestionReadBeforeThem() {
        language = LoadState.Loading
        val goal = fixture("today")["goal"]?.let { JsonObject(it.jsonObject + ("kind" to JsonPrimitive("language"))) }
        show(
            todayFields =
                listOf(
                    "goal" to goal,
                    "studiedToday" to true,
                    "suggestedGoal" to fixture("suggested-goal", "title" to "Chemistry"),
                ),
        )
        rule.onNodeWithText("Continue Chemistry?").assertDoesNotExist()

        language =
            LoadState.Loaded(
                LanguageToday(level = null, pronunciation = LanguageTodayPronunciation(2, listOf("hola", "gracias")), speaking = null),
            )

        rule.onNodeWithText("Say 2 words again").assertExists()
        rule.onNodeWithText("Continue Chemistry?").assertDoesNotExist()
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
    fun aReviewRowStartsItsBlockAndOpensTheQuestionRunner() {
        show()

        rule.onNodeWithText("What you already know").performClick()
        rule.waitForIdle()

        assertEquals(AppRoute.QuestionBlock(session, reviewBlock), navigator.currentRoute)
        assertEquals(listOf(UUID.fromString(reviewBlock)), started)
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

        override suspend fun summary(
            session: AuthenticatedSession,
            sessionId: UUID,
            timeZone: String,
        ): StudySessionSummary = error("Not used")

        override suspend fun addExtraBlock(
            session: AuthenticatedSession,
            sessionId: UUID,
        ): StudyBlock = error("Not used")

        override suspend fun catchUp(
            session: AuthenticatedSession,
            sessionId: UUID,
            timeZone: String,
        ) = Unit

        override suspend fun startBlock(
            session: AuthenticatedSession,
            sessionId: UUID,
            blockId: UUID,
            timeZone: String,
        ) {
            started += blockId
        }

        override suspend fun session(
            session: AuthenticatedSession,
            sessionId: UUID,
            timeZone: String,
        ): StudySession = error("Not used")

        override suspend fun prepare(
            session: AuthenticatedSession,
            sessionId: UUID,
        ) = Unit
    }

    private object NoTodayApi : TodayApi {
        override suspend fun today(
            session: AuthenticatedSession,
            timeZone: String,
        ): Today = error("Shown from the test's read")

        override suspend fun brainPower(session: AuthenticatedSession): Long? = null

        override suspend fun mistakes(
            session: AuthenticatedSession,
            goalId: UUID,
        ) = com.zoonk.api.models
            .MistakeListAvailability(ready = 0, tomorrow = 0)

        override suspend fun mocks(
            session: AuthenticatedSession,
            goalId: UUID,
        ): com.zoonk.api.models.MockOptions = error("Not used")

        override suspend fun language(
            session: AuthenticatedSession,
            goalId: UUID,
        ): com.zoonk.api.models.LanguageToday = error("Not used")

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

        override suspend fun answerInsight(
            session: AuthenticatedSession,
            insightId: UUID,
            accepted: Boolean,
        ) = Unit

        override suspend fun prepareLessons(
            session: AuthenticatedSession,
            goalId: UUID,
        ) = error("Not used")

        override suspend fun answerSuggestedGoal(
            session: AuthenticatedSession,
            suggestionId: UUID,
            accepted: Boolean,
        ): SuggestedGoal = error("Not used")
    }
}
