package com.zoonk.android.feature.practice

import androidx.activity.ComponentActivity
import androidx.compose.material3.Text
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.test.SemanticsMatcher
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.app.AppContainer
import com.zoonk.android.ui.theme.ZoonkTheme
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.annotation.Config

@RunWith(AndroidJUnit4::class)
class RunKitSlotsTest {
    @get:Rule
    val rule = createAndroidComposeRule<ComponentActivity>()

    @Test
    fun aRunsResultCanNameWhatItFinishedInItsTopBar() {
        rule.setContent {
            ZoonkTheme {
                RunFinished(title = "Done", action = "Close", saving = false, onClose = {}, headerTitle = "Ser and estar") {}
            }
        }

        rule.onNodeWithText("Ser and estar").assertExists()
    }

    @Test
    @Config(qualifiers = "w1280dp-h800dp-land")
    fun aRunsAsideIsNamedForTalkBack() {
        rule.setContent {
            ZoonkTheme {
                RunFrame(
                    title = "Ser and estar",
                    question = null,
                    app = AppContainer.preview(rule.activity),
                    onClose = {},
                    mainAction = null,
                    report = null,
                    progress = {},
                    actions = null,
                    aside = { Text("Use ser for what something is.") },
                    asideTitle = "The rule",
                ) { _, _ -> }
            }
        }

        rule.onNode(SemanticsMatcher.expectValue(SemanticsProperties.PaneTitle, "The rule")).assertExists()
    }
}
