package com.zoonk.android.feature.warmup

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

@RunWith(AndroidJUnit4::class)
class WaitQuizRestorationTest {
    @get:Rule val rule = createComposeRule()

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
        val warmUps = WarmUpStore({ _, _ -> beekeepingDeck() }, cache, session)
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
        restore.emulateSavedInstanceStateRestore()
        rule.runOnIdle { receiveDeck() }
        rule.waitForIdle()
        rule.runOnIdle {
            assertFalse(quiz.claimShown())
            assertEquals(1, quiz.index)
            assertEquals(answer, quiz.picked)
            assertTrue(quiz.showingProgress)
            quiz.next()
            assertEquals(2, quiz.index)
        }
    }
}
