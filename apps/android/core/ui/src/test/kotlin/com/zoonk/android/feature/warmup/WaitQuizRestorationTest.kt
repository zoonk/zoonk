package com.zoonk.android.feature.warmup

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.test.junit4.StateRestorationTester
import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.FakeSession
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.Robolectric

@RunWith(AndroidJUnit4::class)
class WaitQuizRestorationTest {
    @get:Rule val rule = createComposeRule()

    @Test
    fun processDeathOnTodayKeepsThePlanWaitClaimForLessonOne() {
        val session = FakeSession(AuthenticatedSession("ana", "token", "local"))

        fun store() =
            WarmUpStore(
                { _, _ -> beekeepingDeck() },
                AppCache(session, CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)),
                session,
            )
        val first = store()
        val activity = Robolectric.buildActivity(ComponentActivity::class.java).setup()
        first.registerSavedState(activity.get().savedStateRegistry)
        assertTrue(first.claimShown(WARM_UP_ID))
        first.answered(WARM_UP_ID, 0)
        val saved = Bundle()
        activity
            .pause()
            .saveInstanceState(saved)
            .stop()
            .destroy()
        val restoredActivity =
            Robolectric
                .buildActivity(ComponentActivity::class.java)
                .create(saved)
                .start()
                .resume()
        val restored = store()
        restored.registerSavedState(restoredActivity.get().savedStateRegistry)
        lateinit var lesson: WaitQuizState
        rule.setContent { lesson = rememberWaitQuiz(WARM_UP_ID, restored) }
        rule.waitForIdle()
        rule.runOnIdle {
            assertFalse(lesson.claimShown())
            assertEquals(1, lesson.index)
        }
        restoredActivity.pause().stop().destroy()
    }

    @Test
    fun aClaimedDeckOpensTheQuizBeforeItsCardsArrive() {
        lateinit var quiz: WaitQuizState
        rule.setContent { quiz = rememberWaitQuiz(null, null, coming = true) }
        rule.runOnIdle {
            quiz.open()
            org.junit.Assert.assertFalse(quiz.showingProgress)
            assertTrue(quiz.visitedQuiz)
            quiz.receive(null, coming = false)
            assertTrue(quiz.showingProgress)
        }
    }

    @Test
    fun aColdRunReplayKeepsTheAnsweredCardAndViewAndContinuesFromIt() {
        val restore = StateRestorationTester(rule)
        val session = FakeSession(AuthenticatedSession("ana", "token", "local"))
        val cache = AppCache(session, CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate))
        var warmUps = WarmUpStore({ _, _ -> beekeepingDeck() }, cache, session)
        val activity = Robolectric.buildActivity(ComponentActivity::class.java).setup()
        warmUps.registerSavedState(activity.get().savedStateRegistry)
        lateinit var quiz: WaitQuizState
        lateinit var hold: ReadyHold
        lateinit var receiveDeck: () -> Unit
        restore.setContent {
            var id by remember { mutableStateOf<String?>(null) }
            receiveDeck = { id = WARM_UP_ID }
            quiz = rememberWaitQuiz(id, warmUps)
            hold = rememberReadyHold(false)
        }
        rule.runOnIdle { receiveDeck() }
        rule.waitForIdle()
        rule.runOnIdle {
            assertTrue(quiz.claimShown())
            quiz.showQuiz(hold)
            quiz.pick(quiz.card!!.options.first(), hold)
            quiz.next()
            quiz.pick(quiz.card!!.options.last(), hold)
            quiz.showProgress(hold)
        }
        val answer = quiz.picked
        val saved = Bundle()
        activity
            .pause()
            .saveInstanceState(saved)
            .stop()
            .destroy()
        val restoredActivity =
            Robolectric
                .buildActivity(ComponentActivity::class.java)
                .create(saved)
                .start()
                .resume()
        warmUps =
            WarmUpStore(
                { _, _ -> beekeepingDeck() },
                AppCache(session, CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)),
                session,
            )
        warmUps.registerSavedState(restoredActivity.get().savedStateRegistry)
        restore.emulateSavedInstanceStateRestore()
        rule.runOnIdle { receiveDeck() }
        rule.waitForIdle()
        rule.runOnIdle {
            assertFalse(quiz.claimShown())
            assertFalse(warmUps.claimShown(WARM_UP_ID))
            assertEquals(1, quiz.index)
            assertEquals(answer, quiz.picked)
            assertTrue(quiz.showingProgress)
            quiz.next()
            assertEquals(2, quiz.index)
        }
        restoredActivity.pause().stop().destroy()
    }
}
