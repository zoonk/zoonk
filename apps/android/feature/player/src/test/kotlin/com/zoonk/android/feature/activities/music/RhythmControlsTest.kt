package com.zoonk.android.feature.activities.music

import android.content.Context
import androidx.activity.ComponentActivity
import androidx.compose.material3.Surface
import androidx.compose.ui.semantics.getOrNull
import androidx.compose.ui.test.hasClickAction
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.core.content.edit
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.feature.activities.ActivityFixtures
import com.zoonk.android.feature.activities.ActivityPhase
import com.zoonk.android.feature.activities.ActivityProps
import com.zoonk.android.ui.components.LayoutPart
import com.zoonk.android.ui.components.LayoutPartKey
import com.zoonk.android.ui.theme.ZoonkTheme
import org.junit.Assert.assertEquals
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

/** One filled, enabled action says what to do next: once a try enables Check, "Try again" steps down, as Run does. */
@RunWith(AndroidJUnit4::class)
class RhythmControlsTest {
    @get:Rule
    val rule = createAndroidComposeRule<ComponentActivity>()

    @Before
    fun soundChecked() {
        ApplicationProvider
            .getApplicationContext<Context>()
            .getSharedPreferences(
                DeviceDelayStore.FILE,
                Context.MODE_PRIVATE,
            ).edit(commit = true) {
                putString(DeviceDelayStore.KEY, "skipped")
            }
    }

    private fun show(taps: List<Double>?) {
        rule.setContent {
            ZoonkTheme {
                Surface {
                    rhythmTapperRenderer.canvas(
                        ActivityProps(
                            content = ActivityFixtures.content("rhythmTapper"),
                            answer = taps?.let { rhythmAnswer(it, deviceDelayMs = null) },
                            expected = null,
                            isCorrect = null,
                            phase = ActivityPhase.Answering,
                            isLocked = false,
                            onAnswerChange = {},
                        ),
                    )
                }
            }
        }
    }

    private fun variantOf(label: String) =
        rule
            .onNode(hasText(label) and hasClickAction())
            .fetchSemanticsNode()
            .config
            .getOrNull(LayoutPartKey)
            ?.variant

    @Test
    fun startTappingIsTheFilledActionBeforeATry() {
        show(taps = null)
        assertEquals(LayoutPart.Variant.Filled, variantOf("Start tapping"))
    }

    @Test
    fun tryAgainStepsDownOnceATryEnablesCheck() {
        show(taps = listOf(0.0, 500.0))
        assertEquals(LayoutPart.Variant.Outline, variantOf("Try again"))
    }
}
