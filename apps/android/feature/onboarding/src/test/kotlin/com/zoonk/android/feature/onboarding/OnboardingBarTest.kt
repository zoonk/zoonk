package com.zoonk.android.feature.onboarding

import android.graphics.Bitmap
import androidx.activity.ComponentActivity
import androidx.compose.ui.graphics.asAndroidBitmap
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.hasAnyAncestor
import androidx.compose.ui.test.hasAnyDescendant
import androidx.compose.ui.test.hasScrollAction
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onRoot
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.FakeSession
import com.zoonk.android.data.SignInResult
import com.zoonk.android.feature.catalog.COURSE
import com.zoonk.android.feature.catalog.CatalogStore
import com.zoonk.android.feature.catalog.FakeCatalogApi
import com.zoonk.android.feature.onboarding.course.CourseStartScreen
import com.zoonk.android.feature.onboarding.start.StartGoalScreen
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.navigation.rememberAppNavigator
import com.zoonk.android.ui.testing.captureRender
import com.zoonk.android.ui.theme.ZoonkTheme
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import java.io.File

/**
 * Main's `OnboardingActions`: when a screen's content runs past the window, its actions stay pinned in the bottom
 * bar, in reach without scrolling. `-Pzoonk.shots=<folder>` also writes pictures.
 */
@RunWith(AndroidJUnit4::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
class OnboardingBarTest {
    @get:Rule
    val rule = createAndroidComposeRule<ComponentActivity>()

    private val folder = System.getProperty("zoonk.shots").orEmpty()
    private val session = FakeSession(AuthenticatedSession("ana", "token-a", "local-a"))
    private val cache = AppCache(session, CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate))
    private val api = FakeOnboardingApi().apply { draft = understoodDraft(understanding = threeGoals()) }
    private val store = OnboardingStore(api, cache, session) { SignInResult.SignedIn }

    private fun showUnderstood() {
        rule.setContent {
            ZoonkTheme {
                StartGoalScreen(
                    AppRoute.StartGoal(draftId = DRAFT_ID),
                    store,
                    cache.noAllowance(),
                    sessionKey = "local-a",
                    canAttach = true,
                    rememberAppNavigator(),
                )
            }
        }
        rule.waitForIdle()
    }

    private fun showCourseStart() {
        rule.setContent {
            ZoonkTheme {
                CourseStartScreen(
                    AppRoute.CourseStart(COURSE),
                    CatalogStore(FakeCatalogApi(), cache),
                    store,
                    cache.noAllowance(),
                    signedIn = true,
                    null,
                    rememberAppNavigator(),
                )
            }
        }
        rule.waitForIdle()
    }

    /** The content scrolls, and [action] is on screen outside it. */
    private fun assertPinned(
        heading: String,
        action: String,
    ) {
        val scrolls = rule.onAllNodes(hasScrollAction() and hasAnyDescendant(hasText(heading))).fetchSemanticsNodes()
        assertTrue(
            "The content fits, so nothing shows the bar is pinned",
            scrolls.any { it.config[SemanticsProperties.VerticalScrollAxisRange].maxValue() > 0f },
        )
        rule.onNode(hasText(heading) and hasAnyAncestor(hasScrollAction())).assertExists()
        rule.onNode(hasText(action) and !hasAnyAncestor(hasScrollAction())).assertIsDisplayed()
    }

    @Test
    @Config(qualifiers = "w360dp-h640dp-xxhdpi")
    fun onAPhoneUnderstoodKeepsItsActionsInReach() {
        showUnderstood()
        write("understood-tall-phone")
        assertPinned("Here's what I understood", "Looks right")
    }

    @Test
    @Config(qualifiers = "w1280dp-h600dp-land-xhdpi")
    fun onAWideWindowUnderstoodKeepsItsActionsInReach() {
        showUnderstood()
        write("understood-tall-wide")
        assertPinned("Here's what I understood", "Looks right")
    }

    /** Large text, since the level choices fit a phone at the default size. */
    @Test
    @Config(qualifiers = "w360dp-h640dp-xxhdpi", fontScale = 1.5f)
    fun onAPhoneCourseStartKeepsItsActionsInReach() {
        showCourseStart()
        write("course-start-tall-phone")
        assertPinned("Atoms", "Build my plan")
    }

    @Test
    @Config(qualifiers = "w1280dp-h600dp-land-xhdpi")
    fun onAWideWindowCourseStartKeepsItsActionsInReach() {
        showCourseStart()
        write("course-start-tall-wide")
        assertPinned("Atoms", "Build my plan")
    }

    private fun write(name: String) {
        if (folder.isEmpty()) return
        val bitmap = rule.onRoot().captureRender().asAndroidBitmap()
        val file = File(folder, "$name.png").apply { parentFile?.mkdirs() }
        file.outputStream().use { bitmap.compress(Bitmap.CompressFormat.PNG, 100, it) }
    }
}

private fun threeGoals() = goalsUnderstanding().replace("]}", ",${learn("statistics")},${learn("calculus")}]}")

private fun learn(subject: String) =
    """{"cutoff":null,"examDates":[],"draft":{"kind":"learn","language":"en","prompt":"learn $subject","title":"Learn $subject","details":{}}}"""
