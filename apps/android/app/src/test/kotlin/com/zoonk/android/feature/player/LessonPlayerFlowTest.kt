package com.zoonk.android.feature.player

import androidx.activity.ComponentActivity
import androidx.compose.material3.SnackbarHostState
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.test.ExperimentalTestApi
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsEnabled
import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.hasSetTextAction
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performKeyInput
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.test.performTextInput
import androidx.compose.ui.test.pressKey
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.app.LocalSnackbarHostState
import com.zoonk.android.data.ANA
import com.zoonk.android.data.ApiError
import com.zoonk.android.data.ApiException
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.DraftStore
import com.zoonk.android.data.DraftsChange
import com.zoonk.android.data.FakeSession
import com.zoonk.android.feature.player.model.LessonLoad
import com.zoonk.android.feature.player.model.LessonStep
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.ui.theme.ZoonkTheme
import com.zoonk.api.ApiJson
import com.zoonk.api.models.LessonStepAnswer
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.runBlocking
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonElement
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class LessonPlayerFlowTest {
    @get:Rule
    val rule = createAndroidComposeRule<ComponentActivity>()

    @get:Rule
    val folder = TemporaryFolder()

    private val ana = AuthenticatedSession(ANA, "token-a", "local-a")
    private val session = FakeSession(ana)
    private val opened = mutableListOf<AppRoute>()
    private var closed = 0
    private lateinit var api: FakeLessonPlayerApi
    private lateinit var openAgain: () -> Unit

    private val exits =
        object : LessonPlayerExits {
            override fun close() {
                closed++
            }

            override fun open(route: AppRoute) {
                opened += route
            }

            override fun replace(route: AppRoute) {
                opened += route
            }
        }

    private fun play(
        steps: List<LessonStep>,
        guest: Boolean = false,
        configure: FakeLessonPlayerApi.() -> Unit = {},
    ) {
        val lesson = playable(steps)
        api = FakeLessonPlayerApi(LessonLoad.Ready(lesson)).apply(configure)
        val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)
        val cache = AppCache(session, scope)
        val drafts = DraftStore(folder.newFolder(), scope)
        runBlocking { drafts.follow { DraftsChange(ana.accountId) } }
        val newViewModel = {
            LessonPlayerViewModel(
                lessonId = LESSON_ID,
                studySessionId = null,
                firstAnswer = null,
                store = LessonPlayerStore(api, cache),
                cache = cache,
                sessions = session,
                choices = TodayChoices(drafts),
                drafts = drafts,
                isGuest = { guest },
                activeGoalId = { GOAL_ID },
            )
        }
        val viewModel = newViewModel()
        openAgain = { newViewModel().open(lesson) }

        rule.setContent {
            ZoonkTheme {
                CompositionLocalProvider(LocalSnackbarHostState provides SnackbarHostState()) {
                    val state by viewModel.state.collectAsState()
                    val ending by viewModel.ending.collectAsState()
                    LaunchedEffect(Unit) { viewModel.open(lesson) }
                    LessonPlayer(lesson, state, ending, viewModel, exits)
                }
            }
        }
    }

    private fun tap(text: String) = rule.onNodeWithText(text).performClick()

    @Test
    fun playsALessonFromItsFirstScreenToItsEnd() {
        play(listOf(explanationStep("idea"), checkStep("quiz"), typedAnswerStep("why"), summaryStep("end"))) {
            grade = { stepId, _ ->
                if (stepId == "why") {
                    checkResult(isCorrect = true, feedback = "You named it.", keyPoints = """[{"met":true,"text":"Names the cloud"}]""")
                } else {
                    checkResult(isCorrect = true)
                }
            }
        }

        rule.onNodeWithText("Idea idea").assertIsDisplayed()
        tap("Next")

        rule.onNodeWithText("Check").assertIsNotEnabled()
        tap("Right")
        tap("Check")
        rule.onNodeWithText("Correct!").assertIsDisplayed()
        rule.onNodeWithText("Because it is.").assertIsDisplayed()
        rule.waitForIdle()
        assertEquals(listOf("quiz"), api.checks.map { it.first })
        tap("Continue")

        rule.onNode(hasSetTextAction()).performTextInput("Water droplets")
        tap("Check")
        rule.onNodeWithText("Correct!").assertIsDisplayed()
        rule.onNodeWithText("1 of 1 key point").assertIsDisplayed()
        tap("Continue")

        rule.onNodeWithText("Summary").assertIsDisplayed()
        tap("Continue")

        rule.onNodeWithText("Lesson complete").assertIsDisplayed()
        rule.onNodeWithText("2 of 2 right").assertIsDisplayed()
        rule.onNodeWithText("+30 Brain Power").assertIsDisplayed()
        assertEquals(listOf(RUN_ID), api.completions)

        tap("Next lesson")
        assertEquals(listOf(AppRoute.Lesson(NEXT_LESSON_ID)), opened)
    }

    @Test
    fun anAnswerThatDidNotSaveIsSentAgainUnderItsAttemptBeforeFinishing() {
        play(listOf(checkStep("quiz"), summaryStep("end"))) { checkFailures = 1 }

        tap("Right")
        tap("Check")
        rule.onNodeWithText("Correct!").assertIsDisplayed()
        tap("Continue")
        tap("Continue")

        rule.onNodeWithText("Lesson complete").assertIsDisplayed()
        val attempts = api.checks.map { it.second.attemptId }
        assertEquals(2, attempts.size)
        assertEquals(1, attempts.distinct().size)
        assertEquals(listOf(RUN_ID), api.completions)
    }

    @Test
    fun aLessonFinishedAfterAnotherLearnerSignedInIsNotSavedForThem() {
        play(listOf(checkStep("quiz"), summaryStep("end")))

        tap("Right")
        tap("Check")
        rule.onNodeWithText("Correct!").assertIsDisplayed()
        rule.waitForIdle()
        session.session = AuthenticatedSession("bia", "token-b", "local-b")
        tap("Continue")
        tap("Continue")
        rule.waitForIdle()

        assertEquals(emptyList<String>(), api.completions)
    }

    @Test
    fun aSpokenScreenCanBeTypedAndTheServerChecksIt() {
        play(listOf(spokenStep("say"), summaryStep("end")))

        rule.onNodeWithText("Tengo hambre").assertIsDisplayed()
        rule.onNode(hasSetTextAction()).performTextInput("Tengo hambre")
        tap("Check")

        rule.onNodeWithText("Correct!").assertIsDisplayed()
        assertEquals(
            LessonStepAnswer.LessonStepAnswerOneOf2Value::class,
            api.checks
                .single()
                .second.answer::class,
        )
    }

    @Test
    fun aLessonNeedingAScreenTheAppCantShowYetSaysSoInsteadOfOpening() {
        play(listOf(explanationStep("idea"), fillBlankStep(BLANK_ID), summaryStep("end")))

        rule.onNodeWithText("This lesson isn't in the app yet").assertIsDisplayed()
        tap("Back")
        assertEquals(1, closed)
    }

    @Test
    fun aScreenTheLessonCanDoWithoutIsLeftOut() {
        play(listOf(explanationStep("idea"), fillBlankStep(BLANK_ID), summaryStep("end"))) { optionalStepIds = """["$BLANK_ID"]""" }

        tap("Next")
        rule.onNodeWithText("One idea.").assertIsDisplayed()
    }

    @Test
    fun anAnswerTheAppNeverSentGoesOutWhenTheLessonOpensAgain() {
        play(listOf(checkStep("quiz"), summaryStep("end"))) { checkFailures = 1 }

        tap("Right")
        tap("Check")
        rule.onNodeWithText("Correct!").assertIsDisplayed()
        rule.waitForIdle()

        openAgain()
        rule.waitUntil { api.checks.size == 2 }

        assertEquals(
            1,
            api.checks
                .map { it.second.attemptId }
                .distinct()
                .size,
        )
    }

    @Test
    fun aMissedCheckComesBackAtTheEndAndTheSegmentsSayHowItWent() {
        play(listOf(checkStep("quiz"), explanationStep("idea")))

        tap("Wrong")
        tap("Check")
        rule.onNodeWithText("Not quite").assertIsDisplayed()
        rule.onNodeWithText("This question comes back at the end of the lesson").assertIsDisplayed()
        tap("Continue")
        tap("Next")

        rule.onNodeWithText("Question quiz?").assertIsDisplayed()
        rule.onNodeWithText("Check").assertIsNotEnabled()
    }

    @Test
    fun leavingWithAnUncheckedWrittenAnswerAsksFirst() {
        play(listOf(typedAnswerStep("why")))

        rule.onNode(hasSetTextAction()).performTextInput("Because")
        rule.waitForIdle()
        rule.runOnUiThread { rule.activity.onBackPressedDispatcher.onBackPressed() }

        rule.onNodeWithText("Leave for now?").assertIsDisplayed()
        tap("Keep writing")
        assertEquals(0, closed)
    }

    @Test
    fun aFreeLearnerOutOfNewLessonsCanStillGoBackOrSeePlus() {
        val limit: JsonElement = Json.parseToJsonElement("""{"limit":{"tier":"free","period":"day"}}""")
        play(listOf(explanationStep("idea"))) {
            startError = ApiException(ApiError.Unavailable, code = "USAGE_LIMIT_REACHED", status = 402, details = limit)
        }

        rule.onNodeWithText("That's all the new lessons for today").assertIsDisplayed()
        tap("See Plus")
        assertEquals(listOf(AppRoute.Subscription), opened)
    }

    @Test
    fun aFailedStartOffersTryAgainWhichOpensTheLesson() {
        play(listOf(explanationStep("idea"))) { startError = ApiException(ApiError.Unavailable) }

        rule.onNodeWithText("We couldn't open this lesson").assertIsDisplayed()
        api.startError = null
        tap("Try again")
        rule.onNodeWithText("Idea idea").assertIsDisplayed()
        rule.onNodeWithText("Continue").assertIsEnabled()
    }

    @Test
    fun aGuestEndsWithWhereTheLessonFitsAndBuildsAPlanFromIt() {
        play(listOf(explanationStep("idea")), guest = true) {
            fit =
                ApiJson.decodeFromString(
                    """
                    {"chapter":{"id":"$CHAPTER_ID","lessonCount":4,"lessonNumber":2,"title":"Water in the air"},
                     "course":{"chapterCount":6,"id":"$CHAPTER_ID","minutes":300,"startChapterId":"$CHAPTER_ID","title":"Weather"}}
                    """.trimIndent(),
                )
        }

        tap("Continue")

        rule.onNodeWithText("This is part of").performScrollTo().assertIsDisplayed()
        rule.onNodeWithText("Weather").performScrollTo().assertIsDisplayed()
        tap("Build my plan")
        assertEquals(listOf(AppRoute.CourseStart(CHAPTER_ID, CHAPTER_ID)), opened)
    }

    @OptIn(ExperimentalTestApi::class)
    @Test
    fun aKeyboardPicksWithNumbersAndGoesOnWithEnterToTheNextLesson() {
        play(listOf(checkStep("quiz")))

        fun press(key: Key) = rule.onRoot().performKeyInput { pressKey(key) }

        rule.waitForIdle()
        press(Key.One)
        press(Key.Enter)
        rule.onNodeWithText("Correct!").assertIsDisplayed()
        press(Key.Enter)
        rule.onNodeWithText("Lesson complete").assertIsDisplayed()
        rule.onNodeWithText("Next lesson").assertIsDisplayed()
        press(Key.Enter)
        assertEquals(listOf(AppRoute.Lesson(NEXT_LESSON_ID)), opened)
    }
}

private const val BLANK_ID = "00000000-0000-4000-8000-0000000000ee"
private const val GOAL_ID = "00000000-0000-4000-8000-000000000011"
