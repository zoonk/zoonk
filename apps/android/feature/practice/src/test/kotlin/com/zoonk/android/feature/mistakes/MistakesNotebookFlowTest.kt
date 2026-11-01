package com.zoonk.android.feature.mistakes

import androidx.activity.ComponentActivity
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.test.SemanticsMatcher
import androidx.compose.ui.test.assertCountEquals
import androidx.compose.ui.test.getUnclippedBoundsInRoot
import androidx.compose.ui.test.junit4.StateRestorationTester
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.unit.dp
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.window.layout.FoldingFeature
import androidx.window.testing.layout.FoldingFeature
import androidx.window.testing.layout.TestWindowLayoutInfo
import androidx.window.testing.layout.WindowLayoutInfoPublisherRule
import com.zoonk.android.data.ANA
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.FakeSession
import com.zoonk.android.navigation.rememberAppNavigator
import com.zoonk.android.ui.theme.ZoonkTheme
import com.zoonk.api.ApiJson
import com.zoonk.api.models.GoalMistakePattern
import com.zoonk.api.models.MistakeList
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.annotation.Config
import java.util.UUID

@RunWith(AndroidJUnit4::class)
class MistakesNotebookFlowTest {
    @get:Rule(order = 0)
    val folds = WindowLayoutInfoPublisherRule()

    @get:Rule(order = 1)
    val rule = createAndroidComposeRule<ComponentActivity>()

    private val goalId = UUID.fromString("00000000-0000-4000-8000-0000000000a1")
    private var open: MistakeList = notebook(listOf("Percentages" to "What is half of 250?", "Ratios" to "If 3 cost 12, what do 5 cost?"))
    private var fixed: MistakeList? = null
    private val fixedGate = CompletableDeferred<Unit>()

    private fun notebook(mistakes: List<Pair<String, String>>): MistakeList {
        val data =
            mistakes.mapIndexed { index, (skill, question) ->
                """{"cause":"gap","createdAt":"2026-10-29T12:00:00Z","fixedAt":null,"id":"00000000-0000-4000-8000-00000000000$index",
                "itemId":null,"lesson":null,"practiceAvailable":true,"practiceAvailableTomorrow":false,
                "skill":{"id":"00000000-0000-4000-8000-0000000000b$index","name":"$skill"},
                "snapshot":{"answer":"1","correctAnswer":"2","question":"$question"},"status":"open"}"""
            }
        return ApiJson.decodeFromString(
            MistakeList.serializer(),
            """{"availability":{"ready":1,"tomorrow":0},"counts":{"byCause":{"gap":1,"guess":0,"misread":0,"time":0,"trap":0,"unsorted":0},
            "fixed":2,"open":${mistakes.size}},"data":[${data.joinToString(",")}],"pagination":{"hasMore":false,"nextCursor":null},
            "trueFalseLabels":"trueFalse"}""",
        )
    }

    private fun store(): MistakesNotebookStore {
        val session = FakeSession(AuthenticatedSession(ANA, "token", "local"))
        val api =
            object : NotebookApi {
                override suspend fun page(
                    session: AuthenticatedSession,
                    key: NotebookKey,
                    cursor: String?,
                    timeZone: String,
                ): MistakeList {
                    if (key.fixed) fixedGate.await()
                    return if (key.fixed) fixed ?: open else open
                }

                override suspend fun pattern(
                    session: AuthenticatedSession,
                    goalId: UUID,
                ) = GoalMistakePattern(pattern = null)
            }
        return MistakesNotebookStore(
            api,
            AppCache(session, CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)),
            session,
        ) { "UTC" }
    }

    @Test
    fun theTabsStayWhileTheOtherTabLoads() {
        rule.setContent { ZoonkTheme { Notebook(goalId, "ENEM", store(), rememberAppNavigator()) } }

        rule.onNodeWithText("Fixed").performClick()

        rule.onNodeWithText("To fix").assertExists()
        rule.onNodeWithText("Mistakes notebook").assertExists()
    }

    @Test
    fun aSkillThatIsGoneOpensTheFirstOneLeft() {
        val store = store()
        rule.setContent { ZoonkTheme { Notebook(goalId, "ENEM", store, rememberAppNavigator()) } }
        rule.onNodeWithText("Ratios").performScrollTo().performClick()
        rule.onNodeWithText("If 3 cost 12, what do 5 cost?").assertExists()

        open = notebook(listOf("Percentages" to "What is half of 250?"))
        rule.runOnUiThread { runBlocking { store.notebooks[NotebookKey(goalId, fixed = false)].refresh() } }
        rule.waitForIdle()

        rule.onNodeWithText("What is half of 250?").assertExists()
    }

    /** A Pixel Fold's inner display, its fold down the window's middle. */
    private fun unfold() {
        folds.overrideWindowLayoutInfo(
            TestWindowLayoutInfo(
                listOf(FoldingFeature(rule.activity, state = FoldingFeature.State.FLAT, orientation = FoldingFeature.Orientation.VERTICAL)),
            ),
        )
        rule.waitForIdle()
    }

    private fun bounds(text: String) = rule.onNodeWithText(text).getUnclippedBoundsInRoot()

    @Test
    @Config(qualifiers = "w852dp-h883dp")
    fun anOpenBookShowsWhatsToFixBeforeTheFoldAndWhatsFixedAfterIt() {
        fixed = notebook(listOf("Fractions" to "What is a half of a half?"))
        fixedGate.complete(Unit)
        rule.setContent { ZoonkTheme { Notebook(goalId, "ENEM", store(), rememberAppNavigator()) } }
        unfold()

        rule.onAllNodes(SemanticsMatcher.expectValue(SemanticsProperties.Role, Role.Tab)).assertCountEquals(0)
        assertTrue("Practice mistakes before the fold", bounds("Practice mistakes").right <= 426.dp)
        assertTrue("what's to fix before the fold", bounds("Percentages").right <= 426.dp)
        assertTrue("what's fixed after the fold", bounds("Fractions").left >= 426.dp)
        assertTrue("its title after the fold", bounds("Fixed").left >= 426.dp)
    }

    /** Opening the book recreates the screen, and the list to fix is the one the tabs showed. */
    @Test
    @Config(qualifiers = "w852dp-h883dp")
    fun whatsOpenInTheListToFixStaysAsTheBookOpens() {
        val restoration = StateRestorationTester(rule)
        restoration.setContent { ZoonkTheme { Notebook(goalId, "ENEM", store(), rememberAppNavigator()) } }
        rule.onNodeWithText("Ratios").performScrollTo().performClick()
        rule.onNodeWithText("If 3 cost 12, what do 5 cost?").assertExists()

        unfold()
        restoration.emulateSavedInstanceStateRestore()

        rule.onNodeWithText("If 3 cost 12, what do 5 cost?").assertExists()
        assertTrue("on the page before the fold", bounds("Ratios").right <= 426.dp)
    }

    /** What the Fixed tab showed is the list on the page after the fold, so what's open in it stays as the book opens. */
    @Test
    @Config(qualifiers = "w852dp-h883dp")
    fun whatsOpenInTheFixedListStaysAsTheBookOpens() {
        fixed = notebook(listOf("Fractions" to "What is a half of a half?", "Decimals" to "What is 0.5 + 0.25?"))
        fixedGate.complete(Unit)
        rule.setContent { ZoonkTheme { Notebook(goalId, "ENEM", store(), rememberAppNavigator()) } }
        rule.onNodeWithText("Fixed").performClick()
        rule.onNodeWithText("Decimals").performScrollTo().performClick()
        rule.onNodeWithText("What is 0.5 + 0.25?").assertExists()

        unfold()

        rule.onNodeWithText("What is 0.5 + 0.25?").assertExists()
        assertTrue("what's fixed after the fold", bounds("Decimals").left >= 426.dp)
    }
}
