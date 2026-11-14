package com.zoonk.android.feature.player

import androidx.activity.ComponentActivity
import androidx.compose.foundation.layout.Column
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.feature.player.engine.LessonRefusal
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.ui.components.Limit
import com.zoonk.android.ui.components.LimitNotice
import com.zoonk.android.ui.components.LimitPeriod
import com.zoonk.android.ui.components.LimitSubject
import com.zoonk.android.ui.components.LimitTier
import com.zoonk.android.ui.theme.ZoonkTheme
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import java.time.Instant

/** E 13.15: once the next free lesson opens, the gate offers it while still open, and only the learner's tap spends it. */
@RunWith(AndroidJUnit4::class)
class FreeLessonGateTest {
    @get:Rule
    val rule = createAndroidComposeRule<ComponentActivity>()

    private fun opensSoon() =
        LessonRefusal.Limited(Limit.Reached(LimitTier.Free, LimitPeriod.Rolling30Days, Instant.now().plusMillis(1_500)))

    private fun waitForReady() =
        rule.waitUntil(10_000) { rule.onAllNodesWithText("Your next free lesson is ready").fetchSemanticsNodes().isNotEmpty() }

    @Test
    fun theGateScreenOffersTheLessonOnceItOpensAndNeverStartsItByItself() {
        var starts = 0
        val refusal = opensSoon()
        rule.setContent {
            ZoonkTheme {
                LessonFrame(title = "Lesson", onClose = {}, bottomBar = lessonAccessBar(refusal, onRetry = { starts++ }, exits = EXITS)) {
                    LessonAccessScreen(refusal, onRetry = { starts++ })
                }
            }
        }

        rule.onNodeWithText("You've used your free lessons").assertExists()
        rule.onNodeWithText("Start the lesson").assertDoesNotExist()

        waitForReady()
        rule.onNodeWithText("Subscribe").assertExists()
        assertEquals(0, starts)

        rule.onNodeWithText("Start the lesson").performClick()
        assertEquals(1, starts)
    }

    @Test
    fun theNoticeInPlaceOffersTheLessonOnceItOpens() {
        var starts = 0
        val writing = LessonWriting.Refused(opensSoon())
        rule.setContent { ZoonkTheme { LessonNotWrittenNotice(writing, onRetry = { starts++ }, onOpen = {}) } }

        rule.onNodeWithText("Start the lesson").assertDoesNotExist()

        waitForReady()
        assertEquals(0, starts)
        rule.onNodeWithText("Start the lesson").performClick()
        assertEquals(1, starts)
    }

    /** E 13.17: a map whose lessons don't fit has its own words, never "You've used your free lessons". */
    @Test
    fun aMapWhoseLessonsDontFitSaysSo() {
        rule.setContent {
            ZoonkTheme {
                Column {
                    LimitNotice(
                        Limit.Reached(LimitTier.Free, LimitPeriod.Total),
                        LimitSubject.MapLessons,
                        onCreateAccount = {},
                        onSubscribe = {},
                    )
                    LimitNotice(
                        Limit.Reached(LimitTier.Free, LimitPeriod.Rolling30Days, Instant.now().minusSeconds(60)),
                        LimitSubject.MapLessons,
                        onCreateAccount = {},
                        onSubscribe = {},
                    )
                }
            }
        }

        rule.onNodeWithText("This map needs a subscription").assertExists()
        rule.onNodeWithText("You can make this map now").assertExists()
        rule.onNodeWithText("You've used your free lessons").assertDoesNotExist()
    }
}

private val EXITS =
    object : LessonPlayerExits {
        override fun close() = Unit

        override fun open(route: AppRoute) = Unit

        override fun replace(route: AppRoute) = Unit
    }
