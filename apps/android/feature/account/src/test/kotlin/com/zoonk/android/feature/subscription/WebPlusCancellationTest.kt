package com.zoonk.android.feature.subscription

import android.graphics.Bitmap
import androidx.activity.ComponentActivity
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asAndroidBitmap
import androidx.compose.ui.semantics.SemanticsActions
import androidx.compose.ui.test.assertIsEnabled
import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.hasAnyAncestor
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.isDialog
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.test.performSemanticsAction
import androidx.compose.ui.text.TextLayoutResult
import androidx.compose.ui.text.TextStyle
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.R
import com.zoonk.android.data.ANA
import com.zoonk.android.data.ApiError
import com.zoonk.android.data.ApiException
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.Audience
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.FakeSession
import com.zoonk.android.data.MutationResult
import com.zoonk.android.data.collectShown
import com.zoonk.android.navigation.rememberAppNavigator
import com.zoonk.android.ui.testing.captureRender
import com.zoonk.android.ui.testing.writeRender
import com.zoonk.android.ui.theme.ZoonkTheme
import com.zoonk.api.models.MeSubscription
import com.zoonk.api.models.StripeSubscriptionCancellation
import com.zoonk.api.models.StripeSubscriptionCancellation.State
import com.zoonk.api.models.StripeSubscriptionCancellationReceipt
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assume.assumeTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import java.io.File
import java.util.UUID
import kotlin.time.Instant

@RunWith(AndroidJUnit4::class)
class WebPlusCancellationTest {
    @get:Rule
    val rule = createAndroidComposeRule<ComponentActivity>()

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)
    private var response: suspend () -> StripeSubscriptionCancellation? = { web(State.RENEWING) }
    private var darkTheme = false
    private var higherContrast = false
    private var reads = 0
    private var profile by mutableStateOf(false)
    private var subscription by mutableStateOf<MeSubscription?>(plan())
    private val website =
        AppCache(FakeSession(AuthenticatedSession(ANA, "token-a", "local-a")), scope).resource(Audience.SignedIn) {
            reads++
            response()
        }

    @After
    fun close() = scope.cancel()

    private fun show() {
        rule.setContent {
            ZoonkTheme(darkTheme = darkTheme, moreContrast = higherContrast) {
                Surface {
                    if (profile) {
                        deletionPlusNotices(website, provider = null).forEach { Text(it) }
                    } else {
                        val state by website.collectShown()
                        Column(Modifier.verticalScroll(rememberScrollState())) {
                            AccountPlans(
                                subscription,
                                state,
                                rememberAppNavigator(),
                                onRetryWebsite = { scope.launch { website.refresh() } },
                                offer = { Text("Free offer") },
                            )
                        }
                    }
                }
            }
        }
    }

    private fun update(state: State) {
        response = { web(state) }
        rule.runOnIdle { scope.launch { website.refresh() } }
    }

    @Test
    fun theZoonkManagedLineKeepsItsMutedBodyStyle() {
        subscription = plan("zoonk")
        response = { null }
        var expectedColor = Color.Unspecified
        var expectedStyle = TextStyle.Default
        rule.setContent {
            ZoonkTheme {
                expectedColor = MaterialTheme.colorScheme.onSurfaceVariant
                expectedStyle = MaterialTheme.typography.bodyMedium
                val state by website.collectShown()
                AccountPlans(subscription, state, rememberAppNavigator(), onRetryWebsite = {}, offer = {})
            }
        }
        val layouts = mutableListOf<TextLayoutResult>()
        rule
            .onNodeWithText("To change or cancel Plus, write to us.")
            .performSemanticsAction(SemanticsActions.GetTextLayoutResult) { it(layouts) }
        val actual = layouts.single().layoutInput.style
        assertEquals(
            listOf(expectedColor, expectedStyle.fontSize, expectedStyle.lineHeight, expectedStyle.fontWeight, expectedStyle.letterSpacing),
            listOf(actual.color, actual.fontSize, actual.lineHeight, actual.fontWeight, actual.letterSpacing),
        )
    }

    @Test
    fun twoSubscriptionsEachOpenTheirOwnManagementPlace() {
        subscription = plan("google")
        response = { web(State.UNPAID) }
        show()
        rule.onNodeWithText("Through Google Play").assertExists()
        rule.onNodeWithText("Manage in Google Play").assertExists()
        rule.onNodeWithText("Through the website").assertExists()
        rule.onNodeWithText("Update your payment on the website, where you subscribed.").assertExists()
        rule.onNodeWithText("Cancel Plus").assertDoesNotExist()
    }

    @Test
    fun aRenewingWebsiteSubscriptionOpensManagement() = websiteAction(State.RENEWING, "Manage on the website")

    @Test
    fun anEndingWebsiteSubscriptionOpensManagement() = websiteAction(State.ENDING, "Manage on the website")

    @Test
    fun aFailedWebsiteRenewalOpensPayment() = websiteAction(State.UNPAID, "Update your payment on the website, where you subscribed.")

    private fun websiteAction(
        state: State,
        label: String,
    ) {
        subscription = null
        response = { web(state) }
        show()
        rule.onNodeWithText(label).assertExists()
        rule.onNodeWithText(label).performClick()
        val intent =
            org.robolectric.Shadows
                .shadowOf(rule.activity)
                .nextStartedActivity
        assertEquals("https://www.zoonk.com/subscription", intent.dataString)
    }

    @Test
    fun aFailedWebsiteReadCanBeRetriedWithoutShowingTheOffer() {
        subscription = null
        response = { throw ApiException(ApiError.Unavailable, status = 500) }
        show()
        rule.onNodeWithText("This page didn't load").assertExists()
        rule.onNodeWithText("Free offer").assertDoesNotExist()
        response = { web(State.UNPAID) }
        rule.onNodeWithText("Try again").performClick()
        rule.onNodeWithText("Update your payment on the website, where you subscribed.").assertExists()
        assertEquals(2, reads)
    }

    @Test
    @GraphicsMode(GraphicsMode.Mode.NATIVE)
    @Config(qualifiers = "w411dp-h891dp-xxhdpi")
    fun renderPhone() = renderStates("phone")

    @Test
    @GraphicsMode(GraphicsMode.Mode.NATIVE)
    @Config(qualifiers = "w800dp-h1000dp-xhdpi")
    fun renderMedium() = renderStates("medium")

    @Test
    @GraphicsMode(GraphicsMode.Mode.NATIVE)
    @Config(qualifiers = "w1280dp-h800dp-land-xhdpi")
    fun renderExpanded() = renderStates("expanded")

    @Test
    @GraphicsMode(GraphicsMode.Mode.NATIVE)
    @Config(qualifiers = "w411dp-h891dp-night-xxhdpi")
    fun renderDarkMoreContrast() = renderStates("dark-contrast", dark = true, moreContrast = true)

    @Test
    @GraphicsMode(GraphicsMode.Mode.NATIVE)
    @Config(qualifiers = "w411dp-h891dp-xxhdpi")
    fun renderLargeFont() {
        assumeTrue(System.getProperty("zoonk.shots").orEmpty().isNotEmpty())
        RuntimeEnvironment.setFontScale(2f)
        renderStates("font200")
    }

    @Test
    @GraphicsMode(GraphicsMode.Mode.NATIVE)
    @Config(qualifiers = "pl-w411dp-h891dp-xxhdpi")
    fun renderPolishDialog() {
        val folder = System.getProperty("zoonk.shots").orEmpty()
        assumeTrue("Pass -Pzoonk.shots=<folder> to write review screenshots", folder.isNotEmpty())
        show()
        capture(folder, "polish-website")
    }

    private fun renderStates(
        prefix: String,
        dark: Boolean = false,
        moreContrast: Boolean = false,
    ) {
        val folder = System.getProperty("zoonk.shots").orEmpty()
        assumeTrue("Pass -Pzoonk.shots=<folder> to write review screenshots", folder.isNotEmpty())
        darkTheme = dark
        higherContrast = moreContrast
        subscription = plan("zoonk")
        response = { null }
        show()
        rule.onNodeWithText("To change or cancel Plus, write to us.").assertExists()
        capture(folder, "$prefix-zoonk")
        subscription = plan()
        update(State.RENEWING)
        capture(folder, "$prefix-renewing")
        update(State.ENDING)
        capture(folder, "$prefix-ending")
        subscription = null
        update(State.UNPAID)
        rule.onNodeWithText(RENEWAL_FAILED).assertExists()
        capture(folder, "$prefix-unpaid")
        subscription = plan("google")
        rule.onNodeWithText("Through Google Play").assertExists()
        capture(folder, "$prefix-store-and-website")
        profile = true
        rule.onNodeWithText("Deleting your account ends Plus right away.").assertExists()
        capture(folder, "$prefix-deletion-notice")
    }

    private fun capture(
        folder: String,
        name: String,
        dialog: Boolean = false,
    ) {
        rule.mainClock.advanceTimeByFrame()
        rule.waitForIdle()
        val root = if (dialog) rule.onNode(isDialog()) else rule.onRoot()
        val bitmap = root.captureRender().asAndroidBitmap()
        val file = File(folder, "$name.png").apply { parentFile?.mkdirs() }
        writeRender(file, bitmap)
    }

    private companion object {
        val ENDS: Instant = Instant.parse("2026-12-01T12:00:00Z")

        fun web(state: State) = StripeSubscriptionCancellation(if (state == State.UNPAID) null else ENDS, state)

        fun plan(provider: String = "stripe") =
            MeSubscription(
                cancelAt = null,
                cancelAtPeriodEnd = false,
                id = UUID.fromString("0b6f8f62-58a5-4e0e-8f0e-2f7d0ad0c0d4"),
                periodEnd = ENDS,
                periodStart = null,
                plan = "plus",
                provider = provider,
                status = "active",
            )
    }
}

internal const val RENEWAL_FAILED = "Your last renewal payment failed."
