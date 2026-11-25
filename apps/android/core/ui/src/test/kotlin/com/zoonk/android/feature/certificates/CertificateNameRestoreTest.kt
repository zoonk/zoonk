package com.zoonk.android.feature.certificates

import androidx.compose.foundation.text.input.setTextAndPlaceCursorAtEnd
import androidx.lifecycle.SavedStateHandle
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.DraftStore
import com.zoonk.android.data.FakeSessionApi
import com.zoonk.android.data.MemoryCredentials
import com.zoonk.android.data.SessionStore
import com.zoonk.android.feature.account.AccountStore
import com.zoonk.android.feature.account.FakeAccountApi
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import org.junit.runner.RunWith

/** The name being typed comes back after Android reclaims the app's process. */
@RunWith(AndroidJUnit4::class)
class CertificateNameRestoreTest {
    @get:Rule
    val folder = TemporaryFolder()

    @Test
    fun theNameBeingTypedSurvivesAReclaimedProcess() {
        val main = CoroutineScope(SupervisorJob() + Dispatchers.Unconfined)
        val sessions = SessionStore(FakeSessionApi(), MemoryCredentials(), DraftStore(folder.root, main), { _, _ -> }, {})
        val account = AccountStore(FakeAccountApi(), sessions, AppCache(sessions, main))
        val saved = SavedStateHandle()
        val model = CertificateNameModel(account, saved)
        model.change("Ana")
        model.field.setTextAndPlaceCursorAtEnd("Ana Lima")

        val restored = CertificateNameModel(account, SavedStateHandle.createHandle(saved.savedStateProvider().saveState(), null))

        assertEquals("Ana Lima", restored.name)
        assertTrue(restored.changing)
    }
}
