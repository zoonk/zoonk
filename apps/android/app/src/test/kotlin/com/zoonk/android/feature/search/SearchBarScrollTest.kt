package com.zoonk.android.feature.search

import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material3.Text
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsNotDisplayed
import androidx.compose.ui.test.junit4.ComposeContentTestRule
import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performTouchInput
import androidx.compose.ui.test.swipeDown
import androidx.compose.ui.test.swipeUp
import androidx.compose.ui.unit.dp
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.app.AppContainer
import com.zoonk.android.app.WithTabRootBar
import com.zoonk.android.navigation.rememberAppNavigator
import com.zoonk.android.ui.scaffold.TabRootScaffold
import com.zoonk.android.ui.theme.ZoonkTheme
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.annotation.Config

@RunWith(AndroidJUnit4::class)
@Config(qualifiers = "w411dp-h891dp")
class SearchBarScrollTest {
    @get:Rule
    val rule: ComposeContentTestRule = createComposeRule()

    @Test
    fun thePhonesBarScrollsAwayWithThePageAndBack() {
        rule.setContent {
            ZoonkTheme {
                val context = LocalContext.current
                val app = remember { AppContainer.preview(context) }
                WithTabRootBar(app, rememberAppNavigator()) {
                    TabRootScaffold { padding ->
                        LazyColumn(Modifier.fillMaxSize().testTag("page"), contentPadding = padding) {
                            items(100) { Text("Row $it", Modifier.padding(16.dp)) }
                        }
                    }
                }
            }
        }

        rule.onNodeWithText("Search or ask…").assertIsDisplayed()
        rule.onNodeWithTag("page").performTouchInput { swipeUp() }
        rule.onNodeWithText("Search or ask…").assertIsNotDisplayed()
        // From the middle: the list's top edge sits under the app bar.
        rule.onNodeWithTag("page").performTouchInput { swipeDown(startY = centerY, endY = bottom) }
        rule.onNodeWithText("Search or ask…").assertIsDisplayed()
    }
}
