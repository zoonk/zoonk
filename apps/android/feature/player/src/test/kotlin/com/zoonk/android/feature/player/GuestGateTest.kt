package com.zoonk.android.feature.player

import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.feature.account.AccountFailure
import com.zoonk.android.feature.player.model.LessonOutline
import com.zoonk.android.ui.theme.ZoonkTheme
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class GuestGateTest {
    @get:Rule
    val rule = createComposeRule()

    private fun show(failure: AccountFailure) {
        rule.setContent {
            ZoonkTheme {
                GuestGateView(LessonOutline("lesson-1", "Clouds", "Why they float.", 5), failure, onClose = {}, onLogIn = {}, onRetry = {})
            }
        }
    }

    @Test
    fun aDeviceTheSecurityCheckRefusesIsAskedToLogInNotToTryAgain() {
        show(AccountFailure.BotDetected)

        rule.onNodeWithText("A security check blocked starting without an account. Create a free account to keep going.").assertExists()
        rule.onNodeWithText("Log in").assertExists()
        rule.onNodeWithText("Try again").assertDoesNotExist()
    }

    @Test
    fun aLessonThatDidntOpenCanBeTriedAgain() {
        show(AccountFailure.Network)

        rule.onNodeWithText("We couldn't open the lesson. Try again, or log in to keep going.").assertExists()
        rule.onNodeWithText("Try again").assertExists()
    }
}
