package com.zoonk.android.feature.plan

import android.content.pm.ActivityInfo
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.test.junit4.ComposeTestRule
import androidx.compose.ui.test.junit4.v2.createEmptyComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.test.core.app.ActivityScenario
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.app.AppContainer
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.FakeSession
import com.zoonk.android.feature.certificates.CertificateStore
import com.zoonk.android.feature.certificates.CertificatesApi
import com.zoonk.android.navigation.AppNavigator
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.navigation.rememberAppNavigator
import com.zoonk.android.ui.theme.ZoonkTheme
import com.zoonk.api.ApiJson
import com.zoonk.api.models.CertificateImageUrls
import com.zoonk.api.models.Goal
import com.zoonk.api.models.OwnedCertificate
import com.zoonk.api.models.PlanCertificates
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.datetime.LocalDate
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RuntimeEnvironment
import org.robolectric.Shadows.shadowOf
import org.robolectric.annotation.Config
import java.io.IOException
import java.net.URI
import java.util.UUID
import kotlin.time.Instant

/**
 * "Get your certificate" opens the certificate though the window changes width, both ways, while the claim is out,
 * and opens nothing once the learner left the Plan before it landed.
 */
@RunWith(AndroidJUnit4::class)
@Config(qualifiers = "w411dp-h891dp")
class PlanCertificateClaimWindowTest {
    @get:Rule
    val rule: ComposeTestRule = createEmptyComposeRule()

    private lateinit var scenario: ActivityScenario<PlanClaimTestActivity>

    @After
    fun close() = scenario.close()

    @Test
    fun aClaimOutWhileTheWindowWidensAndNarrowsOpensItsCertificateOnce() {
        val held = launchWithAHeldClaim()

        rule.onNodeWithText("Get your certificate").performScrollTo().performClick()
        RuntimeEnvironment.setQualifiers("w1280dp-h900dp")
        scenario.recreate()
        RuntimeEnvironment.setQualifiers("w411dp-h891dp")
        scenario.recreate()
        held.complete(Unit)
        rule.waitForIdle()

        assertEquals(AppRoute.Certificate(CODE), PlanClaimTest.navigator.currentRoute)
    }

    @Test
    fun aClaimThatLandsAfterTheLearnerLeftThePlanOpensNothingOnTheirReturn() {
        val held = launchWithAHeldClaim()

        rule.onNodeWithText("Get your certificate").performScrollTo().performClick()
        PlanClaimTest.visible = false
        rule.waitForIdle()
        held.complete(Unit)
        rule.waitForIdle()
        PlanClaimTest.visible = true
        rule.waitForIdle()

        assertEquals(AppRoute.Today, PlanClaimTest.navigator.currentRoute)
    }

    @Test
    fun aClaimThatFailsWhileTheWindowWidensAndNarrowsSaysSoOnce() {
        val held = launchWithAHeldClaim()

        rule.onNodeWithText("Get your certificate").performScrollTo().performClick()
        RuntimeEnvironment.setQualifiers("w1280dp-h900dp")
        scenario.recreate()
        RuntimeEnvironment.setQualifiers("w411dp-h891dp")
        scenario.recreate()
        held.completeExceptionally(IOException("offline"))
        rule.waitForIdle()

        assertEquals(true, claimModel().failed)
    }

    @Test
    fun aClaimThatFailsAfterTheLearnerLeftThePlanSaysNothingOnTheirReturn() {
        val held = launchWithAHeldClaim()

        rule.onNodeWithText("Get your certificate").performScrollTo().performClick()
        PlanClaimTest.visible = false
        rule.waitForIdle()
        held.completeExceptionally(IOException("offline"))
        rule.waitForIdle()
        PlanClaimTest.visible = true
        rule.waitForIdle()

        assertEquals(false, claimModel().failed)
    }

    private fun claimModel(): CertificateClaimModel {
        lateinit var claim: CertificateClaimModel
        scenario.onActivity {
            claim = ViewModelProvider(it)["certificate-claim-${PlanClaimTest.page.goal.id}", CertificateClaimModel::class.java]
        }
        return claim
    }

    /** The Plan with a certificate to claim, its claim held until the returned call completes. */
    private fun launchWithAHeldClaim(): CompletableDeferred<Unit> {
        val application = RuntimeEnvironment.getApplication()
        shadowOf(application.packageManager).addOrUpdateActivity(
            ActivityInfo().apply {
                name = PlanClaimTestActivity::class.java.name
                packageName = application.packageName
            },
        )
        val held = CompletableDeferred<Unit>()
        val session = FakeSession(AuthenticatedSession("ana", "token-a", "local-a"))
        val cache = AppCache(session, CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate))
        val summary = learnerSummary(kind = "exam", title = "ENEM")
        val page = PlanPageState(summary.goals.first(), plan(), summary)
        PlanClaimTest.visible = true
        PlanClaimTest.app = AppContainer.preview(application)
        PlanClaimTest.page = page
        PlanClaimTest.viewModel = PlanViewModel(PlanStore(FakePlanApi(), cache), page.goal.id, PlanClaimTest.app.writingWaits)
        PlanClaimTest.farTopics = FarTopicViewModel(PlanStore(FakePlanApi(), cache), page.goal.id)
        PlanClaimTest.claims = CertificateStore(HeldClaims(held), cache)
        PlanClaimTest.app.plans.end[page.goal.id].replace(
            GoalEnd(
                next = null,
                certificates = ApiJson.decodeFromString<PlanCertificates>("""{"earned":[],"unclaimed":[{"courseLevel":null}]}"""),
            ),
        )
        scenario = ActivityScenario.launch(PlanClaimTestActivity::class.java)
        return held
    }

    private class HeldClaims(
        private val held: CompletableDeferred<Unit>,
    ) : CertificatesApi {
        override suspend fun list(session: AuthenticatedSession) = emptyList<OwnedCertificate>()

        override suspend fun markShown(
            session: AuthenticatedSession,
            code: String,
        ) = Unit

        override suspend fun claim(
            session: AuthenticatedSession,
            goalId: UUID,
        ): List<OwnedCertificate> {
            held.await()
            return listOf(shown())
        }

        override suspend fun goals(session: AuthenticatedSession) = emptyList<Goal>()
    }
}

/** A certificate already shown, so the claim opens it rather than celebrating it. */
private fun shown(): OwnedCertificate {
    val picture = "https://www.zoonk.com/en/c/$CODE/image"
    return OwnedCertificate(
        canDo = emptyList(),
        category = null,
        code = CODE,
        completedOn = LocalDate(2026, 11, 3),
        courseId = null,
        courseLevel = null,
        kind = OwnedCertificate.Kind.COURSE,
        language = "en",
        lessonsStudied = 12,
        lessonsTestedOut = 0,
        level = null,
        minutes = 240,
        recipientName = "Ana Souza",
        targetLanguage = null,
        title = "ENEM",
        topics = emptyList(),
        locked = false,
        shownAt = Instant.parse("2026-11-03T12:00:00Z"),
        imageUrls =
            CertificateImageUrls(
                link = URI("$picture/link.png"),
                post = URI("$picture/post.png"),
                print = URI("$picture/print.png"),
                screen = URI("$picture/screen.png"),
            ),
        linkedInUrl = URI("https://www.linkedin.com/profile/add"),
        url = URI("https://www.zoonk.com/c/$CODE"),
    )
}

private const val CODE = "K7QF2M9XHD4P"

/** What outlives [PlanClaimTestActivity]'s recreations, as the app's container and a navigation entry's view models do. */
object PlanClaimTest {
    /** False while the learner is away from the Plan, its entry and view models kept, as another tab keeps them. */
    var visible by mutableStateOf(true)
    lateinit var app: AppContainer
    lateinit var page: PlanPageState
    lateinit var viewModel: PlanViewModel
    lateinit var farTopics: FarTopicViewModel
    lateinit var claims: CertificateStore
    lateinit var navigator: AppNavigator
}

class PlanClaimTestActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val page = PlanClaimTest.page
        // The claim's view model, as PlanPage keys it, over a store whose claim the test holds.
        ViewModelProvider(
            this,
            object : ViewModelProvider.Factory {
                @Suppress("UNCHECKED_CAST")
                override fun <T : ViewModel> create(modelClass: Class<T>): T =
                    CertificateClaimModel(PlanClaimTest.claims, page.goal.id) as T
            },
        )["certificate-claim-${page.goal.id}", CertificateClaimModel::class.java]
        setContent {
            ZoonkTheme {
                PlanClaimTest.navigator = rememberAppNavigator()
                if (PlanClaimTest.visible) {
                    PlanPage(
                        page,
                        PlanClaimTest.app,
                        PlanClaimTest.navigator,
                        PlanClaimTest.viewModel,
                        PlanClaimTest.farTopics,
                        focus = null,
                    )
                }
            }
        }
    }
}
