package com.zoonk.android.feature.exam

import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.test.getBoundsInRoot
import androidx.compose.ui.test.junit4.ComposeContentTestRule
import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.unit.Density
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.navigation.rememberAppNavigator
import com.zoonk.android.ui.theme.ZoonkTheme
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode

@RunWith(AndroidJUnit4::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
class ExamMocksLayoutTest {
    @get:Rule
    val rule: ComposeContentTestRule = createComposeRule()

    @Test
    @Config(qualifiers = "w560dp-h1000dp")
    fun everyTakenMockPutsItsScoreOnTheSameSideAtTwiceTheFontSize() {
        show(fontScale = 2f)

        val under = SCORES.map { (title, score) -> scoreUnder(title, score) }
        assertEquals("Under its line: $under", 1, under.distinct().size)
    }

    @Test
    @Config(qualifiers = "w411dp-h891dp")
    fun aPhoneKeepsTheScoresBesideTheirTitles() {
        show(fontScale = 1f)

        assertEquals(listOf(false, false), SCORES.map { (title, score) -> scoreUnder(title, score) })
    }

    private fun show(fontScale: Float) {
        val exam = exam(""""mocks":[${taken(2, 1, 9)},${taken(1, 163, 180)}]""")
        rule.setContent {
            CompositionLocalProvider(LocalDensity provides Density(LocalDensity.current.density, fontScale)) {
                ZoonkTheme { ExamMocksSection(exam, mockOffered = false, navigator = rememberAppNavigator()) }
            }
        }
    }

    private fun scoreUnder(
        title: String,
        score: String,
    ): Boolean =
        rule.onNodeWithText(score, useUnmergedTree = true).getBoundsInRoot().left ==
            rule.onNodeWithText(title, useUnmergedTree = true).getBoundsInRoot().left

    private fun taken(
        number: Int,
        correct: Int,
        total: Int,
    ) = """{"blockId":"$BLOCK","correct":$correct,"examQuestions":null,"finishedAt":"2026-10-2${number}T15:00:00Z","measure":$correct,
        "number":$number,"purpose":"practice","scoring":"raw","shape":{"area":null,"day":1,"kind":"full"},"total":$total}"""

    private companion object {
        val SCORES = listOf("Mock exam 2" to "1 of 9 right", "Mock exam 1" to "163 of 180 right")
    }
}
