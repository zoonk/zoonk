package com.zoonk.android.feature.onboarding.start

import android.graphics.Bitmap
import androidx.activity.ComponentActivity
import androidx.compose.ui.graphics.asAndroidBitmap
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.onRoot
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.Audience
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.FakeSession
import com.zoonk.android.data.SignInResult
import com.zoonk.android.feature.onboarding.FakeOnboardingApi
import com.zoonk.android.feature.onboarding.OnboardingStore
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.navigation.rememberAppNavigator
import com.zoonk.android.ui.testing.captureRender
import com.zoonk.android.ui.theme.ZoonkTheme
import com.zoonk.api.ApiJson
import com.zoonk.api.models.AllowanceResponse
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import java.io.File

/**
 * At the goals-at-once limit, starting a goal is only the gate: its own title, Subscribe and the Plan
 * in the bar, and no question it can't take an answer to. `-Pzoonk.shots=<folder>` also writes pictures.
 */
@RunWith(AndroidJUnit4::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
class GoalLimitScreenTest {
    @get:Rule
    val rule = createAndroidComposeRule<ComponentActivity>()

    private val folder = System.getProperty("zoonk.shots").orEmpty()

    private fun show() {
        val session = FakeSession(AuthenticatedSession("ana", "token-a", "local-a"))
        val cache = AppCache(session, CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate))
        val store = OnboardingStore(FakeOnboardingApi(), cache, session) { SignInResult.SignedIn }
        val allowance = cache.resource<AllowanceResponse>(Audience.SignedIn) { AT_THE_LIMIT }
        rule.setContent {
            ZoonkTheme {
                StartGoalScreen(AppRoute.StartGoal(), store, allowance, sessionKey = "local-a", canAttach = true, rememberAppNavigator())
            }
        }
        rule.waitForIdle()
    }

    private fun assertOnlyTheGate() {
        rule.onNodeWithText("That's all the goals you can study at once").assertExists()
        rule.onNodeWithText("Subscribe").assertExists()
        rule.onNodeWithText("Go to your Plan").assertExists()
        rule.onNodeWithText("What do you want to achieve?").assertDoesNotExist()
        rule.onNodeWithText("How it works").assertDoesNotExist()
    }

    @Test
    @Config(qualifiers = "w411dp-h891dp-xxhdpi")
    fun onAPhoneTheLimitIsTheWholeScreen() {
        show()
        write("goal-limit-phone")
        assertOnlyTheGate()
    }

    @Test
    @Config(qualifiers = "w1280dp-h800dp-land-xhdpi")
    fun onAWideWindowTheLimitHasNoSidePane() {
        show()
        write("goal-limit-expanded")
        assertOnlyTheGate()
    }

    private fun write(name: String) {
        if (folder.isEmpty()) return
        val bitmap = rule.onRoot().captureRender().asAndroidBitmap()
        val file = File(folder, "$name.png").apply { parentFile?.mkdirs() }
        file.outputStream().use { bitmap.compress(Bitmap.CompressFormat.PNG, 100, it) }
    }

    private companion object {
        val AT_THE_LIMIT: AllowanceResponse =
            ApiJson.decodeFromString(
                """
                {"tier":"free","activeGoals":{"limit":3,"used":3},
                 "callTime":{"limitSeconds":null,"monthLimitSeconds":null,"usedSeconds":0,"usedSecondsThisMonth":0},
                 "examPrep":{"includesMockExams":false},"generatedLessons":null,
                 "resets":{"day":"2026-10-29T00:00:00Z","month":"2026-11-01T00:00:00Z"},
                 "items":[{"kind":"goal","dailyLimit":null,"monthlyLimit":3,"totalLimit":null,"usedToday":0,"usedThisMonth":1,
                   "usedTotal":1,"fairUseDailyLimit":null,"remaining":null}]}
                """.trimIndent(),
            )
    }
}
