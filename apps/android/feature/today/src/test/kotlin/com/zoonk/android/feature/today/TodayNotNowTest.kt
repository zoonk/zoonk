package com.zoonk.android.feature.today

import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.FakeSession
import com.zoonk.android.feature.focustest.unusedFocusTests
import com.zoonk.android.feature.plan.FakePlanApi
import com.zoonk.android.feature.plan.PlanStore
import com.zoonk.android.feature.session.FakeStudyApi
import com.zoonk.android.feature.session.StudyOpener
import com.zoonk.android.feature.session.day
import com.zoonk.android.feature.session.decodeFixture
import com.zoonk.android.feature.session.fixture
import com.zoonk.android.ui.components.SuggestionLayout
import com.zoonk.android.ui.theme.ZoonkTheme
import com.zoonk.api.models.PlanChangeDecisionInput
import com.zoonk.api.models.Today
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

/** "Not now" on Today's cards answers in place, without opening the sheet. */
@RunWith(AndroidJUnit4::class)
class TodayNotNowTest {
    @get:Rule
    val rule = createComposeRule()

    private val plans = FakePlanApi()
    private val todayApi = FakeTodayApi(emptyList())

    @Test
    fun notNowOnAPlanChangeDeclinesIt() {
        val today =
            decodeFixture<Today>(
                "today",
                "notice" to "planChange",
                "planChange" to fixture("plan-change", "source" to "insight", "canApply" to true),
            )
        show(today)

        rule.onNodeWithText("Not now").performClick()
        rule.waitForIdle()

        assertEquals(listOf(PlanChangeDecisionInput.Status.DECLINED), plans.decisions)
        rule.onNodeWithText("Your plan stays as it was.").assertExists()
    }

    @Test
    fun notNowOnAScheduleIdeaKeepsTheStudyTime() {
        val today =
            decodeFixture<Today>(
                "today",
                "notice" to "insight",
                "insight" to fixture("memory-insight", "kind" to "scheduleIdea", "studyTime" to "7 PM"),
            )
        show(today)

        rule.onNodeWithText("Not now").performClick()
        rule.waitForIdle()

        assertEquals(1, todayApi.insightQuotes.size)
        rule.onNodeWithText("Your study time stays the same.").assertExists()
    }

    private fun show(today: Today) {
        val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)
        val cache = AppCache(FakeSession(AuthenticatedSession("ana", "token-a", "local-a")), scope)
        val study = FakeStudyApi()
        val viewModel =
            TodayViewModel(
                StudyOpener(study, study::writeLesson, cache, timeZone = { "UTC" }),
                TodayStore(todayApi, cache, scope, timeZone = { "UTC" }),
                PlanStore(plans, cache),
                unusedFocusTests(cache),
            )
        val state = TodayNoticeState(TodayRead.Day(today, day()), settled = true, viewModel = viewModel, navigate = {})

        rule.setContent { ZoonkTheme { TodayNotice(state, SuggestionLayout.Line) } }
        rule.waitForIdle()
    }
}
