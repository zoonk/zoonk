package com.zoonk.android.feature.account

import androidx.compose.runtime.remember
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.test.SemanticsMatcher
import androidx.compose.ui.test.assertHeightIsAtLeast
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertTouchHeightIsEqualTo
import androidx.compose.ui.test.hasClickAction
import androidx.compose.ui.test.hasContentDescription
import androidx.compose.ui.test.hasSetTextAction
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.isHeading
import androidx.compose.ui.test.junit4.ComposeContentTestRule
import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performTextInput
import androidx.compose.ui.unit.dp
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.app.AppContainer
import com.zoonk.android.navigation.AppNavigator
import com.zoonk.android.navigation.rememberAppNavigator
import com.zoonk.android.ui.theme.ZoonkTheme
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.annotation.Config

/** What TalkBack finds on sign-in: headings, labeled fields, named actions, announced errors, 48dp targets. */
@RunWith(AndroidJUnit4::class)
@Config(qualifiers = "w411dp-h891dp")
class SignInAccessibilityTest {
    @get:Rule
    val rule: ComposeContentTestRule = createComposeRule()

    private val isLiveRegion = SemanticsMatcher.keyIsDefined(SemanticsProperties.LiveRegion)

    private fun show(content: @androidx.compose.runtime.Composable (AppContainer, AppNavigator) -> Unit) {
        rule.setContent {
            val context = LocalContext.current
            val app = remember { AppContainer.preview(context) }
            ZoonkTheme { content(app, rememberAppNavigator()) }
        }
    }

    @Test
    fun theSignInScreenNamesEverythingAndAnnouncesItsError() {
        show { app, navigator -> LoginScreen(app, navigator) }

        rule.onNode(hasText("Sign in or create an account") and isHeading()).assertIsDisplayed()
        rule.onNode(hasContentDescription("Leave") and hasClickAction()).assertTouchHeightIsEqualTo(48.dp)
        rule.onNode(hasSetTextAction() and hasText("Email")).assertIsDisplayed()
        val send = rule.onNode(hasText("Continue") and hasClickAction())
        send.assertHeightIsAtLeast(48.dp)

        rule.onNode(hasSetTextAction()).performTextInput("ana@zoonk")
        send.performClick()

        rule.onNode(hasText("Enter a valid email address") and isLiveRegion).assertIsDisplayed()
    }

    @Test
    fun aVisitorsMenuOffersLogInByName() {
        show { app, navigator -> AccountMenu(app, navigator) }

        rule.onNode(hasText("Log in") and hasClickAction()).assertHeightIsAtLeast(48.dp)
        rule.onNode(hasContentDescription("User menu") and hasClickAction()).assertTouchHeightIsEqualTo(48.dp).performClick()

        listOf("Settings", "Pricing", "Help").forEach { item ->
            rule.onNode(hasText(item) and hasClickAction()).assertHeightIsAtLeast(48.dp)
        }
    }
}
