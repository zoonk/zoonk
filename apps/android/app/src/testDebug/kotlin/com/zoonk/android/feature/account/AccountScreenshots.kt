package com.zoonk.android.feature.account

import android.graphics.Bitmap
import androidx.activity.ComponentActivity
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.asAndroidBitmap
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.test.captureToImage
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.unit.dp
import androidx.lifecycle.SavedStateHandle
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.app.AppContainer
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.BIA
import com.zoonk.android.data.DraftStore
import com.zoonk.android.data.FakeSessionApi
import com.zoonk.android.data.MemoryCredentials
import com.zoonk.android.data.SessionStore
import com.zoonk.android.data.account
import com.zoonk.android.feature.subscription.PlusNotice
import com.zoonk.android.feature.subscription.SubscriptionScreen
import com.zoonk.android.navigation.rememberAppNavigator
import com.zoonk.android.ui.scaffold.TaskScaffold
import com.zoonk.android.ui.theme.ZoonkTheme
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import org.junit.Assume.assumeTrue
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import java.io.File

/**
 * Review screenshots of the account screens, written only on demand:
 * `./gradlew :app:testDebugUnitTest --tests '*AccountScreenshots*' --rerun -Pzoonk.shots=<folder>`.
 */
@RunWith(AndroidJUnit4::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
class AccountScreenshots {
    @get:Rule
    val compose = createAndroidComposeRule<ComponentActivity>()

    private val folder = System.getProperty("zoonk.shots").orEmpty()

    @Before
    fun onlyOnDemand() = assumeTrue("Pass -Pzoonk.shots=<folder> to write them", folder.isNotEmpty())

    @Test
    @Config(qualifiers = "w411dp-h1400dp-xxhdpi")
    fun phone() = capture("phone")

    @Test
    @Config(qualifiers = "w411dp-h1400dp-night-xxhdpi")
    fun phoneDarkMoreContrast() = capture("phone-dark-more-contrast", dark = true, moreContrast = true)

    @Test
    @Config(qualifiers = "w411dp-h2600dp-xxhdpi")
    fun phoneAtTwiceTheFontSize() {
        RuntimeEnvironment.setFontScale(2f)
        capture("phone-font200")
    }

    @Test
    @Config(qualifiers = "w1280dp-h800dp-land-xhdpi")
    fun tablet() = capture("tablet")

    private fun capture(
        name: String,
        dark: Boolean = false,
        moreContrast: Boolean = false,
    ) {
        var index by mutableIntStateOf(0)
        compose.setContent {
            ZoonkTheme(darkTheme = dark, moreContrast = moreContrast) {
                Surface { key(index) { screens[index].second() } }
            }
        }
        screens.indices.forEach { screen ->
            index = screen
            compose.waitForIdle()
            write("${screens[screen].first}-$name", compose.onRoot().captureToImage().asAndroidBitmap())
        }
    }

    private fun write(
        name: String,
        bitmap: Bitmap,
    ) {
        val file = File(folder, "$name.png").apply { parentFile?.mkdirs() }
        file.outputStream().use { bitmap.compress(Bitmap.CompressFormat.PNG, 100, it) }
        println("Screenshot ${file.path}")
    }

    private val stores by lazy {
        val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)
        val context = RuntimeEnvironment.getApplication()
        val sessions =
            SessionStore(
                FakeSessionApi().apply { accounts += "token-b" to BIA },
                MemoryCredentials(),
                DraftStore(File(context.cacheDir, "drafts"), scope),
                onChange = { _, _ -> },
                clearCredentialState = {},
            )
        sessions to AccountStore(FakeAccountApi(), sessions, AppCache(sessions, scope))
    }

    private val screens: List<Pair<String, @Composable () -> Unit>> =
        listOf(
            "welcome" to { VisitorWelcome(rememberAppNavigator(), PaddingValues(), isSending = false, error = null, onSend = {}) },
            "login" to {
                val signIn = remember { SignInViewModel(stores.second, stores.first, SavedStateHandle()) }
                Task { Methods(signIn, rememberAppNavigator()) }
            },
            "login-code" to {
                val signIn =
                    remember {
                        SignInViewModel(stores.second, stores.first, SavedStateHandle()).apply {
                            onEmailChange("ana@zoonk.test")
                            sendCode()
                        }
                    }
                Task { signIn.codeSentTo?.let { CodeEntry(signIn, it) } }
            },
            "subscription-visitor" to {
                val context = LocalContext.current
                SubscriptionScreen(remember { AppContainer.preview(context) }, rememberAppNavigator())
            },
            "plus-notice" to {
                Column(Modifier.padding(16.dp)) {
                    PlusNotice(onSeePlus = {}, description = "Mock exams, timed like the real one.")
                }
            },
            "setup" to {
                val form = remember { ProfileFormViewModel(stores.second, account(BIA).user, SavedStateHandle()) }
                Task { ProfileSetupForm(form) }
            },
        )

    @Composable
    private fun Task(content: @Composable ColumnScope.() -> Unit) {
        TaskScaffold(onClose = {}) { padding -> AuthColumn(padding, content) }
    }
}
