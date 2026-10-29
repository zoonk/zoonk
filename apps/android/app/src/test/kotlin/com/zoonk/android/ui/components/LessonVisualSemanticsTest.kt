package com.zoonk.android.ui.components

import androidx.activity.ComponentActivity
import androidx.compose.ui.test.assertCountEquals
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.ui.theme.ZoonkTheme
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class LessonVisualSemanticsTest {
    @get:Rule
    val rule = createAndroidComposeRule<ComponentActivity>()

    @Test
    fun talkBackReadsEveryValueInPlaceOfTheDrawing() {
        rule.setContent {
            ZoonkTheme {
                LessonVisual(
                    LessonVisual.Chart(
                        chart = LessonVisual.Chart.Kind.Bar,
                        title = "Votes",
                        categoryLabel = "Year",
                        valueLabel = "Turnout",
                        categories = listOf("2018", "2022"),
                        series =
                            listOf(
                                LessonVisual.Chart.Series("North", listOf(70.0, 75.5)),
                                LessonVisual.Chart.Series("South", listOf(80.0, 82.0)),
                            ),
                        unit = "%",
                    ),
                )
            }
        }

        rule.onNodeWithContentDescription("Turnout by Year. 2018: North 70%, South 80%; 2022: North 75.5%, South 82%").assertExists()
        rule.onAllNodesWithText("Turnout").assertCountEquals(0)
        rule.onAllNodesWithText("North").assertCountEquals(0)
    }
}
