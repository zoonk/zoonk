package com.zoonk.android.feature.activities.reasoning

import androidx.activity.ComponentActivity
import androidx.compose.ui.semantics.SemanticsActions
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.feature.activities.ActivityFixtures
import com.zoonk.android.feature.activities.ActivityPhase
import com.zoonk.android.feature.activities.ActivityProps
import com.zoonk.android.feature.activities.selectionIds
import com.zoonk.android.ui.theme.ZoonkTheme
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class SourceComparisonTest {
    @get:Rule
    val compose = createAndroidComposeRule<ComponentActivity>()

    @Test
    fun markingBothAccountsInTheSameFrameKeepsBothMarks() {
        val selections = mutableListOf<List<String>?>()
        val props =
            ActivityProps(
                content = ActivityFixtures.content("sourceComparison"),
                answer = null,
                expected = null,
                isCorrect = null,
                phase = ActivityPhase.Answering,
                isLocked = false,
                onAnswerChange = { selections += it.selectionIds },
            )
        compose.setContent {
            ZoonkTheme { sourceComparisonRenderer.canvas(props) }
        }

        val first = markAction("The regulars fired on us without any provocation.", "The regulars fired on us")
        val second = markAction("Some of the rebels fired first from behind a wall.", "the rebels fired first")
        compose.runOnIdle {
            first()
            second()
        }

        assertEquals(listOf(listOf("p1"), listOf("p1", "p2")), selections)
    }

    private fun markAction(
        excerpt: String,
        passage: String,
    ): () -> Boolean =
        compose
            .onNodeWithContentDescription(excerpt, useUnmergedTree = true)
            .fetchSemanticsNode()
            .config[SemanticsActions.CustomActions]
            .single { passage in it.label }
            .action
}
