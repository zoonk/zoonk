package com.zoonk.android.feature.practice

import androidx.activity.ComponentActivity
import androidx.compose.runtime.getValue
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.test.assertIsNotSelected
import androidx.compose.ui.test.assertIsSelected
import androidx.compose.ui.test.hasContentDescription
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.isSelectable
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.test.performKeyInput
import androidx.compose.ui.test.pressKey
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.app.AppContainer
import com.zoonk.android.data.ANA
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.FakeSession
import com.zoonk.android.feature.practice.block.Runner
import com.zoonk.android.navigation.rememberAppNavigator
import com.zoonk.android.ui.theme.ZoonkTheme
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

/** A practice question's number keys pick what they show, as main's do: an option, or a card on a match board. */
@RunWith(AndroidJUnit4::class)
class RunNumberKeysTest {
    @get:Rule
    val rule = createAndroidComposeRule<ComponentActivity>()

    private val cache =
        AppCache(FakeSession(AuthenticatedSession(ANA, "token", "local")), CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate))

    private fun open(question: JsonObject) {
        val viewModel = practiceViewModel(cache, blockDetail(listOf(question)))
        val read = viewModel.started()
        rule.setContent {
            ZoonkTheme {
                val navigator = rememberAppNavigator()
                val run by viewModel.state.collectAsStateWithLifecycle()
                run?.let { Runner(read, it, viewModel, AppContainer.preview(rule.activity), navigator, onClose = {}) }
            }
        }
        rule.waitForIdle()
    }

    private fun press(key: Key) {
        rule.onRoot().performKeyInput { pressKey(key) }
        rule.waitForIdle()
    }

    @Test
    fun aNumberKeyPicksItsOptionAndPressingItAgainLetsGo() {
        open(blockQuestion(ITEM, "question" to "Which is a star?", "options" to strings("Venus", "Sun")))

        press(Key.Two)
        rule.onNode(hasText("Sun") and isSelectable()).assertIsSelected()

        press(Key.Two)
        rule.onNode(hasText("Sun") and isSelectable()).assertIsNotSelected()
    }

    @Test
    fun numberKeysPickMatchCardsDownTheLeftColumnThenTheRight() {
        open(
            blockQuestion(
                ITEM,
                "format" to "matchPairs",
                "question" to "Match each word with its meaning",
                "options" to null,
                "select" to null,
                "left" to strings("il martedì", "domani"),
                "right" to strings("tomorrow", "Tuesday"),
                "key" to JsonArray(listOf(JsonPrimitive(1), JsonPrimitive(0))),
                "placement" to false,
            ),
        )

        press(Key.One)
        press(Key.Four)

        rule.onNode(hasContentDescription("il martedì, matched with Tuesday")).assertExists()
    }

    private companion object {
        const val ITEM = "3b4c3e1a-1c2d-4e5f-8a9b-0c1d2e3f4a5b"
    }
}
