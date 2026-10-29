package com.zoonk.android.feature.conversation

import androidx.activity.ComponentActivity
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.test.ext.junit.runners.AndroidJUnit4
import kotlinx.coroutines.CompletableDeferred
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import java.util.UUID

@RunWith(AndroidJUnit4::class)
class OpenStartedCallTest {
    @get:Rule
    val compose = createAndroidComposeRule<ComponentActivity>()

    private val call = UUID.fromString("00000000-0000-4000-8000-0000000000c2")

    @Test
    fun aCallThatStartsWhileItsScreenIsGoneOpensFromTheNextOneOnce() {
        val answer = CompletableDeferred<CallStart>()
        val model = CallStartModel { answer.await() }
        val opened = mutableListOf<UUID>()
        var shown by mutableStateOf(true)
        compose.setContent { if (shown) OpenStartedCall(model) { opened += it } }

        compose.runOnIdle { model.start(CallRequest.SpeakingMock(UUID.randomUUID())) }
        shown = false
        compose.waitForIdle()
        answer.complete(CallStart.Started(call))
        compose.waitForIdle()
        assertEquals(emptyList<UUID>(), opened)

        shown = true
        compose.waitForIdle()

        assertEquals(listOf(call), opened)
        assertNull(model.started)
    }
}
