package com.zoonk.android.feature.mock.chooser

import androidx.compose.runtime.remember
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsSelected
import androidx.compose.ui.test.hasScrollAction
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.junit4.ComposeContentTestRule
import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollToNode
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.app.AppContainer
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.FakeSession
import com.zoonk.android.feature.exam.FakeMockApi
import com.zoonk.android.feature.exam.GOAL
import com.zoonk.android.feature.exam.mockOptions
import com.zoonk.android.feature.mock.MockStore
import com.zoonk.android.navigation.AppNavigator
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.navigation.rememberAppNavigator
import com.zoonk.android.ui.theme.ZoonkTheme
import com.zoonk.api.models.MockShape
import com.zoonk.api.models.PlacementMockOption
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.annotation.Config

@RunWith(AndroidJUnit4::class)
@Config(qualifiers = "w411dp-h891dp")
class MockChooserFlowTest {
    @get:Rule
    val rule: ComposeContentTestRule = createComposeRule()

    private val mocks = FakeMockApi(mockOptions(SUBJECTS))
    private val starts = FakeMockStartApi()
    private lateinit var navigator: AppNavigator

    private fun show(placement: Boolean = false) {
        rule.setContent {
            ZoonkTheme {
                val context = LocalContext.current
                val app = remember { AppContainer.preview(context) }
                val cache =
                    remember {
                        AppCache(
                            FakeSession(AuthenticatedSession("ana", "token", "local")),
                            CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate),
                        )
                    }
                navigator = rememberAppNavigator()
                MockChooser(
                    goalId = GOAL,
                    placement = placement,
                    app = app,
                    navigator = navigator,
                    mockStore = remember { MockStore(mocks, cache) },
                    starter = remember { MockStarter(starts, cache) },
                    generations = { ReadyRuns() },
                )
            }
        }
    }

    private fun scrollTo(text: String) {
        rule.onNode(hasScrollAction()).performScrollToNode(hasText(text))
    }

    @Test
    fun aPickedSubjectStartsAndOpens() {
        show()

        rule.onNodeWithText("A full exam day").assertIsSelected()
        scrollTo("Mathematics")
        rule.onNodeWithText("Mathematics").performClick()
        rule.onNodeWithText("Mathematics").assertIsSelected()
        rule.onNodeWithText("Start").performClick()
        rule.waitForIdle()

        assertEquals(listOf(MockChoice.Practice(MockShape("Mathematics", null, MockShape.Kind.AREA)) to false), starts.started)
        assertEquals(AppRoute.Mock(STARTED), navigator.currentRoute)
    }

    @Test
    fun aShortBankAsksBeforeStartingWithFewerQuestions() {
        starts.starts = listOf({ short() }, { started() })
        show()

        rule.onNodeWithText("Start").performClick()
        rule
            .onNodeWithText(
                "40 of the 90 questions are ready now, so this mock takes about 2\u00A0hr 10\u00A0min. More can be written for your mocks tomorrow.",
            ).assertIsDisplayed()
        rule.onNodeWithText("Start with 40 questions").performClick()
        rule.waitForIdle()

        assertEquals(listOf(false, true), starts.started.map { it.second })
        assertEquals(AppRoute.Mock(STARTED), navigator.currentRoute)
    }

    @Test
    fun withoutPlusTheOptionsShowLockedWithSeePlus() {
        mocks.options = mockOptions("""$SUBJECTS,"access":"plusRequired"""")
        show()

        rule.onNodeWithText("Pick how much of the exam to take now.").assertIsDisplayed()
        scrollTo("Mock exams come with Plus: whenever you want, and every week in your plan.")
        rule.onNodeWithText("See Plus").performClick()

        assertEquals(AppRoute.Subscription, navigator.currentRoute)
        assertEquals(emptyList<Pair<MockChoice, Boolean>>(), starts.started)
    }

    @Test
    fun aRunningMockIsContinuedRatherThanChosenAgain() {
        mocks.options = mockOptions(""""running":{"id":"$STARTED","purpose":"practice","shape":null}""")
        show()
        rule.waitForIdle()

        assertEquals(AppRoute.Mock(STARTED), navigator.currentRoute)
    }

    @Test
    fun thePlacementMockOffersItsLengthsWithTheRecommendedOnePicked() {
        mocks.options = mockOptions(PLACEMENT)
        show(placement = true)

        rule.onNodeWithText("About 30\u00A0min (recommended)").assertIsSelected()
        rule.onNodeWithText("A quick check. Your first days fine-tune it.").assertIsDisplayed()
        rule.onNodeWithText("About 1\u00A0hr").performClick()
        rule.onNodeWithText("Start the mock exam").performClick()
        rule.waitForIdle()

        assertEquals(listOf(MockChoice.Placement(PlacementMockOption.Length.LONG) to false), starts.started)
        assertEquals(AppRoute.Mock(STARTED), navigator.currentRoute)
    }

    @Test
    fun aFinishedPlacementMockGoesBackToOnboarding() {
        mocks.options = mockOptions(PLACEMENT.replace(""""mock":null""", """"mock":{"id":"$STARTED","status":"finished"}"""))
        show(placement = true)
        rule.waitForIdle()

        assertEquals(AppRoute.GoalSetup(GOAL.toString()), navigator.currentRoute)
    }

    @Test
    fun withoutPlusThePlacementMockPointsToTheQuickQuestions() {
        mocks.options = mockOptions("""$PLACEMENT,"access":"plusRequired"""")
        show(placement = true)

        scrollTo("Mock exams come with Plus. Without it, the quick questions find your starting point.")
        rule.onNodeWithText("See Plus").assertIsDisplayed()
    }

    private companion object {
        val SUBJECTS =
            """
            "options":[{"area":null,"day":1,"kind":"full","areas":["Languages","Mathematics"],"covers":null,"estimatedMinutes":300,"leftOut":[],
              "minutes":330,"objectiveOnly":false,"questions":90,"written":["Essay"]},
             {"area":null,"day":1,"kind":"half","areas":["Languages"],"covers":null,"estimatedMinutes":150,"leftOut":[],
              "minutes":165,"objectiveOnly":true,"questions":45,"written":[]},
             {"area":"Mathematics","day":null,"kind":"area","areas":["Mathematics"],"covers":null,"estimatedMinutes":120,"leftOut":[],
              "minutes":135,"objectiveOnly":false,"questions":45,"written":[]}]
            """.trimIndent()

        val PLACEMENT =
            """
            "placement":{"mock":null,"recommended":"medium","options":[
             {"areas":["Languages","Mathematics"],"coversAllAreas":true,"estimatedMinutes":15,"length":"short","minutes":20,"questions":12},
             {"areas":["Languages","Mathematics"],"coversAllAreas":true,"estimatedMinutes":30,"length":"medium","minutes":40,"questions":24},
             {"areas":["Languages","Mathematics"],"coversAllAreas":true,"estimatedMinutes":60,"length":"long","minutes":80,"questions":48}]}
            """.trimIndent()
    }
}
