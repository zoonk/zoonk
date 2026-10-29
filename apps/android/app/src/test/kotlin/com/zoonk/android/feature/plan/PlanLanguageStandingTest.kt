package com.zoonk.android.feature.plan

import androidx.activity.ComponentActivity
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.test.SemanticsMatcher
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.hasClickAction
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.feature.conversation.CallRequest
import com.zoonk.android.feature.conversation.CallStart
import com.zoonk.android.feature.language.languageProgress
import com.zoonk.android.feature.speaking.speakingPaper
import com.zoonk.android.navigation.AppNavigator
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.navigation.rememberAppNavigator
import com.zoonk.android.ui.theme.ZoonkTheme
import com.zoonk.api.models.LanguageProgress
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.annotation.Config
import java.util.UUID

@RunWith(AndroidJUnit4::class)
@Config(qualifiers = "w411dp-h2000dp")
class PlanLanguageStandingTest {
    @get:Rule
    val compose = createAndroidComposeRule<ComponentActivity>()

    private lateinit var navigator: AppNavigator
    private val requests = mutableListOf<CallRequest>()
    private val started = UUID.fromString("00000000-0000-4000-8000-0000000000d2")

    private fun show(progress: LanguageProgress = languageProgress()) {
        val summary = learnerSummary(kind = "language", title = "Spanish")
        val page = PlanPageState(summary.goals.first(), learnPlan(), summary)
        val standing =
            Standing.Language(progress) {
                requests += it
                CallStart.Started(started)
            }
        compose.setContent {
            navigator = rememberAppNavigator()
            ZoonkTheme {
                PlanContent(
                    page = page,
                    standing = standing,
                    structure = null,
                    links = PlanLinks(navigator, page),
                    resume = Resume.Plain,
                    isSaving = false,
                    onSetStatus = {},
                )
            }
        }
    }

    private fun openSheet() {
        compose.onNode(hasClickAction() and hasText("Level")).performClick()
        compose.onNodeWithText("Your level").assertIsDisplayed()
    }

    @Test
    fun theTileShowsTheLevelTowardTheGoalAndTheSkillAhead() {
        show()

        compose.onNode(hasClickAction() and hasText("Level")).assertIsDisplayed()
        compose.onNodeWithText("A2+, goal B2").assertIsDisplayed()
        compose.onNodeWithText("Reading leads").assertIsDisplayed()
    }

    @Test
    fun aLevelNotMeasuredYetSaysSo() {
        show(languageProgress(level = null, target = null))

        compose.onNodeWithText("Not yet").assertIsDisplayed()
    }

    @Test
    fun theSheetReadsEachSkillsLevelAndWhetherItMoved() {
        show()
        openSheet()

        compose.onNodeWithText("Goal B2 by June 2027").assertIsDisplayed()
        compose.onNodeWithContentDescription("Reading, B1+, up since the level test").assertIsDisplayed()
        compose.onNodeWithContentDescription("Speaking, A2+").assertIsDisplayed()
        compose.onNodeWithContentDescription("Writing, A2, down since the level test").assertIsDisplayed()
        compose.onNodeWithText("Reading and Listening went up since the level test.").assertIsDisplayed()
    }

    @Test
    fun theSheetListsWhatTheLearnerCanDoThenOnlyTheNextOne() {
        show()
        openSheet()

        compose.onNodeWithText("Order food and drinks").performScrollTo().assertIsDisplayed()
        compose
            .onNode(hasText("Describe where I live") and SemanticsMatcher.expectValue(SemanticsProperties.StateDescription, "Not yet"))
            .assertIsDisplayed()
        compose.onNodeWithText("Plan a trip with a friend").assertDoesNotExist()
    }

    @Test
    fun theSpeakingRowOpensTheExamsSpeakingPractice() {
        show(languageProgress().copy(speaking = speakingPaper(access = "plusRequired")))
        openSheet()

        compose.onNodeWithText("DELE B2 tasks on a call").performScrollTo().assertIsDisplayed()
        compose.onNodeWithContentDescription("Available with Plus").assertIsDisplayed()
        compose.onNodeWithText("Exam-style speaking").performClick()

        compose.runOnIdle { assertEquals(AppRoute.Speaking(), navigator.currentRoute) }
        compose.onNodeWithText("Your level").assertDoesNotExist()
    }

    @Test
    fun theSpeakingMockStartsOnlyOnTheTapAndOpensItsCall() {
        show(languageProgress(speakingMock = "ielts"))
        openSheet()
        compose.onNodeWithText("IELTS speaking mock").performScrollTo().assertIsDisplayed()
        assertEquals(emptyList<CallRequest>(), requests)

        compose.onNodeWithText("Start the mock").performScrollTo().performClick()

        compose.runOnIdle {
            assertEquals(listOf<CallRequest>(CallRequest.SpeakingMock(UUID.fromString(GOAL))), requests)
            assertEquals(AppRoute.Conversation(started.toString()), navigator.currentRoute)
        }
    }
}
