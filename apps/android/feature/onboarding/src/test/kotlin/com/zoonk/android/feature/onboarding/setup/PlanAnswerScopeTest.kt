package com.zoonk.android.feature.onboarding.setup

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.Audience
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.FakeSession
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.serialization.builtins.serializer
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class PlanAnswerScopeTest {
    @get:Rule val rule = createComposeRule()

    @Test
    fun anAnswerFromThePreviousAimIsHiddenWhileTheNewOneIsPending() {
        val session = FakeSession(AuthenticatedSession("ana", "token", "local"))
        val cache = AppCache(session, CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate))
        val next = CompletableDeferred<String>()
        val reads = cache.keyed<String, String>(Audience.SignedIn) { _, aim -> if (aim == "B1") "November 2029" else next.await() }
        var aim by mutableStateOf("B1")
        lateinit var answer: PlanAnswer<String>
        rule.setContent {
            answer = rememberPlanAnswer(reads, aim, true, false, false, String.serializer(), String.serializer(), { true }, scope = { it })
        }
        rule.waitForIdle()
        rule.runOnIdle { assertEquals("November 2029", answer.last) }
        rule.runOnIdle { aim = "B2" }
        rule.mainClock.advanceTimeBy(1_000)
        rule.waitForIdle()
        rule.runOnIdle { assertNull(answer.last) }
        next.complete("April 2031")
        rule.waitUntil(5_000) { answer.last == "April 2031" }
        rule.runOnIdle { assertEquals("April 2031", answer.last) }
    }
}
