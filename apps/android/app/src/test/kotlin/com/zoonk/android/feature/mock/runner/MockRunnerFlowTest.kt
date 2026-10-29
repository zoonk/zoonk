package com.zoonk.android.feature.mock.runner

import androidx.compose.runtime.remember
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.junit4.ComposeContentTestRule
import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.app.AppContainer
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.DraftStore
import com.zoonk.android.data.FakeSession
import com.zoonk.android.feature.questions.Answer
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.navigation.rememberAppNavigator
import com.zoonk.android.ui.theme.ZoonkTheme
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import org.junit.runner.RunWith
import org.robolectric.annotation.Config
import kotlin.time.Clock
import kotlin.time.Duration.Companion.minutes

@RunWith(AndroidJUnit4::class)
@Config(qualifiers = "w411dp-h891dp")
class MockRunnerFlowTest {
    @get:Rule
    val rule: ComposeContentTestRule = createComposeRule()

    @get:Rule
    val folder = TemporaryFolder()

    private val api = FakeMockRunApi()

    private fun show() {
        rule.setContent {
            ZoonkTheme {
                val context = LocalContext.current
                val app = remember { AppContainer.preview(context) }
                val scope = remember { CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate) }
                val store =
                    remember {
                        MockRunStore(
                            api,
                            AppCache(FakeSession(AuthenticatedSession("ana", "token", "local")), scope),
                            DraftStore(folder.root, scope),
                        ) {
                            "UTC"
                        }
                    }
                MockScreen(AppRoute.Mock(RUN_BLOCK), app, rememberAppNavigator(), store)
            }
        }
    }

    @Test
    fun aPickIsSavedWithoutFeedbackAndNextOpensTheNextQuestion() {
        show()

        rule.onNodeWithText("What is 1 + 1?").assertIsDisplayed()
        rule.onNodeWithText("2").performClick()
        rule.waitForIdle()
        assertEquals(Answer.Choice(0), api.saved.last { it.itemId == ITEM_ONE }.answer)

        rule.onNodeWithText("Next").performClick()
        rule.onNodeWithText("What is 1 + 2?").assertIsDisplayed()
    }

    @Test
    fun aFlagIsSavedWithTheQuestion() {
        show()

        rule.onNodeWithText("Flag").performClick()
        rule.waitForIdle()

        assertTrue(api.saved.last { it.itemId == ITEM_ONE }.flagged)
    }

    @Test
    fun handingInSaysWhatsBlankThenOpensTheNextSection() {
        api.afterSubmit = secondSection()
        show()

        rule.onNodeWithText("2").performClick()
        rule.onNodeWithText("Next").performClick()
        rule.onNodeWithText("Hand in this section").performClick()
        rule.onNode(hasText("1 question is blank.", substring = true)).assertIsDisplayed()
        rule.onNodeWithText("Hand in").performClick()
        rule.waitForIdle()

        assertEquals(listOf(0), api.submitted)
        rule.onNodeWithText("Which word is a noun?").assertIsDisplayed()
    }

    @Test
    fun aSectionPastItsDeadlineOnlyHandsIn() {
        api.mock = runningMock(current = currentSection(deadline = "${Clock.System.now() - 1.minutes}"))
        show()

        rule.onNodeWithText("Time's up").assertIsDisplayed()
        rule.onNodeWithText("Continue").assertIsDisplayed()
    }
}
