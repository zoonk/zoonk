package com.zoonk.android.feature.subscription

import androidx.activity.ComponentActivity
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.test.getBoundsInRoot
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.data.ApiError
import com.zoonk.android.data.LoadState
import com.zoonk.android.navigation.rememberAppNavigator
import com.zoonk.android.ui.theme.ZoonkTheme
import com.zoonk.api.models.FreePlan
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.annotation.Config

/** Plus beside Free on a wide window. */
@RunWith(AndroidJUnit4::class)
@Config(qualifiers = "w1280dp-h1600dp-xhdpi")
class PlanCardsTest {
    @get:Rule
    val compose = createAndroidComposeRule<ComponentActivity>()

    /** TalkBack reads groups beside each other by their index: every group holding Plus's words ranks before Free's. */
    @Test
    fun talkBackReadsAllOfPlusBeforeFree() {
        show(LoadState.Loaded(LIMITS))

        val plus = listOf("$9.99", "Subscribe", "Cancel anytime.", "Every goal").map(::readingRank)
        val free = listOf("$0", "What you have now", "20 lessons a month").map(::readingRank)

        assertTrue("Plus reads before Free: $plus, $free", plus.max() < free.min())
    }

    @Test
    fun plusKeepsItsWidthWhileFreeLoads() {
        var free by mutableStateOf<LoadState<FreePlan>>(LoadState.Loading)
        compose.setContent { Offer(free) }
        val loading = compose.onNodeWithText("Subscribe").getBoundsInRoot()

        free = LoadState.Loaded(LIMITS)
        compose.waitForIdle()
        val loaded = compose.onNodeWithText("Subscribe").getBoundsInRoot()

        assertEquals(loaded, loading)
    }

    /** Play sells nothing here, so Plus's buying row is empty; Free's button arriving mustn't push Plus's list down. */
    @Test
    fun plusKeepsItsListWhereItIsWhenFreeArrivesWithoutOffers() {
        var free by mutableStateOf<LoadState<FreePlan>>(LoadState.Loading)
        compose.setContent { Offer(free, offers = LoadState.Failed(ApiError.Unavailable), viewer = PlanViewer.Guest) }
        val loading = compose.onNodeWithText("Every goal", substring = true).getBoundsInRoot()

        free = LoadState.Loaded(LIMITS)
        compose.waitForIdle()
        val loaded = compose.onNodeWithText("Every goal", substring = true).getBoundsInRoot()

        assertEquals(loaded, loading)
    }

    private fun show(free: LoadState<FreePlan>) = compose.setContent { Offer(free) }

    @Composable
    private fun Offer(
        free: LoadState<FreePlan>,
        offers: LoadState<PlusOffers> = LoadState.Loaded(OFFERS),
        viewer: PlanViewer = PlanViewer.Free,
    ) {
        ZoonkTheme {
            PlanOffer(
                viewer = viewer,
                offers = offers,
                freePlan = free,
                purchase = PurchaseState.Idle,
                navigator = rememberAppNavigator(),
                onSubscribe = {},
                onRetryOffers = {},
                onRetryFreePlan = {},
            )
        }
    }

    /** The index of the traversal group [text] is read in, among the groups beside it. */
    private fun readingRank(text: String): Float =
        generateSequence(compose.onNodeWithText(text, substring = true, useUnmergedTree = true).fetchSemanticsNode()) { it.parent }
            .first { it.config.getOrElse(SemanticsProperties.IsTraversalGroup) { false } }
            .config
            .getOrElse(SemanticsProperties.TraversalIndex) { 0f }

    private companion object {
        val LIMITS =
            FreePlan(
                activeGoals = 1,
                guestLessons = 3,
                lessonsPer30Days = 20,
                tutorMessagesPer30Days = 100,
                tutorMessagesPerDay = 10,
                uploadsPerDay = 1,
            )

        val OFFERS =
            PlusOffers(
                PlusOffer(BillingPeriod.Monthly, "monthly", "$9.99", 9_990_000, "USD"),
                PlusOffer(BillingPeriod.Yearly, "yearly", "$79.99", 79_990_000, "USD"),
                product = Unit,
            )
    }
}
