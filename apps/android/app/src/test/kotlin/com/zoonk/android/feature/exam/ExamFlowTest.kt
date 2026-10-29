package com.zoonk.android.feature.exam

import androidx.compose.runtime.remember
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsEnabled
import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.hasContentDescription
import androidx.compose.ui.test.hasScrollAction
import androidx.compose.ui.test.hasSetTextAction
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.junit4.ComposeContentTestRule
import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollToNode
import androidx.compose.ui.test.performTextInput
import androidx.compose.ui.test.performTextReplacement
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.app.AppContainer
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.FakeSession
import com.zoonk.android.feature.mock.MockStore
import com.zoonk.android.feature.plan.FakePlanApi
import com.zoonk.android.feature.plan.PlanOp
import com.zoonk.android.feature.plan.PlanStore
import com.zoonk.android.navigation.AppNavigator
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.navigation.rememberAppNavigator
import com.zoonk.android.ui.theme.ZoonkTheme
import com.zoonk.api.models.ExamResult
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.annotation.Config
import java.time.LocalDate

@RunWith(AndroidJUnit4::class)
@Config(qualifiers = "w411dp-h891dp")
class ExamFlowTest {
    @get:Rule
    val rule: ComposeContentTestRule = createComposeRule()

    private val api = FakeExamApi()
    private val mocks = FakeMockApi()
    private val plans = FakePlanApi()
    private lateinit var navigator: AppNavigator

    private fun show() {
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
                GoalExam(
                    goalId = GOAL,
                    app = app,
                    navigator = navigator,
                    exams = remember { ExamStore(api, cache) { "UTC" } },
                    mockStore = remember { MockStore(mocks, cache) },
                    plans = remember { PlanStore(plans, cache) },
                )
            }
        }
    }

    private fun scrollTo(text: String) {
        rule.onNode(hasScrollAction()).performScrollToNode(hasText(text))
    }

    @Test
    fun theHeroCountsTheDaysAndTakesAMock() {
        show()

        rule.onNodeWithText("Exam · 10 days left").assertIsDisplayed()
        rule.onNodeWithText("Take a mock exam").performClick()

        assertEquals(AppRoute.MockChooser, navigator.currentRoute)
    }

    @Test
    fun aRunningMockIsContinuedRatherThanAnotherTaken() {
        mocks.options = mockOptions(""""running":{"id":"$BLOCK","purpose":"practice","shape":null}""")
        show()

        rule.onNodeWithText("Continue your mock exam").performClick()

        assertEquals(AppRoute.Mock(BLOCK), navigator.currentRoute)
    }

    @Test
    fun aFreeLearnerSeesTheWeeksMockLockedWithPlus() {
        api.exam =
            exam(""""mocksRequirePlus":true,"nextMock":{"date":"2026-11-01","fullLength":true,"planItemId":"$PLAN_ITEM","questions":90}""")
        mocks.options = mockOptions(""""access":"plusRequired"""")
        show()

        scrollTo("Mock exams come with Plus: whenever you want, every week in your plan, and your progress over time.")
        rule.onNodeWithText("A full exam day").performClick()

        assertEquals(AppRoute.Challenge(PLAN_ITEM), navigator.currentRoute)
    }

    @Test
    fun aTakenMockOpensItsResult() {
        api.exam =
            exam(
                """"mocks":[{"blockId":"$BLOCK","correct":41,"examQuestions":null,"finishedAt":"2026-10-20T15:00:00Z","measure":41,
                "number":1,"purpose":"practice","scoring":"raw","shape":{"area":null,"day":1,"kind":"full"},"total":90}]""",
            )
        show()

        scrollTo("41 of 90 right")
        rule.onNodeWithText("Mock exam 1").performClick()

        assertEquals(AppRoute.Mock(BLOCK), navigator.currentRoute)
    }

    @Test
    fun theChartNamesTheFirstAndLatestScores() {
        api.exam =
            exam(
                """"progress":{"improved":["Math"],"needsWork":[],"subjects":[{"change":12,"name":"Math","percents":[40,52]}],
                "mocks":[{"finishedAt":"2026-10-01T15:00:00Z","number":1,"percent":40,"purpose":"practice","shape":null},
                {"finishedAt":"2026-10-20T15:00:00Z","number":2,"percent":55,"purpose":"practice","shape":null}]}""",
            )
        show()

        scrollTo("Better in Math.")
        rule.onNode(hasContentDescription("Your mock exam scores, from 40% to 55%")).assertExists()
    }

    @Test
    fun afterTheExamTheResultSavesOnTheExamsOwnScale() {
        api.exam =
            exam(
                """"stage":"afterExam","scoring":{"method":"raw","note":null,"noticeScale":null,"rule":"raw","scale":"sat","stated":true,"wrongPenalty":0}""",
            )
        show()

        val field = rule.onNode(hasSetTextAction() and hasText("Your total score (400 to 1600)"))
        field.performTextInput("1405")
        rule.onNodeWithText("Scores go from 400 to 1,600 in steps of 10.").assertIsDisplayed()
        rule.onNodeWithText("Save my result").assertIsNotEnabled()

        field.performTextReplacement("1410")
        rule.onNodeWithText("Save my result").assertIsEnabled().performClick()

        rule.onNodeWithText("Result saved: 1,410. Thank you for telling us.").assertIsDisplayed()
        assertEquals(listOf(ExamResultReport(score = 1410.0, scale = ExamResult.Scale.SAT, maxScore = null, passed = null)), api.reports)
    }

    @Test
    fun theNoticesDateBecomesThePlansDate() {
        api.exam = exam(""""noticeDay":{"date":"2026-11-15","estimated":false}""")
        show()

        rule.onNodeWithText("Use this date").performClick()
        rule.waitForIdle()

        assertEquals(listOf(listOf(PlanOp.TargetDate(LocalDate.of(2026, 11, 15)))), plans.changes)
    }

    @Test
    fun aGoalThatIsntAnExamIsNotFound() {
        api.exam = null
        show()

        rule.onNodeWithText("We couldn't find this page").assertIsDisplayed()
    }
}
