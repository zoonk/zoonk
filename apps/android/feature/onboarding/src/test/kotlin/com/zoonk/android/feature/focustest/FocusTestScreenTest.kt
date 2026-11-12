package com.zoonk.android.feature.focustest

import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.hasSetTextAction
import androidx.compose.ui.test.junit4.ComposeContentTestRule
import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.test.performTextInput
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.DraftStore
import com.zoonk.android.data.DraftsChange
import com.zoonk.android.data.FakeSession
import com.zoonk.android.data.LearnerSummaryStore
import com.zoonk.android.data.SignInResult
import com.zoonk.android.data.summary
import com.zoonk.android.feature.onboarding.FakeOnboardingApi
import com.zoonk.android.feature.onboarding.GOAL_ID
import com.zoonk.android.feature.onboarding.ITEM_ID
import com.zoonk.android.feature.onboarding.OnboardingStore
import com.zoonk.android.feature.onboarding.focusSittingOf
import com.zoonk.android.feature.onboarding.focusTestOf
import com.zoonk.android.feature.onboarding.placementOf
import com.zoonk.android.feature.onboarding.setup.SetupDrafts
import com.zoonk.android.feature.onboarding.setup.typedDraftStep
import com.zoonk.android.feature.onboarding.typedQuestion
import com.zoonk.android.feature.plan.FakePlanApi
import com.zoonk.android.feature.plan.PlanStore
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.navigation.rememberAppNavigator
import com.zoonk.android.ui.theme.ZoonkTheme
import com.zoonk.api.models.LearnerSummaryGoal
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.runBlocking
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import org.junit.runner.RunWith
import org.robolectric.annotation.Config
import java.util.UUID
import kotlin.time.Duration

@RunWith(AndroidJUnit4::class)
@Config(qualifiers = "w411dp-h891dp")
class FocusTestScreenTest {
    @get:Rule
    val rule: ComposeContentTestRule = createComposeRule()

    @get:Rule
    val folder = TemporaryFolder()

    private val ana = AuthenticatedSession("ana", "token-a", "local-a")
    private var screen by mutableIntStateOf(0)

    private val examGoal =
        LearnerSummaryGoal(
            courseChapterId = null,
            courseId = null,
            courseLevel = null,
            dailyMinutes = 20,
            id = UUID.fromString(GOAL_ID),
            isActive = true,
            isSettingUp = false,
            kind = LearnerSummaryGoal.Kind.EXAM,
            languageFlag = null,
            regionChoices = emptyList(),
            status = LearnerSummaryGoal.Status.ACTIVE,
            targetDate = null,
            targetLanguage = null,
            targetRegion = null,
            title = "DELE B2",
            displayName = "DELE B2",
        )

    @Test
    fun anUnsentAnswerOnATestOpenedFromThePlanComesBackWhenTheScreenIsRebuiltAndGoesOnceItSaves() {
        val background = CoroutineScope(SupervisorJob() + Dispatchers.IO)
        val draftStore = DraftStore(folder.newFolder(), background, debounce = Duration.ZERO)
        runBlocking { draftStore.follow { DraftsChange(next = ana.accountId) } }
        val drafts = SetupDrafts(draftStore, ana)
        // Blocking the main thread to read it could deadlock with the screen's own read, which resumes there.
        val saved = drafts.words(GOAL_ID, typedDraftStep(ITEM_ID)).value.stateIn(background, SharingStarted.Eagerly, null)
        val api =
            FakeOnboardingApi().apply {
                placement =
                    placementOf(
                        next = typedQuestion(),
                        answered = 1,
                        started = true,
                        focusTest = focusTestOf(sitting = focusSittingOf(answered = 1), offer = null),
                    )
            }
        val session = FakeSession(ana)
        val cache = AppCache(session, CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate))
        val summaries = LearnerSummaryStore({ summary(0, Long.MAX_VALUE).copy(goals = listOf(examGoal)) }, cache, background)
        val store = OnboardingStore(api, cache, session) { SignInResult.SignedIn }
        val plans = PlanStore(FakePlanApi(), cache)
        rule.setContent {
            ZoonkTheme {
                key(screen) {
                    FocusTestScreen(AppRoute.FocusTest(GOAL_ID), summaries.summary, store, plans, drafts, rememberAppNavigator())
                }
            }
        }

        rule.onNodeWithText("Continue").performScrollTo().performClick()
        rule.onNode(hasSetTextAction()).performTextInput("Testimony about what someone else said")
        rule.waitUntil(5_000) { saved.value == listOf("Testimony about what someone else said") }
        screen++

        rule.onNodeWithText("Testimony about what someone else said").assertIsDisplayed()
        rule.onNodeWithText("Confirm").performClick()
        rule.waitUntil(5_000) { api.placementAnswers.size == 1 && saved.value == null }
    }
}
