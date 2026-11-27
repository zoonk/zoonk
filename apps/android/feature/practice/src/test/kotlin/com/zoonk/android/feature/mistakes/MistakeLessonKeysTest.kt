package com.zoonk.android.feature.mistakes

import androidx.activity.ComponentActivity
import androidx.compose.runtime.getValue
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.test.assertIsNotSelected
import androidx.compose.ui.test.assertIsSelected
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
import com.zoonk.android.feature.session.fixture
import com.zoonk.android.navigation.rememberAppNavigator
import com.zoonk.android.ui.theme.ZoonkTheme
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

/** A lesson screen replayed from mistakes answers number keys as the lesson does. */
@RunWith(AndroidJUnit4::class)
class MistakeLessonKeysTest {
    @get:Rule
    val rule = createAndroidComposeRule<ComponentActivity>()

    private val cache =
        AppCache(
            FakeSession(AuthenticatedSession(ANA, "token", "local")),
            CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate),
        )

    private fun press(key: Key) {
        rule.onRoot().performKeyInput { pressKey(key) }
        rule.waitForIdle()
    }

    @Test
    fun aNumberKeyPicksTheReplayedScreensOptionAndPressingItAgainLetsGo() {
        val viewModel = practiceViewModel(cache, FakeMistakesApi(practice(fixture("mistake-practice-lesson-entry"))))
        viewModel.started()
        rule.setContent {
            ZoonkTheme {
                val state by viewModel.state.collectAsStateWithLifecycle()
                state?.let { PracticeRun(it, viewModel, AppContainer.preview(rule.activity), rememberAppNavigator()) }
            }
        }
        rule.waitForIdle()

        press(Key.Two)
        rule.onNode(hasText("Original wrong") and isSelectable()).assertIsSelected()

        press(Key.Two)
        rule.onNode(hasText("Original wrong") and isSelectable()).assertIsNotSelected()
    }
}
