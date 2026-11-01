package com.zoonk.android.feature.feedback

import androidx.compose.material3.SnackbarHost
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.remember
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.ComposeContentTestRule
import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performTextInput
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.app.AppContainer
import com.zoonk.android.app.LocalSnackbarHostState
import com.zoonk.android.app.rememberWindowSnackbars
import com.zoonk.android.data.FakeSession
import com.zoonk.android.ui.theme.ZoonkTheme
import com.zoonk.api.models.FeedbackSubmission
import kotlinx.coroutines.CompletableDeferred
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.annotation.Config
import java.io.IOException

@RunWith(AndroidJUnit4::class)
@Config(qualifiers = "w411dp-h891dp")
class FeedbackSheetTest {
    @get:Rule
    val rule: ComposeContentTestRule = createComposeRule()

    private val sent = mutableListOf<FeedbackSubmission>()
    private var reachable = true
    private var answer: CompletableDeferred<Unit>? = null
    private lateinit var sheet: FeedbackSheet

    private val sender =
        FeedbackSender(
            { _, submission ->
                answer?.await()
                if (!reachable) throw IOException("offline")
                sent += submission
            },
            FakeSession(null),
        )

    private fun open() {
        rule.setContent {
            ZoonkTheme {
                val context = LocalContext.current
                val app = remember { AppContainer.preview(context) }
                val snackbars = rememberWindowSnackbars(app)

                CompositionLocalProvider(LocalSnackbarHostState provides snackbars) {
                    sheet = rememberSendFeedback(app, "account-menu", sender)
                    SnackbarHost(snackbars)
                }
            }
        }
        rule.runOnIdle { sheet.open() }
    }

    private fun write() {
        rule.onNodeWithText("Message").performTextInput(MESSAGE)
        rule.onNodeWithText("Your email, for our reply").performTextInput("ana@example.com")
    }

    private fun send() {
        rule.onNodeWithText("Send message").performClick()
        rule.waitForIdle()
    }

    @Test
    fun aFailedSendKeepsWhatWasWritten() {
        reachable = false
        open()
        write()
        send()

        rule.onNodeWithText("We couldn't send your message. Try again, or email us at hello@zoonk.com.").assertIsDisplayed()
        rule.onNodeWithText(MESSAGE).assertIsDisplayed()
        rule.onNodeWithText("ana@example.com").assertIsDisplayed()
    }

    @Test
    fun aSlowSendLeavesALaterOpeningOpen() {
        answer = CompletableDeferred()
        open()
        write()
        send()

        rule.runOnIdle { sheet.open() }
        answer?.complete(Unit)
        rule.waitForIdle()

        assertEquals(1, sent.size)
        rule.onNodeWithText(FEEDBACK_DESCRIPTION).assertIsDisplayed()
    }

    private companion object {
        const val MESSAGE = "The timer skips a second"
    }
}
