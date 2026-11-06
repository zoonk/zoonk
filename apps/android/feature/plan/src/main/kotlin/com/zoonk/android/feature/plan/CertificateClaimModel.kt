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
import com.zoonk.api.models.OwnedCertificate
import kotlinx.coroutines.launch
import java.util.UUID

/**
 * Main's "Get your certificate" on a plan's card, for units finished without a write that awards
 * them (a plan rewrite, a lesson held back, a plan finished before certificates). The certificates
 * it returns that never played their moment play it now; when all of them did, [claim] hands them
 * back to open.
 */
class CertificateClaimModel(
    private val store: CertificateStore,
    private val goalId: UUID,
) : ViewModel() {
    var claiming by mutableStateOf(false)
        private set

    var failed by mutableStateOf(false)
        private set

    var awarded by mutableStateOf<List<CertificateName>>(emptyList())
        private set

    fun claim(onShown: (List<OwnedCertificate>) -> Unit) {
        if (claiming) return
        claiming = true
        failed = false
        viewModelScope.launch {
            when (val result = store.claim(goalId)) {
                is MutationResult.Done -> {
                    val unshown = result.value.filter { it.shownAt == null }
                    if (unshown.isEmpty()) onShown(result.value) else awarded = unshown.map { it.naming }
                }

                is MutationResult.Failed -> {
                    failed = true
                }

                MutationResult.Obsolete -> {}
            }
            claiming = false
        }
    }

    fun closeMoment() {
        awarded = emptyList()
    }
}
