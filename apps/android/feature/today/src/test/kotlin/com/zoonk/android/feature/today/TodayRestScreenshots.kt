package com.zoonk.android.feature.today

import android.graphics.Bitmap
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.asAndroidBitmap
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.test.junit4.ComposeContentTestRule
import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.compose.ui.test.onRoot
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.R
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.FakeSession
import com.zoonk.android.feature.focustest.unusedFocusTests
import com.zoonk.android.feature.plan.FakePlanApi
import com.zoonk.android.feature.plan.PlanStore
import com.zoonk.android.feature.session.FakeStudyApi
import com.zoonk.android.feature.session.StudyOpener
import com.zoonk.android.feature.session.decodeFixture
import com.zoonk.android.ui.components.Button
import com.zoonk.android.ui.components.OutlinedButton
import com.zoonk.android.ui.testing.captureRender
import com.zoonk.android.ui.theme.ZoonkTheme
import com.zoonk.api.models.SuggestedGoal
import com.zoonk.api.models.Today
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import org.junit.Assume.assumeTrue
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import java.io.File

/** Review renders of Today's pages for a goal with no day, on demand: `-Pzoonk.shots=<folder>`. No goldens. */
@RunWith(AndroidJUnit4::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(qualifiers = "w411dp-h900dp-xxhdpi")
class TodayRestScreenshots {
    @get:Rule
    val rule: ComposeContentTestRule = createComposeRule()

    private val folder = System.getProperty("zoonk.shots").orEmpty()

    @Before
    fun onlyOnDemand() = assumeTrue("Pass -Pzoonk.shots=<folder> to write them", folder.isNotEmpty())

    @Test
    fun paused() =
        render("today-paused-phone") {
            TodayAtRest(
                padding = PaddingValues(),
                icon = R.drawable.ic_pause,
                sentence = stringResource(R.string.today_paused_goal, GOAL),
                clause = stringResource(R.string.today_paused_detail),
                failure = stringResource(R.string.plan_goal_limit_reached),
                other = { OutlinedButton(onClick = {}) { Text(stringResource(R.string.today_new_goal)) } },
            ) { main -> Button(onClick = {}, modifier = main) { Text(stringResource(R.string.today_resume)) } }
        }

    @Test
    @Config(qualifiers = "w1280dp-h800dp-land-xhdpi")
    fun pausedTablet() =
        render("today-paused-tablet") {
            TodayAtRest(
                padding = PaddingValues(),
                icon = R.drawable.ic_pause,
                sentence = stringResource(R.string.today_paused_goal, GOAL),
                clause = stringResource(R.string.today_paused_detail),
                other = { OutlinedButton(onClick = {}) { Text(stringResource(R.string.today_new_goal)) } },
            ) { main -> Button(onClick = {}, modifier = main) { Text(stringResource(R.string.today_resume)) } }
        }

    @Test
    fun finished() =
        render("today-finished-phone") {
            TodayAtRest(
                padding = PaddingValues(),
                icon = R.drawable.ic_flag,
                sentence = stringResource(R.string.today_finished_goal, GOAL),
            ) { main -> Button(onClick = {}, modifier = main) { Text(stringResource(R.string.today_new_goal)) } }
        }

    @Test
    fun planReady() =
        render("today-plan-ready-phone") {
            TodayAtRest(
                padding = PaddingValues(),
                icon = R.drawable.ic_check,
                sentence = stringResource(R.string.onboarding_plan_ready_goal, GOAL),
            ) { main -> Button(onClick = {}, modifier = main) { Text(stringResource(R.string.onboarding_see_plan)) } }
        }

    @Test
    fun questionsLeft() =
        render("today-questions-left-phone") {
            TodayAtRest(
                padding = PaddingValues(),
                icon = R.drawable.ic_checklist,
                sentence = stringResource(R.string.today_setting_up_goal, GOAL),
            ) { main -> Button(onClick = {}, modifier = main) { Text(stringResource(R.string.today_continue_draft)) } }
        }

    @Test
    fun building() =
        render("today-building-phone") {
            TodayPage(PaddingValues()) {
                TodayPageHeader(stringResource(R.string.today_title))
                TodayPlanWait(GOAL)
            }
        }

    @Test
    fun suggestedGoal() {
        val cache =
            AppCache(
                FakeSession(AuthenticatedSession("ana", "token-a", "local-a")),
                CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate),
            )
        val store =
            TodayStore(
                FakeTodayApi(listOf(decodeFixture<Today>("today"))),
                cache,
                CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate),
                timeZone = { "UTC" },
            )
        val viewModel =
            TodayViewModel(
                StudyOpener(FakeStudyApi(), { _, _ -> error("Not used") }, cache, timeZone = { "UTC" }),
                store,
                PlanStore(FakePlanApi(), cache),
                unusedFocusTests(cache),
            )
        val suggestion = decodeFixture<SuggestedGoal>("suggested-goal", "title" to "Spanish for travel")
        render("today-suggested-goal-phone") { WelcomeBack(suggestion, viewModel, PaddingValues()) }
    }

    private fun render(
        name: String,
        content: @Composable () -> Unit,
    ) {
        rule.setContent { ZoonkTheme { Surface { content() } } }
        rule.waitForIdle()
        val file = File(folder, "$name.png").apply { parentFile?.mkdirs() }
        file.outputStream().use {
            rule
                .onRoot()
                .captureRender()
                .asAndroidBitmap()
                .compress(Bitmap.CompressFormat.PNG, 100, it)
        }
    }

    private companion object {
        const val GOAL = "Biology"
    }
}
