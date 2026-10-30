package com.zoonk.android.feature.exam

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.width
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.SemanticsActions
import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performSemanticsAction
import androidx.compose.ui.text.TextLayoutResult
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.dp
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.ui.theme.ZoonkTheme
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

/** Robolectric's text layout didn't reproduce the lone dot a device showed, so this runs on a device. */
@RunWith(AndroidJUnit4::class)
class ExamFactsOnDeviceTest {
    @get:Rule
    val compose = createComposeRule()

    @Test
    fun aWrappedFactKeepsItsDotAtTwiceTheFontSize() {
        val days = "Nov 14, 2027 and Nov 21, 2027"
        var width by mutableStateOf(411.dp)
        compose.setContent {
            CompositionLocalProvider(LocalDensity provides Density(LocalDensity.current.density, fontScale = 2f)) {
                ZoonkTheme { Box(Modifier.width(width)) { ExamFacts(listOf(days, "1:30 PM", "estimated from past editions")) } }
            }
        }

        val lineCounts =
            (200..411).map { dp ->
                width = dp.dp
                val layouts = mutableListOf<TextLayoutResult>()
                compose.onNodeWithText(days, substring = true).performSemanticsAction(SemanticsActions.GetTextLayoutResult) { it(layouts) }
                val layout = layouts.single()
                val lines =
                    (0 until layout.lineCount).map {
                        layout.layoutInput.text.text
                            .substring(
                                layout.getLineStart(it),
                                layout.getLineEnd(it),
                            ).trim()
                    }
                assertFalse("At ${dp}dp: $lines", "·" in lines)
                layout.lineCount
            }
        assertTrue("The fact never wrapped: $lineCounts", lineCounts.any { it > 1 })
    }
}
