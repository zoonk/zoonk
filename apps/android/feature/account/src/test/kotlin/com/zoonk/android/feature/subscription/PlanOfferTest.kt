package com.zoonk.android.feature.subscription

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsSelected
import androidx.compose.ui.test.getBoundsInRoot
import androidx.compose.ui.test.hasClickAction
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.isHeading
import androidx.compose.ui.test.junit4.ComposeContentTestRule
import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.compose.ui.test.onParent
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.unit.DpRect
import androidx.compose.ui.unit.dp
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.data.LoadState
import com.zoonk.android.navigation.AppNavigator
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.navigation.rememberAppNavigator
import com.zoonk.android.ui.theme.ZoonkTheme
import com.zoonk.api.models.AllowanceItem
import com.zoonk.api.models.FreePlan
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config

@RunWith(AndroidJUnit4::class)
@Config(qualifiers = "w411dp-h891dp")
class PlanOfferTest {
    @get:Rule
    val rule: ComposeContentTestRule = createComposeRule()

    private lateinit var navigator: AppNavigator

    private val limits =
        FreePlan(
            activeGoals = 1,
            examPrepDays = 7,
            guestLessons = 3,
            lessonsPerDay = 5,
            lessonsPerMonth = 40,
            tutorMessagesPerDay = 10,
            uploadsPerDay = 1,
        )

    private val offers =
        PlusOffers(
            PlusOffer(BillingPeriod.Monthly, "monthly-token", "$5.00", 5_000_000, "USD"),
            PlusOffer(BillingPeriod.Yearly, "yearly-token", "$40.00", 40_000_000, "USD"),
            product = Unit,
        )

    private val messages =
        AllowanceItem(
            dailyLimit = 10,
            fairUseDailyLimit = null,
            kind = AllowanceItem.Kind.TUTOR_MESSAGE,
            monthlyLimit = null,
            remaining = 7,
            totalLimit = null,
            usedThisMonth = 3,
            usedToday = 3,
            usedTotal = 3,
        )

    @Test
    fun aFreeLearnerSeesTheirPlanAndTodaysMessagesBesidePlus() {
        show(PlanViewer.Free, messagesUsed = messages)

        rule.onNode(hasText("Your current plan")).assertIsDisplayed()
        rule.onNode(hasText("3/10 buddy messages used today")).assertIsDisplayed()
        rule.onNode(hasText("Subscribe") and hasClickAction()).assertIsDisplayed()
        rule.onNode(hasText("No card needed.")).assertDoesNotExist()
        rule.onNode(hasText("Your plan")).assertDoesNotExist()
    }

    @Test
    fun aGuestCreatesAFreeAccountFromTheFreeCard() {
        show(PlanViewer.Guest)

        rule.onNode(hasText("No card needed.")).assertIsDisplayed()
        rule.onNode(hasText("Create a free account") and hasClickAction()).performClick()

        assertEquals(AppRoute.Login, navigator.currentRoute)
    }

    @Test
    fun aVisitorStartsFreeFromTheFreeCard() {
        show(PlanViewer.Visitor)
        rule.runOnIdle { navigator.open(AppRoute.Subscription) }

        rule.onNode(hasText("Start free") and hasClickAction()).performClick()

        assertEquals(AppRoute.Today, navigator.currentRoute)
    }

    @Test
    fun onAPhoneFreeSitsUnderPlus() {
        show(PlanViewer.Free)

        assertTrue(card("Free").top >= card("Plus").bottom)
    }

    @Test
    @Config(qualifiers = "w1280dp-h800dp")
    fun onAWideWindowThePlansSitSideBySideAtOneSizeWithTheQuestionsInTheirColumns() {
        show(PlanViewer.Free)

        val plus = card("Plus")
        val free = card("Free")
        assertEquals(plus.top, free.top)
        assertTrue(free.left > plus.right)
        assertEquals((plus.right - plus.left).value, (free.right - free.left).value, 0.5f)
        assertEquals(plus.bottom, free.bottom)
        val lastBenefit = rule.onNode(hasText("Higher limits for speaking calls")).getBoundsInRoot()
        assertEquals((lastBenefit.bottom + 16.dp).value, plus.bottom.value, 1f)

        val heading = rule.onNode(hasText("Common questions") and isHeading()).getBoundsInRoot()
        val question = rule.onNode(hasText("What's in the free plan?") and hasClickAction()).getBoundsInRoot()
        assertEquals(plus.left.value, heading.left.value, 0.5f)
        assertEquals(free.left.value, question.left.value, 0.5f)
    }

    @Test
    @Config(qualifiers = "w1600dp-h1000dp")
    fun largerTextStacksThePlansWhereTheyWouldBeTooNarrow() {
        RuntimeEnvironment.setFontScale(2f)
        show(PlanViewer.Free)

        assertTrue(card("Free").top >= card("Plus").bottom)
    }

    @Test
    @Config(qualifiers = "w1280dp-h800dp")
    fun theChosenPeriodAndOpenAnswersSurviveAResize() {
        var width by mutableStateOf(411.dp)
        show(PlanViewer.Free) { content -> Box(Modifier.width(width)) { content() } }

        rule.onNode(hasText("Yearly", substring = true) and hasClickAction()).performClick()
        rule.onNode(hasText("What's in the free plan?") and hasClickAction()).performScrollTo().performClick()
        width = 1000.dp

        rule.onNode(hasText("Yearly", substring = true) and hasClickAction()).assertIsSelected()
        rule.onNode(hasText("With the free plan, you get:")).assertExists()
        assertEquals(card("Plus").top, card("Free").top)
    }

    private fun show(
        viewer: PlanViewer,
        messagesUsed: AllowanceItem? = null,
        frame: @Composable (@Composable () -> Unit) -> Unit = { it() },
    ) {
        rule.setContent {
            ZoonkTheme {
                navigator = rememberAppNavigator()
                Box(Modifier.verticalScroll(rememberScrollState())) {
                    frame {
                        PlanOffer(
                            viewer = viewer,
                            offers = LoadState.Loaded(offers),
                            freePlan = LoadState.Loaded(limits),
                            purchase = PurchaseState.Idle,
                            navigator = navigator,
                            onSubscribe = {},
                            onRetryFreePlan = {},
                            messagesUsed = messagesUsed,
                        )
                    }
                }
            }
        }
    }

    /** The plan's card, which holds its name as a heading. */
    private fun card(name: String): DpRect = rule.onNode(hasText(name) and isHeading()).onParent().getBoundsInRoot()
}
