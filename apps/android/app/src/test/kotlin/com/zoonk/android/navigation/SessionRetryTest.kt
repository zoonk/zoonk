package com.zoonk.android.navigation

import androidx.activity.ComponentActivity
import androidx.compose.material3.Text
import androidx.compose.runtime.getValue
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.R
import com.zoonk.android.app.AppContainer
import com.zoonk.android.data.ANA
import com.zoonk.android.data.ApiError
import com.zoonk.android.data.FakeSessionApi
import com.zoonk.android.data.SessionApi
import com.zoonk.android.data.SessionState
import com.zoonk.android.data.account
import com.zoonk.android.ui.theme.ZoonkTheme
import com.zoonk.api.models.MeResponse
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.cancel
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class SessionRetryTest {
    @get:Rule
    val compose = createAndroidComposeRule<ComponentActivity>()

    @Test
    fun retryRestoresTheAccountAfterTheFailureScreenLeavesComposition() {
        val originalAccount = account(ANA)
        val response = CompletableDeferred<Unit>()
        val cancelled = CompletableDeferred<Unit>()
        val fake =
            FakeSessionApi().apply {
                accounts["preview"] = ANA
                failure = ApiError.Unavailable
                gate = response
            }
        val api =
            object : SessionApi by fake {
                override suspend fun currentUser(token: String): MeResponse =
                    try {
                        fake.currentUser(token)
                    } catch (error: CancellationException) {
                        cancelled.complete(Unit)
                        throw error
                    }
            }
        val context = compose.activity.applicationContext
        val app =
            compose.runOnUiThread {
                AppContainer.preview(context, access = null, account = originalAccount, sessionApi = api)
            }

        try {
            compose.setContent {
                val access by app.learnerAccess.collectAsStateWithLifecycle()
                ZoonkTheme {
                    ShellGate(AppRoute.Mistakes, access, app, rememberAppNavigator()) { Text("Protected content") }
                }
            }

            val retry = compose.onNodeWithText(compose.activity.getString(R.string.load_failed_try_again))
            retry.assertIsDisplayed()
            compose.runOnIdle {
                assertEquals(SessionState.Unavailable, app.sessions.state.value)
                fake.failure = null
            }
            retry.performClick()
            retry.assertDoesNotExist()
            compose.runOnIdle {
                assertEquals(SessionState.Restoring, app.sessions.state.value)
                assertFalse("Leaving the failure screen cancelled session validation", cancelled.isCompleted)
                response.complete(Unit)
            }

            compose.onNodeWithText("Protected content").assertIsDisplayed()
            assertEquals(originalAccount, (app.sessions.state.value as? SessionState.SignedIn)?.account)
        } finally {
            app.scope.cancel()
        }
    }
}
