package com.zoonk.android.feature.pattern

import androidx.activity.ComponentActivity
import androidx.compose.runtime.getValue
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.app.AppContainer
import com.zoonk.android.ui.theme.ZoonkTheme
import com.zoonk.api.models.MistakePattern
import kotlinx.coroutines.CompletableDeferred
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.annotation.Config

@RunWith(AndroidJUnit4::class)
@Config(qualifiers = "w411dp-h891dp")
class PatternFlowTest {
    @get:Rule
    val rule = createAndroidComposeRule<ComponentActivity>()

    private fun show(
        pattern: MistakePattern,
        api: FakePatternApi,
    ): PatternViewModel = patternViewModel(api).also { it.begin(pattern) }.also(::show)

    private fun show(viewModel: PatternViewModel) {
        rule.setContent {
            ZoonkTheme {
                val drill by viewModel.state.collectAsStateWithLifecycle()
                drill?.let { PatternContent(it, viewModel, AppContainer.preview(rule.activity)) }
            }
        }
    }

    private fun answer(option: String) {
        rule.onNodeWithText(option).performClick()
        rule.onNodeWithText("Check").performClick()
    }

    @Test
    fun eachAnswerIsCheckedThenTheDrillIsSavedOnce() {
        val api = FakePatternApi()
        show(pattern(), api)

        rule.onNodeWithText("We noticed a pattern").assertIsDisplayed()
        rule.onNodeWithText("It came up 2 times in your recent answers.").assertIsDisplayed()
        rule.onNodeWithText("Practice this", substring = true).performClick()

        answer("agree")
        rule.onNodeWithText("Correct!").assertIsDisplayed()
        rule.onNodeWithText("“Agree” is already a verb.").performScrollTo().assertIsDisplayed()
        rule.onNodeWithText("Continue").performClick()

        answer("are agree")
        rule.onNodeWithText("Not quite").assertIsDisplayed()
        rule.onNodeWithText("See how you did").performClick()

        rule.onNodeWithText("Practice done").assertIsDisplayed()
        rule.onNodeWithText("Knowing the rule is the first step. It gets easier each time you use it.").assertIsDisplayed()
        assertEquals(listOf("agree", "are agree"), api.practices.single().answers)
    }

    @Test
    fun aSaveThatDidNotGoThroughIsSentAgainAsTheSameDrill() {
        val api = FakePatternApi(failures = 1)
        show(pattern(), api)

        rule.onNodeWithText("Practice this", substring = true).performClick()
        answer("agree")
        rule.onNodeWithText("Continue").performClick()
        answer("agree")
        rule.onNodeWithText("See how you did").performClick()

        rule.onNodeWithText("That didn't go through. Your answers are kept.").assertIsDisplayed()
        rule.onNodeWithText("Try again").performClick()

        rule.onNodeWithText("You've got this rule.").assertIsDisplayed()
        assertEquals(
            1,
            api.practices
                .map { it.requestId }
                .distinct()
                .size,
        )
        assertEquals(2, api.practices.size)
    }

    @Test
    fun typosHaveNothingToPracticeAndShowingThemClearsThem() {
        val api = FakePatternApi()
        val viewModel = show(pattern(kind = MistakePattern.Kind.TYPOS), api)

        rule.onNodeWithText("Just typos").assertIsDisplayed()
        rule.onNodeWithText("Done").performClick()

        assertEquals(1, api.dismissals)
        assertTrue(viewModel.closed.value)
    }

    @Test
    fun onAPhoneTheRuleOpensFromTheQuestion() {
        show(pattern(), FakePatternApi())

        rule.onNodeWithText("Practice this", substring = true).performClick()
        rule.onNodeWithText("See the rule").performClick()

        rule.onNodeWithText("“Agree” is a verb, so it needs no “am”.").assertIsDisplayed()
        rule.onNodeWithText("Where you slipped").assertIsDisplayed()
    }

    @Test
    fun leavingWhileTheDrillSavesWaitsForItSoTheDrillStillCounts() {
        val api = FakePatternApi(gate = CompletableDeferred())
        val viewModel = show(pattern(), api)

        rule.onNodeWithText("Practice this", substring = true).performClick()
        answer("agree")
        rule.onNodeWithText("Continue").performClick()
        answer("agree")
        rule.onNodeWithText("See how you did").performClick()
        rule.onNodeWithContentDescription("Leave").performClick()

        assertFalse(viewModel.closed.value)
        api.gate?.complete(Unit)
        rule.waitForIdle()
        assertTrue(viewModel.closed.value)
        assertEquals(1, api.saved)
    }

    @Test
    fun aRightAnswerWithSpacesAroundItIsMarkedRight() {
        show(pattern(firstAnswer = " agree "), FakePatternApi())

        rule.onNodeWithText("Practice this", substring = true).performClick()
        answer("agree")

        rule.onNodeWithText("Correct!").assertIsDisplayed()
        rule.onNodeWithText("am agree").assertDoesNotExist()
    }

    @Test
    fun afterTheProcessEndsTheDrillComesBackAndItsSaveCountsOnce() {
        val api = FakePatternApi(failures = 1)
        val saved = SavedStateHandle()
        patternViewModel(api, saved).run {
            begin(pattern())
            start()
            pick(1)
            check()
            next()
            pick(0)
            check()
            next()
        }

        show(patternViewModel(api, SavedStateHandle(saved.keys().associateWith { saved.get<Any>(it) })).also { it.begin(pattern()) })
        rule.onNodeWithText("Correct!").assertIsDisplayed()
        rule.onNodeWithText("See how you did").performClick()

        rule.onNodeWithText("You've got this rule.").assertIsDisplayed()
        assertEquals(2, api.practices.size)
        assertEquals(
            1,
            api.practices
                .map { it.requestId }
                .distinct()
                .size,
        )
    }

    @Test
    fun aSecondTryAgainWhileTheFirstIsOnItsWaySendsNothingMore() {
        val api = FakePatternApi(failures = 1)
        val viewModel = patternViewModel(api)
        viewModel.begin(pattern())
        viewModel.start()
        viewModel.pick(1)
        viewModel.check()
        viewModel.next()
        viewModel.pick(0)
        viewModel.check()
        viewModel.next()

        api.gate = CompletableDeferred()
        viewModel.retry()
        viewModel.retry()

        assertEquals(2, api.practices.size)
    }
}
