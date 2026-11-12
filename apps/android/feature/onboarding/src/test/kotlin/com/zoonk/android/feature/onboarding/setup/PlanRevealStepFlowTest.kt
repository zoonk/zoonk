package com.zoonk.android.feature.onboarding.setup

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.ProgressBarRangeInfo
import androidx.compose.ui.test.assertCountEquals
import androidx.compose.ui.test.assertHasClickAction
import androidx.compose.ui.test.assertHasNoClickAction
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.hasProgressBarRangeInfo
import androidx.compose.ui.test.junit4.ComposeContentTestRule
import androidx.compose.ui.test.junit4.StateRestorationTester
import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.lifecycle.SavedStateHandle
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.data.ApiError
import com.zoonk.android.data.ApiException
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.FakeSession
import com.zoonk.android.data.GenerationFirstLesson
import com.zoonk.android.data.GenerationRun
import com.zoonk.android.data.MutationResult
import com.zoonk.android.data.SignInResult
import com.zoonk.android.feature.onboarding.FakeOnboardingApi
import com.zoonk.android.feature.onboarding.GOAL_ID
import com.zoonk.android.feature.onboarding.OnboardingApi
import com.zoonk.android.feature.onboarding.OnboardingStore
import com.zoonk.android.feature.onboarding.examGoal
import com.zoonk.android.feature.onboarding.planOf
import com.zoonk.android.feature.onboarding.revealTodayOf
import com.zoonk.android.feature.onboarding.syllabusOf
import com.zoonk.android.feature.plan.FakePlanApi
import com.zoonk.android.feature.plan.PlanStore
import com.zoonk.android.feature.session.DayStep
import com.zoonk.android.feature.session.DayView
import com.zoonk.android.feature.session.toDayView
import com.zoonk.android.feature.warmup.WARM_UP_ID
import com.zoonk.android.feature.warmup.WarmUpStore
import com.zoonk.android.feature.warmup.beekeepingDeck
import com.zoonk.android.navigation.AppNavigator
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.navigation.AppTab
import com.zoonk.android.navigation.rememberAppNavigator
import com.zoonk.android.ui.theme.ZoonkTheme
import com.zoonk.api.ApiJson
import com.zoonk.api.models.PlanRevealToday
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.decodeFromJsonElement
import kotlinx.serialization.json.encodeToJsonElement
import kotlinx.serialization.json.jsonObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.annotation.Config

@RunWith(AndroidJUnit4::class)
@Config(qualifiers = "w411dp-h891dp")
class PlanRevealStepFlowTest {
    @get:Rule
    val rule: ComposeContentTestRule = createComposeRule()

    private val planApi =
        FakePlanApi().apply {
            shownPlan = planOf()
            shownSyllabus = syllabusOf(emptyList(), kind = "modules")
        }
    private lateinit var navigator: AppNavigator

    private fun show(
        prepareToday: suspend () -> Unit = {},
        restoration: StateRestorationTester? = null,
        reveal: PlanRevealToday? = null,
        onOpenStep: ((DayView, DayStep) -> Unit)? = null,
        readReveal: (suspend () -> PlanRevealToday)? = null,
        mark: suspend () -> Unit = {},
        open: (suspend (DayView, DayStep) -> MutationResult<AppRoute?>)? = null,
    ) {
        val session = FakeSession(AuthenticatedSession("ana", "token-a", "local-a"))
        val cache = AppCache(session, CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate))
        val plans = PlanStore(planApi, cache)
        val onboarding =
            OnboardingStore(
                object : OnboardingApi by FakeOnboardingApi() {
                    override suspend fun revealToday(
                        session: AuthenticatedSession,
                        goalId: String,
                    ) = readReveal?.invoke() ?: requireNotNull(reveal)

                    override suspend fun markPlanRevealed(
                        session: AuthenticatedSession,
                        goalId: String,
                    ) = mark()
                },
                cache,
                session,
            ) { SignInResult.SignedIn }
        val vm = GoalSetupViewModel(onboarding, null, SavedStateHandle(), GOAL_ID)
        val warmUps = WarmUpStore({ _, _ -> beekeepingDeck() }, cache, session)
        val setContent: (@Composable () -> Unit) -> Unit = restoration?.let { it::setContent } ?: rule::setContent
        setContent {
            ZoonkTheme {
                navigator = rememberAppNavigator()
                CompositionLocalProvider(LocalSetupWarmUp provides warmUps) {
                    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState())) {
                        PlanRevealStep(
                            examGoal(),
                            isGuest = false,
                            GenerationRun(status = GenerationRun.Status.Following, warmUpId = WARM_UP_ID),
                            onRetryRun = null,
                            plans,
                            navigator,
                            SETUP,
                            prepareToday,
                            onReveal = vm::reveal,
                            saving = vm.isSaving,
                            saveFailed = vm.saveFailed,
                            startStepFailed = vm.startStepFailed,
                            openingStep = vm.openingStep,
                            failedStep = vm.failedStep,
                            onOpenStep =
                                if (open != null) {
                                    { day, step, fromStart ->
                                        vm.openRevealStep(day, step, { d, s, _ -> open(d, s) }, fromStart = fromStart) {}
                                    }
                                } else {
                                    onOpenStep?.let { callback -> { day, step, _ -> callback(day, step) } }
                                },
                            today = if (reveal != null || readReveal != null) onboarding.revealToday[GOAL_ID] else null,
                        )
                    }
                }
            }
        }
    }

    @Test
    fun returningToAnAutomaticallyOpenedFirstLessonKeepsTheWaitOpen() {
        val restoration = StateRestorationTester(rule)
        var opened = 0
        restoration.setContent {
            ZoonkTheme {
                CompositionLocalProvider(
                    LocalSetupWait provides
                        SetupWaitContext(
                            firstLesson = GenerationFirstLesson("lesson-1", "Dawn songs", ready = true),
                            onStartLesson = { opened++ },
                        ),
                ) {
                    SetupColumn {
                        PlanBuilding(GenerationRun(status = GenerationRun.Status.Following), null, next = PlanNext.TimeQuestion)
                    }
                }
            }
        }
        rule.waitForIdle()
        assertEquals(1, opened)
        restoration.emulateSavedInstanceStateRestore()
        rule.waitForIdle()
        assertEquals(1, opened)
        rule.onNodeWithText("Start lesson 1").assertExists()
    }

    @Test
    fun startOpensTheTaggedStepThroughTheRowCallback() {
        val reveal = revealWithNextPosition(1)
        var opened: Pair<DayView, DayStep>? = null
        show(reveal = reveal, onOpenStep = { day, step -> opened = day to step })
        navigator.open(SETUP)

        rule.onNodeWithText("Start").performScrollTo().performClick()
        rule.waitForIdle()

        val day = reveal.today.toDayView()
        assertEquals(day to day.steps.first { it.position == day.nextPosition }, opened)
        assertEquals(SETUP, navigator.currentRoute)
    }

    @Test
    fun onlyStartIsBusyWhileItOpensTheTaggedStep() {
        val opened = CompletableDeferred<MutationResult<AppRoute?>>()
        val reveal = revealWithNextPosition(0)
        show(reveal = reveal, open = { _, _ -> opened.await() })
        rule.onNodeWithText("Start").performScrollTo().performClick()
        rule.onNodeWithText("Start").assertIsNotEnabled()
        rule.onAllNodes(hasProgressBarRangeInfo(ProgressBarRangeInfo.Indeterminate)).assertCountEquals(1)
        val title = "How birds use sound"
        rule.onNodeWithText(title).performScrollTo().assertHasNoClickAction()
        opened.complete(MutationResult.Done(null))
    }

    @Test
    fun openingRowKeepsItsClickActionWhileStartIsDisabled() {
        val opened = CompletableDeferred<MutationResult<AppRoute?>>()
        val reveal = revealWithNextPosition(0)
        show(reveal = reveal, open = { _, _ -> opened.await() })
        val title = "How birds use sound"
        rule
            .onNodeWithText(title)
            .performScrollTo()
            .performClick()
            .assertHasClickAction()
        rule.onAllNodes(hasProgressBarRangeInfo(ProgressBarRangeInfo.Indeterminate)).assertCountEquals(1)
        rule.onNodeWithText("Start").performScrollTo().assertIsNotEnabled()
        opened.complete(MutationResult.Done(null))
    }

    @Test
    fun startShowsSaveFailureBeforeOpenFailureAndNeverDuplicatesItOnTheRow() {
        var markFails = true
        var opens = 0
        show(reveal = revealWithNextPosition(1), mark = {
            if (markFails) throw ApiException(ApiError.Network)
        }, open = { _, _ ->
            opens++
            MutationResult.Failed(ApiError.Network)
        })
        rule.onNodeWithText("Start").performScrollTo().performClick()
        rule.onNodeWithText("We couldn't save that. Try again.").assertExists()
        rule.onNodeWithText("We couldn't open this step. Try again.").assertDoesNotExist()
        assertEquals(0, opens)
        markFails = false
        rule.onNodeWithText("Start").performClick()
        rule.onNodeWithText("We couldn't save that. Try again.").assertDoesNotExist()
        rule.onAllNodesWithText("We couldn't open this step. Try again.").assertCountEquals(1)
        assertEquals(1, opens)
    }

    @Test
    fun startIsNotActionableUntilTheRevealTodayReadSettles() {
        val loaded = CompletableDeferred<PlanRevealToday>()
        var opened = false
        show(readReveal = { loaded.await() }, onOpenStep = { _, _ -> opened = true })
        navigator.open(SETUP)
        rule
            .onNodeWithText("Start")
            .performScrollTo()
            .assertIsNotEnabled()
            .performClick()
        assertEquals(SETUP, navigator.currentRoute)
        loaded.complete(revealWithNextPosition(1))
        rule.waitUntil { rule.onAllNodesWithText("Start here").fetchSemanticsNodes().isNotEmpty() }
        rule.onNodeWithText("Start").performScrollTo().performClick()
        rule.runOnIdle { assertEquals(true, opened) }
        assertEquals(SETUP, navigator.currentRoute)
    }

    @Test
    fun aFailedRevealTodayReadAllowsTheTodayFallbackAndShowsSaveFailure() {
        show(readReveal = { throw ApiException(ApiError.Network) }, mark = { throw ApiException(ApiError.Network) })
        navigator.open(SETUP)
        rule.onNodeWithText("Start").performScrollTo().performClick()
        rule.onNodeWithText("We couldn't save that. Try again.").assertExists()
        rule.onNodeWithText("We couldn't open this step. Try again.").assertDoesNotExist()
        assertEquals(SETUP, navigator.currentRoute)
    }

    @Test
    fun startFallsBackToTodayWhenThereIsNoNextStep() {
        show(reveal = revealWithNextPosition(null), onOpenStep = { _, _ -> error("Must not open a step") })
        navigator.open(SETUP)

        rule.onNodeWithText("Start").performScrollTo().performClick()
        rule.waitForIdle()

        assertEquals(AppRoute.Today, navigator.currentRoute)
    }

    private fun revealWithNextPosition(position: Long?): PlanRevealToday {
        val reveal = ApiJson.encodeToJsonElement(revealTodayOf()).jsonObject
        val today = reveal.getValue("today").jsonObject
        return ApiJson.decodeFromJsonElement(
            JsonObject(reveal + ("today" to JsonObject(today + ("nextPosition" to (position?.let(::JsonPrimitive) ?: JsonNull))))),
        )
    }

    @Test
    fun startWaitsForTodayAndShowsItIsWorkingWhileTodayLoads() {
        val today = CompletableDeferred<Unit>()
        show(prepareToday = { today.await() })
        navigator.select(AppTab.Plan)
        navigator.open(SETUP)

        rule.onNodeWithText("Start").performScrollTo().performClick()
        rule.mainClock.advanceTimeBy(500)

        assertNotEquals(AppRoute.Today, navigator.currentRoute)
        rule.onNodeWithText("Start").assertIsNotEnabled()
        rule.onNode(hasProgressBarRangeInfo(ProgressBarRangeInfo.Indeterminate)).assertIsDisplayed()

        today.complete(Unit)
        rule.waitForIdle()

        assertEquals(AppRoute.Today, navigator.currentRoute)
    }

    @Test
    fun aStartStillWaitingOnTodayOpensItAfterTheScreenIsRebuilt() {
        val today = CompletableDeferred<Unit>()
        val restoration = StateRestorationTester(rule)
        show(prepareToday = { today.await() }, restoration = restoration)
        navigator.select(AppTab.Plan)
        navigator.open(SETUP)

        rule.onNodeWithText("Start").performScrollTo().performClick()
        rule.mainClock.advanceTimeBy(100)
        restoration.emulateSavedInstanceStateRestore()
        today.complete(Unit)
        rule.waitForIdle()

        assertEquals(AppRoute.Today, navigator.currentRoute)
    }

    @Test
    fun goingBackWhileTodayLoadsKeepsTheLearnerWhereBackWent() {
        val today = CompletableDeferred<Unit>()
        show(prepareToday = { today.await() })
        navigator.select(AppTab.Plan)
        navigator.open(SETUP)

        rule.onNodeWithText("Start").performScrollTo().performClick()
        navigator.back()
        today.complete(Unit)
        rule.waitForIdle()

        assertEquals(AppRoute.Plan(), navigator.currentRoute)
    }

    @Test
    fun aPlanStillBeingBuiltShowsItsWaitUntilARead() {
        planApi.shownPlan = planOf(ready = false)
        show()

        rule.onNodeWithText("Building your plan").assertIsDisplayed()
        planApi.shownPlan = planOf()
        rule.mainClock.advanceTimeBy(POLL_MILLIS)

        rule.onNodeWithText("Plan created").assertIsDisplayed()
    }

    @Test
    fun anExamsDocumentsKeepBeingWaitedForPastTenMinutes() {
        planApi.shownPlan = planOf(notice = "reading")
        show()
        rule.mainClock.advanceTimeBy(ELEVEN_MINUTES)

        planApi.shownPlan = planOf()
        rule.mainClock.advanceTimeBy(POLL_MILLIS)

        rule.onNodeWithText("Plan created").assertIsDisplayed()
    }

    @Test
    fun aGuessWhileThePlanIsBuiltDoesntHoldItOnceItsDocumentsAreRead() {
        planApi.shownPlan = planOf(ready = false)
        show()
        rule.onNodeWithText("To put the bees to sleep").performScrollTo().performClick()
        planApi.shownPlan = planOf(notice = "reading")
        rule.mainClock.advanceTimeBy(POLL_MILLIS)

        rule.onNodeWithText("Reading the exam's official documents").assertIsDisplayed()
        rule.onNodeWithText("Your plan is ready").assertDoesNotExist()

        planApi.shownPlan = planOf()
        rule.mainClock.advanceTimeBy(POLL_MILLIS)

        rule.onNodeWithText("Plan created").assertIsDisplayed()
    }

    @Test
    fun aGuessWhileTheDocumentsAreReadKeepsItsAnswerThroughALostConnectionAndHoldsThePlan() {
        planApi.shownPlan = planOf(notice = "reading")
        show()
        rule.onNodeWithText("To put the bees to sleep").performScrollTo().performClick()
        planApi.planFailure = ApiException(ApiError.Network)
        rule.mainClock.advanceTimeBy(POLL_MILLIS * 3)

        rule.onNodeWithText("Connection lost").assertIsDisplayed()
        rule.onNodeWithText("Here's the answer").assertExists()

        planApi.planFailure = null
        planApi.shownPlan = planOf()
        rule.onNodeWithText("Reconnect").performScrollTo().performClick()
        rule.mainClock.advanceTimeBy(POLL_MILLIS)

        rule.onNodeWithText("Your plan is ready").assertIsDisplayed()
        rule.onNodeWithText("Here's the answer").assertExists()
        rule.onNodeWithText("Next guess").assertDoesNotExist()
        rule.onNodeWithText("Plan created").assertDoesNotExist()
    }

    @Test
    fun readsThatKeepFailingWhileTheDocumentsAreReadOfferToReconnect() {
        planApi.shownPlan = planOf(notice = "reading")
        show()
        rule.onNodeWithText("Reading the exam's official documents").assertIsDisplayed()

        planApi.planFailure = ApiException(ApiError.Network)
        rule.mainClock.advanceTimeBy(POLL_MILLIS * 3)
        rule.onNodeWithText("Connection lost").assertIsDisplayed()
        planApi.planFailure = null
        planApi.shownPlan = planOf()
        rule.onNodeWithText("Reconnect").performScrollTo().performClick()
        // The plan shows once a second passes after that tap, so a second tap can't land on it.
        rule.mainClock.advanceTimeBy(1_100)

        rule.onNodeWithText("Plan created").assertIsDisplayed()
    }

    private companion object {
        const val POLL_MILLIS = 3_500L
        const val ELEVEN_MINUTES = 11 * 60_000L
        val SETUP = AppRoute.GoalSetup(GOAL_ID)
    }
}
