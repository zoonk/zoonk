package com.zoonk.android.feature.subscription

import android.graphics.Bitmap
import androidx.activity.ComponentActivity
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.asAndroidBitmap
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.unit.dp
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.R
import com.zoonk.android.data.LoadState
import com.zoonk.android.navigation.rememberAppNavigator
import com.zoonk.android.ui.scaffold.PageScaffold
import com.zoonk.android.ui.testing.captureRender
import com.zoonk.android.ui.theme.ZoonkTheme
import com.zoonk.api.models.AllowanceItem
import com.zoonk.api.models.FreePlan
import org.junit.Assume.assumeTrue
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import java.io.File

/** Review screenshots of the plans each viewer sees, written only on demand: `--tests '*SubscriptionScreenshots*' --rerun -Pzoonk.shots=<folder>`. */
@RunWith(AndroidJUnit4::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
class SubscriptionScreenshots {
    @get:Rule
    val compose = createAndroidComposeRule<ComponentActivity>()

    private val folder = System.getProperty("zoonk.shots").orEmpty()

    @Before
    fun onlyOnDemand() = assumeTrue("Pass -Pzoonk.shots=<folder> to write them", folder.isNotEmpty())

    @Test
    @Config(qualifiers = "w411dp-h1800dp-xxhdpi")
    fun phone() = captureAll("subscription-phone")

    @Test
    @Config(qualifiers = "w411dp-h1800dp-night-xxhdpi")
    fun phoneDarkMoreContrast() = captureAll("subscription-phone-dark-contrast", dark = true, moreContrast = true)

    @Test
    @Config(qualifiers = "w411dp-h3200dp-xxhdpi")
    fun phoneAtTwiceTheFontSize() {
        RuntimeEnvironment.setFontScale(2f)
        captureAll("subscription-phone-font200")
    }

    @Test
    @Config(qualifiers = "w800dp-h1400dp-xhdpi")
    fun medium() = captureAll("subscription-medium")

    @Test
    @Config(qualifiers = "w1280dp-h800dp-land-xhdpi")
    fun tabletLandscape() = captureAll("subscription-tablet-land")

    @Test
    @Config(qualifiers = "w1280dp-h1300dp-xhdpi")
    fun tabletWholePage() = captureAll("subscription-tablet-page")

    private fun captureAll(
        prefix: String,
        dark: Boolean = false,
        moreContrast: Boolean = false,
    ) {
        var shown by mutableIntStateOf(0)

        compose.setContent {
            ZoonkTheme(darkTheme = dark, moreContrast = moreContrast) {
                PageScaffold(onBack = {}, title = { Text(stringResource(R.string.account_menu_subscription)) }) { padding ->
                    Box(
                        Modifier
                            .fillMaxSize()
                            .padding(padding)
                            .verticalScroll(rememberScrollState())
                            .padding(16.dp),
                        contentAlignment = Alignment.TopCenter,
                    ) {
                        val viewer = PlanViewer.entries[shown]
                        key(viewer) {
                            PlanOffer(
                                viewer = viewer,
                                offers = LoadState.Loaded(OFFERS),
                                freePlan = LoadState.Loaded(LIMITS),
                                purchase = PurchaseState.Idle,
                                navigator = rememberAppNavigator(),
                                onSubscribe = {},
                                onRetryFreePlan = {},
                                messagesUsed = MESSAGES.takeIf { viewer == PlanViewer.Free },
                            )
                        }
                    }
                }
            }
        }

        PlanViewer.entries.forEachIndexed { index, viewer ->
            shown = index
            compose.waitForIdle()
            val bitmap = compose.onRoot().captureRender().asAndroidBitmap()
            val file = File(folder, "$prefix-${viewer.name.lowercase()}.png").apply { parentFile?.mkdirs() }
            file.outputStream().use { bitmap.compress(Bitmap.CompressFormat.PNG, 100, it) }
        }
    }
}

private val LIMITS =
    FreePlan(
        activeGoals = 1,
        examPrepDays = 7,
        guestLessons = 3,
        lessonsPerDay = 5,
        lessonsPerMonth = 40,
        tutorMessagesPerDay = 10,
        uploadsPerDay = 1,
    )

private val OFFERS =
    PlusOffers(
        PlusOffer(BillingPeriod.Monthly, "monthly", "$9.99", 9_990_000, "USD"),
        PlusOffer(BillingPeriod.Yearly, "yearly", "$79.99", 79_990_000, "USD"),
        product = Unit,
    )

private val MESSAGES =
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
