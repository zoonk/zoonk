package com.zoonk.android.feature.activities.sorting

import androidx.activity.ComponentActivity
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.SemanticsActions
import androidx.compose.ui.test.junit4.StateRestorationTester
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.feature.activities.ActivityFixtures
import com.zoonk.android.feature.activities.ActivityPhase
import com.zoonk.android.feature.activities.ActivityProps
import com.zoonk.android.feature.player.model.ActivityAnswer
import com.zoonk.android.feature.player.steps.activityRenderers
import com.zoonk.android.ui.theme.ZoonkTheme
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

/** After the app was closed in the background, a canvas's saved work comes back but the player's answer doesn't. */
@RunWith(AndroidJUnit4::class)
class SortingRestoreTest {
    @get:Rule
    val rule = createAndroidComposeRule<ComponentActivity>()

    private var current by mutableStateOf<ActivityAnswer?>(null)

    private fun open(template: String): StateRestorationTester {
        val restoration = StateRestorationTester(rule)
        val content = ActivityFixtures.content(template)
        restoration.setContent {
            ZoonkTheme {
                Column(Modifier.verticalScroll(rememberScrollState())) {
                    checkNotNull(activityRenderers[template]).canvas(
                        ActivityProps(
                            content = content,
                            answer = current,
                            expected = null,
                            isCorrect = null,
                            phase = ActivityPhase.Answering,
                            isLocked = false,
                            onAnswerChange = { current = it },
                        ),
                    )
                }
            }
        }
        return restoration
    }

    private fun answersAgainAfterTheProcessEnds(restoration: StateRestorationTester) {
        val answer = current
        assertNotNull(answer)
        current = null
        restoration.emulateSavedInstanceStateRestore()
        rule.waitForIdle()
        assertEquals(answer, current)
    }

    private fun tap(text: String) = rule.onNodeWithText(text).performScrollTo().performClick()

    private fun tapDescribed(description: String) = rule.onNodeWithContentDescription(description).performScrollTo().performClick()

    @Test
    fun categorize() {
        val restoration = open("categorize")
        val placements = listOf("Burning wood" to "New substance", "Melting ice" to "Same substance", "Rusting iron" to "New substance")
        placements.forEach { (item, group) ->
            tap(item)
            tapDescribed("Put $item in $group")
        }
        answersAgainAfterTheProcessEnds(restoration)
    }

    @Test
    fun processOrder() {
        val restoration = open("processOrder")
        rule.onNodeWithText("Chlorophyll absorbs sunlight").performScrollTo().also { row ->
            val action = row.fetchSemanticsNode().config[SemanticsActions.CustomActions].first()
            rule.runOnIdle { action.action() }
        }
        answersAgainAfterTheProcessEnds(restoration)
    }

    @Test
    fun matchPairs() {
        val restoration = open("matchPairs")
        listOf("embarazada" to "pregnant", "éxito" to "success", "librería" to "bookstore").forEach { (left, right) ->
            tap(left)
            tap(right)
        }
        answersAgainAfterTheProcessEnds(restoration)
    }

    @Test
    fun causeEffectChain() {
        val restoration = open("causeEffectChain")
        tap("Prairie plowed for wheat")
        tap("Dust storms")
        answersAgainAfterTheProcessEnds(restoration)
    }

    @Test
    fun timeline() {
        val restoration = open("timeline")
        tapDescribed("Place Moon landing on the timeline")
        tapDescribed("Place Cleopatra rules Egypt on the timeline")
        answersAgainAfterTheProcessEnds(restoration)
    }

    @Test
    fun labeledDiagram() {
        val restoration = open("labeledDiagram")
        listOf("Right atrium", "Left atrium", "Right ventricle", "Left ventricle", "Aorta").forEachIndexed { index, name ->
            tapDescribed("Put $name on spot ${index + 1}")
        }
        answersAgainAfterTheProcessEnds(restoration)
    }
}
