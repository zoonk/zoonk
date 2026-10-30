package com.zoonk.android.feature.missions

import androidx.activity.ComponentActivity
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.width
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.SemanticsActions
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.text.TextLayoutResult
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.dp
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.feature.session.DayMission
import com.zoonk.android.ui.characters.BuddyLook
import com.zoonk.android.ui.theme.ZoonkTheme
import com.zoonk.api.models.StudyMission
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode

@RunWith(AndroidJUnit4::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(qualifiers = "w411dp-h891dp")
class MissionsCardWrapTest {
    @get:Rule
    val compose = createAndroidComposeRule<ComponentActivity>()

    @Test
    fun theMissionsLineNeverStartsALineWithItsSeparatorAtTwiceTheFontSize() {
        var width by mutableStateOf(411.dp)
        compose.setContent {
            val density = LocalDensity.current
            CompositionLocalProvider(LocalDensity provides Density(density.density, fontScale = 2f)) {
                ZoonkTheme {
                    Box(Modifier.width(width)) {
                        MissionsCard(MISSIONS, bonus = 50, bonusEarned = false, buddy = BuddyLook(), buddyName = "Zu", onOpen = {})
                    }
                }
            }
        }

        val lines =
            (WIDTHS step 2).map { dp ->
                width = dp.dp
                compose.waitForIdle()
                val layout = textLayout()
                dp to
                    (0 until layout.lineCount).map {
                        layout.layoutInput.text.text.substring(
                            layout.getLineStart(it),
                            layout.getLineEnd(it),
                        )
                    }
            }

        assertTrue(lines.any { (_, wrapped) -> wrapped.size > 1 })
        assertEquals(
            emptyList<String>(),
            lines.flatMap { (dp, wrapped) ->
                wrapped.filter { it.trimStart().startsWith("·") }.map { "$dp dp: $it" }
            },
        )
    }

    private fun textLayout(): TextLayoutResult {
        val results = mutableListOf<TextLayoutResult>()
        compose
            .onNodeWithText("left", substring = true)
            .fetchSemanticsNode()
            .config[SemanticsActions.GetTextLayoutResult]
            .action
            ?.invoke(results)
        return results.single()
    }

    private companion object {
        // Narrower, the card leaves the line less room than a word and its separator, so words break anyway.
        val WIDTHS = 266..411

        val MISSIONS =
            listOf(
                mission(StudyMission.Kind.REVIEW, done = false, minutes = 1.0),
                mission(StudyMission.Kind.ASK_BUDDY, done = true, minutes = null),
                mission(StudyMission.Kind.ESSAY, done = false, minutes = 20.0),
            )

        fun mission(
            kind: StudyMission.Kind,
            done: Boolean,
            minutes: Double?,
        ) = DayMission(
            kind,
            done,
            progress = if (done) 1 else 0,
            total = 1,
            minutes,
            firstStep = false,
            waitReason = null,
            detail = null,
            opens = null,
        )
    }
}
