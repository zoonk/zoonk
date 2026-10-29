package com.zoonk.android.feature.player

import androidx.activity.ComponentActivity
import androidx.compose.material3.SnackbarHostState
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.test.ExperimentalTestApi
import androidx.compose.ui.test.assertCountEquals
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsEnabled
import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.hasSetTextAction
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onAllNodesWithText
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
import com.zoonk.android.feature.audio.GradeOutcome
import com.zoonk.android.feature.audio.VoiceRecording
import com.zoonk.android.feature.player.engine.LessonRefusal
import com.zoonk.android.feature.player.engine.LessonRun
import com.zoonk.android.feature.player.model.LessonLoad
import com.zoonk.android.feature.player.model.LessonStep
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.navigation.rememberAppNavigator
import com.zoonk.android.ui.theme.ZoonkTheme
import com.zoonk.api.ApiJson
import com.zoonk.api.models.LessonStepAnswer
import com.zoonk.api.models.LessonStepAnswerOneOf3Answer
import com.zoonk.api.models.SpokenAnswerGrade
import kotlinx.coroutines.CompletableDeferred
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

    private val harness = LessonPlayerHarness(rule) { folder.newFolder() }
    private val session get() = harness.session
    private val opened get() = harness.opened
    private val replaced get() = harness.replaced
    private val closed get() = harness.closed
    private val api get() = harness.api
    private val openAgain get() = harness.openAgain
    private val viewModel get() = harness.viewModel

    private fun play(
        steps: List<LessonStep>,
        guest: Boolean = false,
        configure: FakeLessonPlayerApi.() -> Unit = {},
    ) = harness.play(steps, guest, configure = configure)

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
        assertEquals(listOf(AppRoute.Lesson(NEXT_LESSON_ID)), replaced)
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
        tap("I can't talk now")
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
    fun aSpokenTakeIsGradedByTheServerAndShowsWhatWasHeard() {
        play(listOf(spokenStep("say"), summaryStep("end"))) {
            spokenGrade = {
                ApiJson.decodeFromString(
                    SpokenAnswerGrade.serializer(),
                    """
                    {"attemptId":"00000000-0000-4000-8000-000000000021","explanation":"Say the h softly.","isCorrect":false,"score":0.5,
                     "transcript":"Tengo ambre","words":[{"heard":"Tengo","status":"correct","text":"Tengo"},{"heard":"ambre","status":"different","text":"hambre"}],
                     "wordsToPractice":[]}
                    """.trimIndent(),
                )
            }
        }

        val outcome = runBlocking { viewModel.gradeSpoken("say", VoiceRecording(ByteArray(8), 1_200)) }

        assertEquals(GradeOutcome.Graded(Unit), outcome)
        assertEquals(listOf("say"), api.spokenTakes)
        rule.onNodeWithText("Say the h softly.").assertIsDisplayed()
        assertEquals(
            "Tengo ambre",
            viewModel.state.value
                ?.results
                ?.get("say")
                ?.heard
                ?.transcript,
        )
    }

    @Test
    fun anActivityIsAskedFromItsFrameAndCheckedByTheServer() {
        play(listOf(activityStep("act"), summaryStep("end")))

        rule.onNodeWithText("Compare the two lines.").assertIsDisplayed()
        tap("Line A")
        tap("Check")

        rule.onNodeWithText("It doubles every step.").assertIsDisplayed()
        assertEquals(
            LessonStepAnswer.LessonStepAnswerOneOf3Value::class,
            api.checks
                .single()
                .second.answer::class,
        )
    }

    @Test
    fun aNumericActivitySendsTheTypedNumberAndWritesMoneyTheWayItsLanguageDoes() {
        play(listOf(activityStep("act", NUMERIC_ACTIVITY_CHECK), summaryStep("end"))) {
            grade = { _, _ -> checkResult(isCorrect = false) }
        }

        rule.onNode(hasSetTextAction()).performTextInput("50.5")
        tap("Check")

        rule.onNodeWithText("R$50.5").assertIsDisplayed()
        rule.onNodeWithText("R$52").assertIsDisplayed()
        val sent =
            api.checks
                .single()
                .second.answer as LessonStepAnswer.LessonStepAnswerOneOf3Value
        assertEquals(50.5, (sent.value.answer as LessonStepAnswerOneOf3Answer.LessonStepAnswerOneOf3AnswerOneOf7Value).value.`value`, 0.0)
    }

    @Test
    fun aChallengeGoesFromItsMissionThroughItsDecisionsToItsDebrief() {
        play(listOf(challengeStep("case"), summaryStep("end")))

        rule.onNodeWithText("Your mission").assertIsDisplayed()
        tap("Start")
        rule.onNodeWithText("The customer is upset.").assertIsDisplayed()
        tap("Ask what happened")
        tap("Confirm")
        rule.onNodeWithText("The customer left calmer.").assertIsDisplayed()
        tap("See how it went")

        rule.onNodeWithText("Challenge complete").performScrollTo().assertIsDisplayed()
        rule.onNodeWithText("You listened first.").performScrollTo().assertIsDisplayed()
        assertEquals(
            LessonStepAnswer.LessonStepAnswerOneOf4Value::class,
            api.checks
                .single()
                .second.answer::class,
        )
    }

    @Test
    fun picturedOptionsKeepTheirNamesUntilTheQuestionIsChecked() {
        play(listOf(pictureCheckStep("arch"), summaryStep("end")))

        rule.onNodeWithText("A doorway with a right arch").assertIsDisplayed()
        rule.onAllNodesWithText("Right").assertCountEquals(0)
        tap("A doorway with a right arch")
        tap("Check")

        rule.onNodeWithText("Right").performScrollTo().assertIsDisplayed()
    }

    @Test
    fun aRunWaitsWhileAnAnswerTheAppNeverSentStillCantGetThrough() {
        play(listOf(checkStep("quiz"), summaryStep("end"))) { checkFailures = 2 }

        tap("Right")
        tap("Check")
        rule.onNodeWithText("Correct!").assertIsDisplayed()
        rule.waitForIdle()

        val reopened = openAgain()
        rule.waitUntil(timeoutMillis = 5_000) { reopened.state.value?.run != null && reopened.state.value?.run !is LessonRun.Starting }

        assertEquals(LessonRun.Refused(LessonRefusal.Failed), reopened.state.value?.run)
    }

    @Test
    fun theLessonsEndWaitsForWhereItLeadsBeforeItsButtonWorks() {
        val gate = CompletableDeferred<Unit>()
        play(listOf(checkStep("quiz"))) { chapterGate = gate }

        tap("Right")
        tap("Check")
        tap("Continue")
        rule.waitForIdle()
        rule.onNodeWithText("Continue").assertIsNotEnabled()

        gate.complete(Unit)
        rule.onNodeWithText("Next lesson").assertIsDisplayed()
    }

    @Test
    fun aLessonNeedingAScreenTheAppCantShowYetSaysSoInsteadOfOpening() {
        play(listOf(explanationStep("idea"), activityStep(BLANK_ID, INTERACTION_ACTIVITY_CHECK), summaryStep("end")))

        rule.onNodeWithText("This lesson isn't in the app yet").assertIsDisplayed()
        tap("Back")
        assertEquals(1, closed)
    }

    @Test
    fun aScreenTheLessonCanDoWithoutIsLeftOut() {
        play(listOf(explanationStep("idea"), activityStep(BLANK_ID, INTERACTION_ACTIVITY_CHECK), summaryStep("end"))) {
            optionalStepIds =
                """["$BLANK_ID"]"""
        }

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
        tap("Create an account to save")
        assertEquals(listOf(AppRoute.CourseStart(CHAPTER_ID, CHAPTER_ID), AppRoute.Login), replaced)
    }

    @OptIn(ExperimentalTestApi::class)
    @Test
    fun aChallengesDecisionsArePickedWithNumberKeysToo() {
        play(listOf(challengeStep("case"), summaryStep("end")))

        fun press(key: Key) = rule.onRoot().performKeyInput { pressKey(key) }

        rule.waitForIdle()
        press(Key.Enter)
        rule.onNodeWithText("What do you say first?").assertIsDisplayed()
        press(Key.One)
        press(Key.Enter)

        rule.onNodeWithText("The customer left calmer.").performScrollTo().assertIsDisplayed()
    }

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
        assertEquals(listOf(AppRoute.Lesson(NEXT_LESSON_ID)), replaced)
    }
}

private const val BLANK_ID = "00000000-0000-4000-8000-0000000000ee"
