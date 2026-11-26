package com.zoonk.android.ui.components

import androidx.activity.ComponentActivity
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.test.performKeyInput
import androidx.compose.ui.test.pressKey
import androidx.compose.ui.unit.dp
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.ui.theme.ZoonkTheme
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

/** A screen with no frame of its own (a wait's quiz, a test's question) answers number keys pressed anywhere on it. */
@RunWith(AndroidJUnit4::class)
class NumberKeysTest {
    @get:Rule val compose = createAndroidComposeRule<ComponentActivity>()

    @Test
    fun aNumberKeyPicksItsOptionWithoutScrollingToTheQuestion() {
        var picked by mutableStateOf<Int?>(null)
        val scroll = mutableStateOf(0)
        compose.setContent {
            ZoonkTheme {
                Surface {
                    val page = rememberScrollState()
                    scroll.value = page.value
                    Column(Modifier.verticalScroll(page)) {
                        Text("Above the fold", Modifier.fillMaxWidth().height(2000.dp))
                        NumberKeys {
                            PickKeyOptions(count = 3, enabled = true, onPick = { picked = it }) {
                                AnswerOptionGroup {
                                    repeat(
                                        3,
                                    ) { AnswerOption(it + 1, picked == it, null, onClick = { picked = it }) { Text("Option ${it + 1}") } }
                                }
                            }
                        }
                    }
                }
            }
        }
        compose.waitForIdle()

        compose.onRoot().performKeyInput { pressKey(Key.Three) }
        compose.waitForIdle()

        assertEquals(2, picked)
        assertEquals(0, scroll.value)
    }
}
