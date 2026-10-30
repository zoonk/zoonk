package com.zoonk.android.app

import android.content.pm.ActivityInfo
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.material3.SnackbarHost
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.ComposeTestRule
import androidx.compose.ui.test.junit4.v2.createEmptyComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performTextInput
import androidx.test.core.app.ActivityScenario
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.data.FakeSession
import com.zoonk.android.feature.feedback.FeedbackSender
import com.zoonk.android.feature.feedback.FeedbackSheet
import com.zoonk.android.feature.feedback.rememberSendFeedback
import com.zoonk.android.ui.theme.ZoonkTheme
import kotlinx.coroutines.CompletableDeferred
import org.junit.After
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RuntimeEnvironment
import org.robolectric.Shadows.shadowOf
import org.robolectric.annotation.Config

@RunWith(AndroidJUnit4::class)
@Config(qualifiers = "w411dp-h891dp")
class AppSnackbarsTest {
    @get:Rule
    val rule: ComposeTestRule = createEmptyComposeRule()

    private lateinit var scenario: ActivityScenario<SnackbarTestActivity>

    @After
    fun close() = scenario.close()

    @Test
    fun aSnackbarForWorkThatOutlivesItsWindowShowsInTheNextOne() {
        val application = RuntimeEnvironment.getApplication()
        shadowOf(application.packageManager).addOrUpdateActivity(
            ActivityInfo().apply {
                name = SnackbarTestActivity::class.java.name
                packageName = application.packageName
            },
        )
        val answer = CompletableDeferred<Unit>()
        SnackbarTest.app = AppContainer.preview(application)
        SnackbarTest.sender = FeedbackSender({ _, _ -> answer.await() }, FakeSession(null))
        scenario = ActivityScenario.launch(SnackbarTestActivity::class.java)

        rule.runOnIdle { SnackbarTest.sheet.open() }
        rule.onNodeWithText("Message").performTextInput("The timer skips a second")
        rule.onNodeWithText("Your email, for our reply").performTextInput("ana@example.com")
        rule.onNodeWithText("Send message").performClick()

        scenario.recreate()
        answer.complete(Unit)
        rule.onNodeWithText(THANKS).assertIsDisplayed()

        scenario.recreate()
        rule.onNodeWithText(THANKS).assertIsDisplayed()
    }

    private companion object {
        const val THANKS = "Thanks! We got your message."
    }
}

/** Outlives [SnackbarTestActivity]'s recreations, as the app's container does. */
object SnackbarTest {
    lateinit var app: AppContainer
    lateinit var sender: FeedbackSender
    lateinit var sheet: FeedbackSheet
}

class SnackbarTestActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            ZoonkTheme {
                val snackbars = rememberWindowSnackbars(SnackbarTest.app)

                CompositionLocalProvider(LocalSnackbarHostState provides snackbars) {
                    SnackbarTest.sheet = rememberSendFeedback(SnackbarTest.app, "test", SnackbarTest.sender)
                    SnackbarHost(snackbars)
                }
            }
        }
    }
}
