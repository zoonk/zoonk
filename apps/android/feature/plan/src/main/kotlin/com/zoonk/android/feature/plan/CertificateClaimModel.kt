package com.zoonk.android.feature.plan

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.zoonk.android.data.MutationResult
import com.zoonk.android.feature.certificates.CertificateName
import com.zoonk.android.feature.certificates.CertificateStore
import com.zoonk.android.feature.certificates.naming
import kotlinx.coroutines.launch
import java.util.UUID

/**
 * Main's "Get your certificate" on a finished plan's card, for a course finished without a write
 * that awards it (a plan rewrite, a lesson held back, a plan finished before certificates). A
 * certificate it awards plays its moment; one already shown opens its page.
 */
class CertificateClaimModel(
    private val store: CertificateStore,
    private val goalId: UUID,
) : ViewModel() {
    var claiming by mutableStateOf(false)
        private set

    var failed by mutableStateOf(false)
        private set

    var awarded by mutableStateOf<CertificateName?>(null)
        private set

    fun claim(onShown: (code: String) -> Unit) {
        if (claiming) return
        claiming = true
        failed = false
        viewModelScope.launch {
            when (val result = store.claim(goalId)) {
                is MutationResult.Done -> if (result.value.shownAt == null) awarded = result.value.naming else onShown(result.value.code)
                is MutationResult.Failed -> failed = true
                MutationResult.Obsolete -> Unit
            }
            claiming = false
        }
    }

    fun closeMoment() {
        awarded = null
    }
}
