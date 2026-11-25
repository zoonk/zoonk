package com.zoonk.android.feature.onboarding

import androidx.activity.ComponentActivity
import androidx.compose.material3.Surface
import androidx.compose.runtime.remember
import androidx.compose.ui.graphics.asAndroidBitmap
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onRoot
import androidx.lifecycle.ViewModelProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.window.testing.layout.WindowLayoutInfoPublisherRule
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.FakeSession
import com.zoonk.android.data.SignInResult
import com.zoonk.android.feature.onboarding.start.MaterialIntent
import com.zoonk.android.feature.onboarding.start.StartGoalScreen
import com.zoonk.android.feature.onboarding.start.StartGoalViewModel
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.navigation.rememberAppNavigator
import com.zoonk.android.ui.scaffold.unfoldBook
import com.zoonk.android.ui.testing.captureRender
import com.zoonk.android.ui.testing.writeRender
import com.zoonk.android.ui.theme.ZoonkTheme
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
import java.util.UUID

/**
 * Review screenshots of questions about attached material, written only on demand: the question panel under a short
 * transcript and after enough answers to scroll, at each window size and across an open book's fold.
 * `./gradlew :feature:onboarding:testDebugUnitTest --tests '*MaterialQuestionsScreenshots*' --rerun -Pzoonk.shots=<folder>`.
 */
@RunWith(AndroidJUnit4::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
class MaterialQuestionsScreenshots {
    @get:Rule(order = 0)
    val folds = WindowLayoutInfoPublisherRule()

    @get:Rule(order = 1)
    val compose = createAndroidComposeRule<ComponentActivity>()

    private val folder = System.getProperty("zoonk.shots").orEmpty()

    @Before
    fun onlyOnDemand() = assumeTrue("Pass -Pzoonk.shots=<folder> to write them", folder.isNotEmpty())

    @Test
    @Config(qualifiers = "w411dp-h891dp-xxhdpi")
    fun compact() = capture("compact")

    @Test
    @Config(qualifiers = "w700dp-h1000dp-xhdpi")
    fun medium() = capture("medium")

    @Test
    @Config(qualifiers = "w1280dp-h800dp-land-xhdpi")
    fun expanded() = capture("expanded")

    @Test
    @Config(qualifiers = "w852dp-h883dp-xhdpi")
    fun book() = capture("book", open = true)

    private fun capture(
        name: String,
        open: Boolean = false,
    ) {
        compose.setContent {
            ZoonkTheme {
                Surface {
                    val session = remember { FakeSession(AuthenticatedSession("ana", "token-a", "local-a")) }
                    val cache = remember { AppCache(session, CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)) }
                    val store = remember { OnboardingStore(FakeOnboardingApi(), cache, session) { SignInResult.SignedIn } }
                    StartGoalScreen(
                        AppRoute.StartGoal(),
                        store,
                        remember { cache.noAllowance() },
                        sessionKey = "local-a",
                        canAttach = true,
                        rememberAppNavigator(),
                    )
                }
            }
        }
        if (open) compose.unfoldBook(folds)
        compose.waitForIdle()
        val vm = ViewModelProvider(compose.activity)[StartGoalViewModel::class.java]
        compose.runOnUiThread {
            vm.setAttached(listOf(AttachedSource(UUID.randomUUID().toString(), "Cell cycle.pdf")))
            vm.setIntent(MaterialIntent.Questions)
            vm.submit("", "", "en")
        }
        compose.waitForIdle()
        write("material-questions-empty-$name")
        repeat(FILLING_TURNS) {
            compose.runOnUiThread { vm.ask("Why does glycolysis net only 2 ATP when it makes 4?", "en") }
            compose.waitForIdle()
        }
        write("material-questions-filled-$name")
    }

    private fun write(name: String) {
        val file = File(folder, "$name.png").apply { parentFile?.mkdirs() }
        writeRender(file, compose.onRoot().captureRender().asAndroidBitmap())
        println("Screenshot ${file.path}")
    }

    private companion object {
        const val FILLING_TURNS = 8
    }
}
