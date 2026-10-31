package com.zoonk.android.app

import androidx.activity.ComponentActivity
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.test.SemanticsMatcher
import androidx.compose.ui.test.assert
import androidx.compose.ui.test.hasClickAction
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.api.models.LearnerSummaryMissions
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.annotation.Config

/** Material's navigation items hide their icon from TalkBack, so the Buddy item itself says the ring's missions. */
@RunWith(AndroidJUnit4::class)
class BuddyTabTest {
    @get:Rule
    val rule = createAndroidComposeRule<ComponentActivity>()

    private var summary by mutableStateOf(everyPlace.copy(buddy = everyPlace.buddy.copy(name = "Pip")))

    @Before
    fun show() {
        rule.setContent { ShellTestHost(summary) }
    }

    private fun buddyTab() = rule.onNode(hasText("Pip") and hasClickAction())

    private fun assertSaysMissions() {
        summary = summary.copy(missions = LearnerSummaryMissions(done = 1, total = 3))

        buddyTab().assert(SemanticsMatcher.expectValue(SemanticsProperties.StateDescription, "1 of 3 missions today"))
    }

    @Test
    @Config(qualifiers = "w411dp-h891dp")
    fun theBarSaysTodaysMissionsAfterTheBuddysName() = assertSaysMissions()

    @Test
    @Config(qualifiers = "w700dp-h1000dp")
    fun theRailSaysTodaysMissionsAfterTheBuddysName() = assertSaysMissions()

    @Test
    @Config(qualifiers = "w1280dp-h800dp-land")
    fun theDrawerSaysTodaysMissionsAfterTheBuddysName() = assertSaysMissions()

    @Test
    @Config(qualifiers = "w411dp-h891dp")
    fun aDayWithoutMissionsSaysOnlyTheName() {
        buddyTab().assert(SemanticsMatcher.keyNotDefined(SemanticsProperties.StateDescription))
    }
}
