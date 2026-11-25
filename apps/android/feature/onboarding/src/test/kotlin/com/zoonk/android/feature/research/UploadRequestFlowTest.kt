package com.zoonk.android.feature.research

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.hasSetTextAction
import androidx.compose.ui.test.junit4.ComposeContentTestRule
import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performTextInput
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.data.ApiError
import com.zoonk.android.data.ApiException
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.FakeSession
import com.zoonk.android.data.SignInResult
import com.zoonk.android.feature.onboarding.FakeOnboardingApi
import com.zoonk.android.feature.onboarding.GOAL_ID
import com.zoonk.android.feature.onboarding.OnboardingStore
import com.zoonk.android.feature.onboarding.uploadAskOf
import com.zoonk.android.ui.components.SuggestionLayout
import com.zoonk.android.ui.theme.ZoonkTheme
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.annotation.Config
import java.util.UUID

@RunWith(AndroidJUnit4::class)
@Config(qualifiers = "w411dp-h891dp")
class UploadRequestFlowTest {
    @get:Rule
    val rule: ComposeContentTestRule = createComposeRule()

    private val api = FakeOnboardingApi()
    private val goalId = UUID.fromString(GOAL_ID)
    private var request = uploadAskOf()
    private var layout by mutableStateOf(SuggestionLayout.Panel)

    private fun show() {
        val session = FakeSession(AuthenticatedSession("ana", "token-a", "local-a"))
        val store =
            OnboardingStore(
                api,
                AppCache(session, CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)),
                session,
            ) { SignInResult.SignedIn }
        rule.setContent {
            ZoonkTheme {
                UploadRequestNotice(
                    goalId,
                    request,
                    store,
                    visit = 0,
                    layout,
                    onCreateAccount = {},
                    onSubscribe = {},
                )
            }
        }
    }

    private fun openPasteText() {
        rule.onNodeWithText("Upload the notice").performClick()
        rule.onNodeWithText("Paste text").performClick()
    }

    private fun pasteText(text: String) {
        openPasteText()
        rule.onNode(hasSetTextAction()).performTextInput(text)
        rule.onNodeWithText("Add text").performClick()
        rule.waitForIdle()
    }

    private fun thanks() = rule.onNodeWithText("Thanks. We're reading it now, and your plan will update in a few minutes.")

    @Test
    fun wordsTypedStayWhenTheAskMovesBetweenTheSheetAndThePanel() {
        show()
        openPasteText()
        rule.onNode(hasSetTextAction()).performTextInput("Edital 2027")

        layout = SuggestionLayout.Line
        rule.waitForIdle()
        layout = SuggestionLayout.Panel

        rule.onNodeWithText("Edital 2027").assertIsDisplayed()
    }

    @Test
    fun anAnswerThatDidntSaveKeepsTheAskAndSaysSo() {
        api.researchFailure = ApiException(ApiError.Unavailable)
        show()

        pasteText("Edital 2027")

        rule.onNodeWithText("That didn't save. Try again.").assertIsDisplayed()
        thanks().assertDoesNotExist()
    }

    @Test
    fun anUploadWithNothingReadableKeepsTheAskAndNamesIt() {
        api.researchFailure = ApiException(ApiError.Unavailable, "UPLOAD_UNREADABLE", status = 422)
        show()

        pasteText("Edital 2027")

        rule.onNodeWithText("We couldn't read “Edital”. Try a sharper photo or paste the text.").assertIsDisplayed()
        thanks().assertDoesNotExist()
    }

    @Test
    fun anUploadWithNothingReadableIsNeverSentToResearch() {
        api.readStatuses = listOf("unreadable")
        show()

        pasteText("Edital 2027")

        rule.onNodeWithText("We couldn't read “Edital”. Try a sharper photo or paste the text.").assertIsDisplayed()
        thanks().assertDoesNotExist()
        assertEquals(emptyList<List<UUID>>(), api.researchAnswers)
    }

    @Test
    fun anAskBackAfterNothingCouldBeReadSaysWhichUpload() {
        request = uploadAskOf(unreadable = "IMG_2041.jpg")
        show()

        rule.onNodeWithText("We couldn't read “IMG_2041.jpg”. Try a sharper photo or paste the text.").assertIsDisplayed()
        rule.onNodeWithText("Upload the notice").assertIsDisplayed()
    }

    @Test
    fun anUploadStillBeingReadBringsTheAskBackWhenNothingInItCanBeRead() {
        api.readStatuses = listOf("reading", "unreadable")
        show()

        pasteText("Edital 2027")
        thanks().assertIsDisplayed()
        rule.mainClock.advanceTimeBy(READ_CHECK_MS)
        rule.waitForIdle()

        thanks().assertDoesNotExist()
        rule.onNodeWithText("We couldn't read “Edital”. Try a sharper photo or paste the text.").assertIsDisplayed()
        rule.onNodeWithText("Paste text").assertIsDisplayed()
    }
}

private const val READ_CHECK_MS = 3_000L
