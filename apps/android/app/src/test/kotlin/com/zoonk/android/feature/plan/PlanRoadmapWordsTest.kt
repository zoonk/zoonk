package com.zoonk.android.feature.plan

import androidx.activity.ComponentActivity
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.annotation.Config
import java.time.LocalDate

@RunWith(AndroidJUnit4::class)
@Config(qualifiers = "es")
class PlanRoadmapWordsTest {
    @get:Rule
    val compose = createAndroidComposeRule<ComponentActivity>()

    private val today = LocalDate.of(2026, 10, 30)

    private fun until(finish: PlanFinish): String {
        var said = ""
        compose.setContent { said = roadmapUntil(finish, today) }
        compose.waitForIdle()
        return said
    }

    @Test
    fun anEstimatedEndSaysAboutInsideTheSentence() {
        assertEquals("Hasta aproximadamente el 3 nov", until(PlanFinish(LocalDate.of(2026, 11, 3), estimate = true, month = false)))
    }

    @Test
    fun anEstimatedEndByMonthSaysAboutInsideTheSentence() {
        assertEquals("Hasta aproximadamente mar", until(PlanFinish(LocalDate.of(2027, 3, 1), estimate = true, month = true)))
    }
}
