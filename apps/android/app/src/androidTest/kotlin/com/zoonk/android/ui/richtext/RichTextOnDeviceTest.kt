package com.zoonk.android.ui.richtext

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.ui.theme.ZoonkTheme
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

/**
 * On a device, regexes run on Android's ICU engine, which rejects some patterns the JVM accepts,
 * so the parser's JVM tests can't prove lesson text renders on one.
 */
@RunWith(AndroidJUnit4::class)
class RichTextOnDeviceTest {
    @get:Rule
    val compose = createComposeRule()

    @Test
    fun lessonTextWithListsMathAndATableRendersOnADevice() {
        compose.setContent {
            ZoonkTheme {
                RichText(
                    text =
                        """
                        Energy **adds up** when ${'$'}E = mc^2${'$'}.
                        - A first point
                        1. A numbered one

                        | Line | Riders |
                        | --- | ---: |
                        | Blue | 1200 |
                        """.trimIndent(),
                )
            }
        }

        compose.onNodeWithText("A first point").assertIsDisplayed()
        compose.onNodeWithText("Blue").assertIsDisplayed()
    }
}
