package com.zoonk.android.feature.plan

import androidx.activity.ComponentActivity
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.semantics.getOrNull
import androidx.compose.ui.test.hasContentDescription
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.navigation.rememberAppNavigator
import com.zoonk.android.ui.theme.ZoonkTheme
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.annotation.Config

@RunWith(AndroidJUnit4::class)
@Config(qualifiers = "w700dp-h900dp")
class PlanRoadmapSpokenTest {
    @get:Rule
    val compose = createAndroidComposeRule<ComponentActivity>()

    /** Like main's band, TalkBack reads each band's name, state and end once, from its label alone, never its name again after it. */
    @Test
    fun eachBandSaysItsNameOnce() {
        val page = learnerSummary().let { PlanPageState(it.goals.first(), learnPlan(), it) }
        compose.setContent { ZoonkTheme { PlanRoadmap(page, PlanLinks(rememberAppNavigator(), page)) } }

        val band =
            compose
                .onNode(
                    hasContentDescription("Data structures, you are here, Ends", substring = true),
                ).fetchSemanticsNode()
                .config

        assertEquals(null, band.getOrNull(SemanticsProperties.Text))
    }
}
