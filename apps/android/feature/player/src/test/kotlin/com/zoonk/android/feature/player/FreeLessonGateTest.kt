package com.zoonk.android.feature.player

import androidx.activity.ComponentActivity
import androidx.compose.foundation.layout.Column
import androidx.compose.material3.Text
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.test.getBoundsInRoot
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.unit.height
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.feature.player.engine.LessonRefusal
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.ui.components.Limit
import com.zoonk.android.ui.components.LimitNotice
import com.zoonk.android.ui.components.LimitPeriod
import com.zoonk.android.ui.components.LimitSubject
import com.zoonk.android.ui.components.LimitTier
import com.zoonk.android.ui.components.LocalClock
import com.zoonk.android.ui.components.TestClock
import com.zoonk.android.ui.theme.ZoonkTheme
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.annotation.Config

/** E 13.15: once the next free lesson opens, the gate offers it while still open, and only the learner's tap spends it. */
@RunWith(AndroidJUnit4::class)
class FreeLessonGateTest {
    @get:Rule
    val rule = createAndroidComposeRule<ComponentActivity>()

    private fun waitForReady() =
        rule.waitUntil(10_000) { rule.onAllNodesWithText("Your next free lesson is ready").fetchSemanticsNodes().isNotEmpty() }

    @Test
    fun theGateScreenOffersTheLessonOnceItOpensAndNeverStartsItByItself() {
        var starts = 0
        val refusal = LessonRefusal.Limited(Limit.Reached(LimitTier.Free, LimitPeriod.Rolling30Days, clock.opening))
        rule.setContent {
            CompositionLocalProvider(LocalClock provides clock) {
                ZoonkTheme {
                    LessonFrame(
                        title = "Lesson",
                        onClose = {},
                        bottomBar = lessonAccessBar(refusal, onRetry = { starts++ }, exits = EXITS),
                    ) {
                        LessonAccessScreen(refusal, onRetry = { starts++ })
                    }
                }
            }
        }

        rule.onNodeWithText("You've used your free lessons").assertExists()
        rule.onNodeWithText("Start the lesson").assertDoesNotExist()
        val title = rule.onNodeWithText("You've used your free lessons").getBoundsInRoot().top

        clock.passOpening()
        waitForReady()
        // The gate sits at the top of its page, so its icon and title stay where they were.
        assertEquals(title, rule.onNodeWithText("Your next free lesson is ready").getBoundsInRoot().top)
        rule.onNodeWithText("Subscribe").assertDoesNotExist()
        assertEquals(0, starts)

        rule.onNodeWithText("Start the lesson").performClick()
        assertEquals(1, starts)
    }

    private val clock by lazy { TestClock(rule.mainClock) }

    private fun showNoticeInPlace(onRetry: () -> Unit = {}) {
        val writing = LessonWriting.Refused(LessonRefusal.Limited(Limit.Reached(LimitTier.Free, LimitPeriod.Rolling30Days, clock.opening)))
        rule.setContent {
            CompositionLocalProvider(LocalClock provides clock) {
                ZoonkTheme {
                    Column {
                        LessonNotWrittenNotice(writing, onRetry = onRetry, onOpen = {})
                        Text(BELOW)
                    }
                }
            }
        }
    }

    /** As main: Start the lesson takes Subscribe's box once the lesson opens, Subscribe goes, and nothing under the notice moves. */
    @Test
    fun theNoticeInPlaceOffersTheLessonWhereSubscribeWasOnceItOpens() {
        var starts = 0
        showNoticeInPlace(onRetry = { starts++ })
        rule.onNodeWithText("Start the lesson").assertDoesNotExist()
        val below = rule.onNodeWithText(BELOW).getBoundsInRoot().top
        val subscribe = rule.onNodeWithText("Subscribe").getBoundsInRoot()

        clock.passOpening()
        waitForReady()

        val start = rule.onNodeWithText("Start the lesson").getBoundsInRoot()
        assertEquals(subscribe.left to subscribe.top, start.left to start.top)
        rule.onNodeWithText("Subscribe").assertDoesNotExist()
        assertEquals(below, rule.onNodeWithText(BELOW).getBoundsInRoot().top)
        assertEquals(0, starts)
        rule.onNodeWithText("Start the lesson").performClick()
        assertEquals(1, starts)
    }

    /** On the narrowest phone, in Spanish (the longest words), Start takes Subscribe's box whole. */
    @Test
    @Config(qualifiers = "es-w320dp-h640dp")
    fun startTakesSubscribesBoxAtTheNarrowestWidthInItsLongestLanguage() {
        showNoticeInPlace()
        val subscribe = rule.onNodeWithText("Suscribirse").getBoundsInRoot()

        clock.passOpening()
        rule.waitUntil(10_000) { rule.onAllNodesWithText("Empezar la lección").fetchSemanticsNodes().isNotEmpty() }

        val start = rule.onNodeWithText("Empezar la lección").getBoundsInRoot()
        assertEquals(subscribe.left to subscribe.top, start.left to start.top)
        assertEquals(subscribe.height, start.height)
    }

    /** Once a cap's day comes while its notice shows, the notice is the one sentence "You can try again now.". */
    @Test
    fun aLiftedNoticeIsOneSentenceWithoutTitleOrSubscribe() {
        rule.setContent {
            CompositionLocalProvider(LocalClock provides clock) {
                ZoonkTheme {
                    LimitNotice(Limit.Reached(LimitTier.Free, LimitPeriod.Rolling30Days, clock.opening), LimitSubject.Messages, {}, {})
                }
            }
        }
        rule.onNodeWithText("You've used your messages").assertExists()

        clock.passOpening()
        rule.waitUntil(10_000) { rule.onAllNodesWithText("You can try again now.").fetchSemanticsNodes().isNotEmpty() }
        rule.onNodeWithText("You've used your messages").assertDoesNotExist()
        rule.onNodeWithText("Subscribe").assertDoesNotExist()
    }

    /** E 13.17: a map whose lessons don't fit has its own words, never "You've used your free lessons". */
    @Test
    fun aMapWhoseLessonsDontFitSaysSo() {
        rule.setContent {
            CompositionLocalProvider(LocalClock provides clock) {
                ZoonkTheme {
                    Column {
                        LimitNotice(
                            Limit.Reached(LimitTier.Free, LimitPeriod.Total),
                            LimitSubject.MapLessons,
                            onCreateAccount = {},
                            onSubscribe = {},
                        )
                        LimitNotice(
                            Limit.Reached(LimitTier.Free, LimitPeriod.Rolling30Days, clock.start.minusSeconds(60)),
                            LimitSubject.MapLessons,
                            onCreateAccount = {},
                            onSubscribe = {},
                        )
                    }
                }
            }
        }

        rule.onNodeWithText("This map needs a subscription").assertExists()
        rule.onNodeWithText("You can make this map now").assertExists()
        rule.onNodeWithText("You've used your free lessons").assertDoesNotExist()
    }
}

private const val BELOW = "What comes next"

private val EXITS =
    object : LessonPlayerExits {
        override fun close() = Unit

        override fun open(route: AppRoute) = Unit

        override fun replace(route: AppRoute) = Unit
    }
