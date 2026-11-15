package com.zoonk.android.feature.onboarding.start

import androidx.activity.ComponentActivity
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.feature.onboarding.Refusal
import com.zoonk.android.feature.onboarding.UsageLimit
import com.zoonk.android.feature.onboarding.WriteOutcome
import com.zoonk.android.ui.components.LocalClock
import com.zoonk.android.ui.components.TestClock
import com.zoonk.android.ui.theme.ZoonkTheme
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

/**
 * The goal's upload and a question about its material are dated caps: each refusal is the shared notice, with what
 * ran out, when more comes back and Subscribe, and only "You can try again now." once the day comes.
 */
@RunWith(AndroidJUnit4::class)
class MaterialLimitNoticeTest {
    @get:Rule
    val compose = createAndroidComposeRule<ComponentActivity>()

    private val clock by lazy { TestClock(compose.mainClock) }
    private var subscribes = 0

    private fun refused(
        resource: String,
        period: String,
        availableAt: String?,
    ) = WriteOutcome.Refused(Refusal.Limit(UsageLimit(period, resource, "free", availableAt).received(clock.start)))

    private fun show(content: @Composable () -> Unit) =
        compose.setContent { CompositionLocalProvider(LocalClock provides clock) { ZoonkTheme { content() } } }

    private fun uploadRefused(
        period: String = "rolling30Days",
        availableAt: String? = clock.opening.toString(),
    ) = show {
        AttachControls(
            pending = false,
            failure = refused("upload", period, availableAt),
            onFile = {},
            onText = {},
            onLink = {},
            onCreateAccount = {},
            onSubscribe = { subscribes++ },
        )
    }

    private fun questionRefused(availableAt: String) =
        show {
            MaterialAnswer(
                refused("materialQuestion", "rolling30Days", availableAt),
                onCreateAccount = {},
                onSubscribe = { subscribes++ },
            )
        }

    private fun waitForTryAgain() =
        compose.waitUntil(10_000) { compose.onAllNodesWithText("You can try again now.").fetchSemanticsNodes().isNotEmpty() }

    @Test
    fun anUploadRefusalIsTheNoticeUntilItsDayComes() {
        uploadRefused()
        compose.onNodeWithText("You've used your uploads").assertExists()
        compose.onNodeWithText("More later today, or subscribe to keep going.").assertExists()
        compose.onNodeWithText("Subscribe").performClick()
        assertEquals(1, subscribes)

        clock.passOpening()
        waitForTryAgain()
        compose.onNodeWithText("You've used your uploads").assertDoesNotExist()
        compose.onNodeWithText("Subscribe").assertDoesNotExist()
    }

    @Test
    fun aQuestionRefusalIsTheNoticeUntilItsDayComes() {
        questionRefused(clock.opening.toString())
        compose.onNodeWithText("You've used your questions").assertExists()
        compose.onNodeWithText("Subscribe").assertExists()

        clock.passOpening()
        waitForTryAgain()
        compose.onNodeWithText("You've used your questions").assertDoesNotExist()
        compose.onNodeWithText("Subscribe").assertDoesNotExist()
    }

    @Test
    fun aDaysCapOnUploadsComesBackTomorrow() {
        uploadRefused(period = "day", availableAt = null)
        compose.onNodeWithText("No more material today").assertExists()
        compose.onNodeWithText("More tomorrow, or subscribe to keep going.").assertExists()
    }

    /** The device's clock is ahead of the server's: a day already past when the refusal arrived is never offered. */
    @Test
    fun aDayPastOnArrivalKeepsTheRefusal() {
        questionRefused(clock.start.minusSeconds(1).toString())
        compose.onNodeWithText("You've used your questions").assertExists()
        compose.onNodeWithText("You can try again now.").assertDoesNotExist()
    }
}
