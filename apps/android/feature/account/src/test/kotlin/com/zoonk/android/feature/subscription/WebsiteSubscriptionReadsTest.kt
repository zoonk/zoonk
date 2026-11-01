package com.zoonk.android.feature.subscription

import androidx.compose.material3.Text
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.data.ANA
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.CountingApi
import com.zoonk.android.data.DraftStore
import com.zoonk.android.data.FakeSessionApi
import com.zoonk.android.data.MemoryCredentials
import com.zoonk.android.data.SessionStore
import com.zoonk.android.data.StoredSession
import com.zoonk.android.data.collectShown
import com.zoonk.android.data.settle
import com.zoonk.android.navigation.rememberAppNavigator
import com.zoonk.android.ui.theme.ZoonkTheme
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.runBlocking
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class WebsiteSubscriptionReadsTest {
    @get:Rule val rule = createComposeRule()

    @get:Rule val folder = TemporaryFolder()
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)
    private val api = CountingApi(mapOf(PATH to """{"state":"unpaid","periodEnd":null}"""))

    @After
    fun close() {
        scope.cancel()
        api.close()
    }

    @Test
    fun subscriptionAndAccountDeletionShareOneWebsiteRead() {
        val session = AuthenticatedSession(ANA, "token-a", "local-a")
        val sessions =
            SessionStore(
                FakeSessionApi().apply { accounts += "token-a" to ANA },
                MemoryCredentials(StoredSession(session)),
                DraftStore(folder.root, scope),
                onChange = { _, _ -> },
                clearCredentialState = {},
            )
        runBlocking { sessions.restore() }
        val store =
            SubscriptionStore(
                LiveSubscriptionApi(api.clients),
                FakePlayBilling(),
                sessions,
                AppCache(sessions, scope),
                scope,
                MutableStateFlow(false),
            )
        var profile by mutableStateOf(false)
        rule.setContent {
            ZoonkTheme {
                if (profile) {
                    webPlusDeletionNotice(store.websiteSubscription)?.let { Text(it) }
                } else {
                    val state by store.websiteSubscription.collectShown()
                    val cancellation = WebPlusCancellationViewModel(store::cancelWebPlus, store::keepWebPlus)
                    AccountPlans(null, state, rememberAppNavigator(), cancellation, {}, {})
                }
            }
        }
        rule.settle(store.websiteSubscription)
        rule.onNodeWithText("Your last renewal payment failed.").assertExists()
        rule.runOnIdle { profile = true }
        rule.settle(store.websiteSubscription)
        rule.onNodeWithText("Deleting your account ends Plus right away.").assertExists()
        rule.runOnIdle { profile = false }
        rule.settle(store.websiteSubscription)

        assertEquals(1, api.requests(PATH))
    }

    private companion object {
        const val PATH = "/me/subscriptions/stripe/cancellation"
    }
}
