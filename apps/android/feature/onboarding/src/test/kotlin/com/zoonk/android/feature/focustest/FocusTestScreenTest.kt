package com.zoonk.android.feature.focustest

import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.semantics.SemanticsActions
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
    private val session = FakeSession(ana)
    private val cache = AppCache(session, CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate))
    private val background = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val api =
        FakeOnboardingApi().apply {
            placement =
                placementOf(
                    next = typedQuestion(),
                    answered = 1,
                    started = true,
                    focusTest = focusTestOf(sitting = focusSittingOf(answered = 1), offer = null),
                )
        }
    private var screen by mutableIntStateOf(0)
    private var drafts by mutableStateOf<SetupDrafts?>(null)

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

    private fun draftStore() =
        DraftStore(folder.newFolder(), background, debounce = Duration.ZERO).also {
            runBlocking { it.follow { DraftsChange(next = ana.accountId) } }
        }

    // Blocking the main thread to read it could deadlock with the screen's own read, which resumes there.
    private fun SetupDrafts.typedAnswer() = words(GOAL_ID, typedDraftStep(ITEM_ID)).value.stateIn(background, SharingStarted.Eagerly, null)

    private fun showTestFromThePlan() {
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
    }

    private fun typeTheAnswer() {
        rule.onNodeWithText("Continue").performScrollTo().performClick()
        rule.onNode(hasSetTextAction()).performTextInput(ANSWER)
    }

    @Test
    fun anUnsentAnswerOnATestOpenedFromThePlanComesBackWhenTheScreenIsRebuiltAndGoesOnceItSaves() {
        val saved = SetupDrafts(draftStore(), ana, session).also { drafts = it }.typedAnswer()
        showTestFromThePlan()

        typeTheAnswer()
        rule.waitUntil(5_000) { saved.value == listOf(ANSWER) }
        screen++

        rule.onNodeWithText(ANSWER).assertIsDisplayed()
        rule.onNodeWithText("Confirm").performClick()
        rule.waitUntil(5_000) { api.placementAnswers.size == 1 && saved.value == null }
    }

    @Test
    fun aGuestsAnswerSentAsTheySignInGoesFromTheAccountItsWordsMovedInto() {
        val store = draftStore()
        val typed = SetupDrafts(store, ana, session).also { drafts = it }.typedAnswer()
        showTestFromThePlan()
        typeTheAnswer()
        rule.waitUntil(5_000) { typed.value == listOf(ANSWER) }
        val confirm =
            checkNotNull(
                rule
                    .onNodeWithText("Confirm")
                    .fetchSemanticsNode()
                    .config[SemanticsActions.OnClick]
                    .action,
            )

        val account = AuthenticatedSession("registered", "token-b", "local-b")
        runBlocking { store.follow { DraftsChange(next = account.accountId, moveFrom = ana.accountId) } }
        val accountDrafts = SetupDrafts(store, account, session)
        val moved = accountDrafts.typedAnswer()
        rule.waitUntil(5_000) { moved.value == listOf(ANSWER) }

        // Sent in the turn the session changes, before the screen recomposes with the account's drafts.
        rule.runOnIdle {
            session.session = account
            cache.followSession()
            drafts = accountDrafts
            confirm()
        }
        rule.waitUntil(5_000) { api.placementAnswers.size == 1 }
        rule.waitUntil(5_000) { moved.value == null }
    }
}

private const val ANSWER = "Testimony about what someone else said"
