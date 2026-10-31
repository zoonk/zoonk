package com.zoonk.android.data

import android.content.pm.ActivityInfo
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.material3.Text
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveableStateHolder
import androidx.compose.runtime.setValue
import androidx.compose.ui.test.junit4.ComposeTestRule
import androidx.compose.ui.test.junit4.v2.createEmptyComposeRule
import androidx.test.core.app.ActivityScenario
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RuntimeEnvironment
import org.robolectric.Shadows.shadowOf

@RunWith(AndroidJUnit4::class)
class TrackShownTest {
    @get:Rule
    val rule: ComposeTestRule = createEmptyComposeRule()

    private lateinit var scenario: ActivityScenario<TrackShownActivity>

    @Before
    fun register() {
        val application = RuntimeEnvironment.getApplication()
        shadowOf(application.packageManager).addOrUpdateActivity(
            ActivityInfo().apply {
                name = TrackShownActivity::class.java.name
                packageName = application.packageName
            },
        )
        TrackShownHost.sent.clear()
        TrackShownHost.shown = true
        TrackShownHost.recompositions = 0
    }

    @After
    fun close() = scenario.close()

    @Test
    fun aScreenCountsOnceEachTimeItComesOnScreenAsWhenItsTabIsShownAgain() {
        scenario = ActivityScenario.launch(TrackShownActivity::class.java)
        rule.waitForIdle()
        TrackShownHost.recompositions++
        rule.waitForIdle()

        TrackShownHost.shown = false
        rule.waitForIdle()
        TrackShownHost.shown = true
        rule.waitForIdle()

        assertEquals(listOf(AnalyticsEvent.TodayViewed, AnalyticsEvent.TodayViewed), TrackShownHost.sent)
    }

    @Test
    fun rotatingDoesNotCountItAgain() {
        scenario = ActivityScenario.launch(TrackShownActivity::class.java)
        rule.waitForIdle()

        scenario.recreate()
        rule.waitForIdle()

        assertEquals(listOf(AnalyticsEvent.TodayViewed), TrackShownHost.sent)
    }
}

/** Outlives [TrackShownActivity]'s recreations. */
object TrackShownHost {
    val sent = mutableListOf<AnalyticsEvent>()
    var shown by mutableStateOf(true)
    var recompositions by mutableIntStateOf(0)
}

/** Keeps a screen's saved state while it's hidden, as the navigation's back stacks do for another tab. */
class TrackShownActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            val holder = rememberSaveableStateHolder()
            CompositionLocalProvider(LocalEventTracker provides EventTracker(TrackShownHost.sent::add)) {
                if (TrackShownHost.shown) {
                    holder.SaveableStateProvider("today") {
                        Text("${TrackShownHost.recompositions}")
                        TrackShown(AnalyticsEvent.TodayViewed)
                    }
                }
            }
        }
    }
}
