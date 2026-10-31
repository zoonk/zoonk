package com.zoonk.android.feature.account

import androidx.compose.material3.adaptive.navigationsuite.NavigationSuiteType
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.remember
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.ComposeContentTestRule
import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.app.AppContainer
import com.zoonk.android.app.LocalNavigationSuiteType
import com.zoonk.android.feature.feedback.FEEDBACK_DESCRIPTION
import com.zoonk.android.navigation.AppNavigator
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.navigation.rememberAppNavigator
import com.zoonk.android.ui.theme.ZoonkTheme
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.annotation.Config

@RunWith(AndroidJUnit4::class)
@Config(qualifiers = "w411dp-h891dp")
class AccountMenuTest {
    @get:Rule
    val rule: ComposeContentTestRule = createComposeRule()

    private lateinit var navigator: AppNavigator

    private fun open(navigation: NavigationSuiteType = NavigationSuiteType.NavigationBar) {
        rule.setContent {
            ZoonkTheme {
                val context = LocalContext.current
                val app = remember { AppContainer.preview(context) }
                navigator = rememberAppNavigator()
                CompositionLocalProvider(LocalNavigationSuiteType provides navigation) { AccountMenu(app, navigator) }
            }
        }
        rule.onNodeWithContentDescription("User menu").performClick()
    }

    @Test
    fun theMenuOpensSendFeedbackInPlace() {
        open()
        rule.onNodeWithText("Send feedback").performClick()

        rule.onNodeWithText(FEEDBACK_DESCRIPTION).assertIsDisplayed()
        assertEquals(AppRoute.Today, navigator.currentRoute)
    }

    @Test
    fun aWindowWithTheDrawerLeavesSendFeedbackToIt() {
        open(NavigationSuiteType.NavigationDrawer)

        rule.onNodeWithText("Help").assertIsDisplayed()
        rule.onNodeWithText("Send feedback").assertDoesNotExist()
    }
}
