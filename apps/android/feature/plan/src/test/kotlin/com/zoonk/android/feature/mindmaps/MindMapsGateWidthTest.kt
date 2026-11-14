package com.zoonk.android.feature.mindmaps

import android.content.Context
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.width
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableStateOf
import androidx.compose.ui.Modifier
import androidx.compose.ui.test.getBoundsInRoot
import androidx.compose.ui.test.junit4.ComposeContentTestRule
import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.unit.dp
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import coil3.ImageLoader
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.FakeSession
import com.zoonk.android.data.PrivateImages
import com.zoonk.android.navigation.rememberAppNavigator
import com.zoonk.android.ui.components.LimitTier
import com.zoonk.android.ui.components.PrivatePictures
import com.zoonk.android.ui.theme.ZoonkTheme
import com.zoonk.api.models.GoalMindMaps
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import okhttp3.HttpUrl.Companion.toHttpUrl
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import java.time.Instant
import java.util.UUID

/** A held gate slot belongs to the width it was measured at: widened while gated, it takes the new width's height. */
@RunWith(AndroidJUnit4::class)
@Config(qualifiers = "w800dp-h1200dp")
@GraphicsMode(GraphicsMode.Mode.NATIVE)
class MindMapsGateWidthTest {
    @get:Rule
    val compose: ComposeContentTestRule = createComposeRule()

    private val api = FakeMindMapApi()
    private val session = AuthenticatedSession("ana", "token", "local")
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)
    private val chapters =
        listOf(mapJson(1, "Waves", "available"), mapJson(2, "Light", "available"), mapJson(3, "Optics", "available", lessonsToWrite = 2))
    private val fresh = goalMindMaps(chapters, offer = """{"eligible":2,"needLessons":2,"startable":2,"stop":null}""")

    @After
    fun stop() = scope.cancel()

    private fun stopped(at: Instant): GoalMindMaps =
        goalMindMaps(
            chapters,
            offer =
                """
                {"eligible":2,"needLessons":2,"startable":0,
                "stop":{"reason":"limitReached","resource":"mindMap","period":"rolling30Days","availableAt":"$at"}}
                """.trimIndent(),
        )

    private val width = mutableStateOf(240.dp)
    private val visit = mutableStateOf(0)

    private fun show() {
        val store = MindMapStore(api, AppCache(FakeSession(session), scope))
        val images =
            PrivateImages("https://example.test/v1/".toHttpUrl(), ImageLoader(ApplicationProvider.getApplicationContext<Context>()))
        val host = MindMapsHost(store, session, PrivatePictures(images, session), { null }, { LimitTier.Free }, { session })
        compose.setContent {
            ZoonkTheme {
                Box(
                    Modifier.width(width.value),
                ) { key(visit.value) { MindMapsContent(UUID.fromString(GOAL), host, rememberAppNavigator()) } }
            }
        }
    }

    private fun waitFor(text: String) = compose.waitUntil(10_000) { compose.onAllNodesWithText(text).fetchSemanticsNodes().isNotEmpty() }

    @Test
    fun aWiderGateUsesTheHeightForItsNewWidth() {
        api.mindMaps = { stopped(Instant.now().plusSeconds(3600)) }
        show()
        waitFor("You've used your mind maps")
        compose.waitForIdle()
        val narrow = compose.onNodeWithText("Other chapters").getBoundsInRoot().top
        compose.runOnIdle { width.value = 700.dp }
        compose.waitForIdle()
        val widened = compose.onNodeWithText("Other chapters").getBoundsInRoot().top
        compose.runOnIdle { visit.value++ }
        compose.waitForIdle()
        val freshWide = compose.onNodeWithText("Other chapters").getBoundsInRoot().top
        assertEquals("A held slot must not retain another width's height", freshWide, widened)
    }
}
