package com.zoonk.android.feature.plan

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.zoonk.android.data.MutationResult
import com.zoonk.android.data.VisitOutcomes
import com.zoonk.android.feature.certificates.CertificateName
import com.zoonk.android.feature.certificates.CertificateStore
import com.zoonk.android.feature.certificates.naming
import kotlinx.coroutines.launch
import java.util.UUID

/**
 * Main's "Get your certificate" on a plan's card, for units finished without a write that awards
 * them (a plan rewrite, a lesson held back, a plan finished before certificates). The certificates
 * it returns that never played their moment play it now; when all of them did, [opened] hands their codes
 * to whichever screen shows the Plan then, so a layout change while the claim is out can't drop them. A claim
 * that lands after the learner left the Plan opens nothing; its certificates are claimed all the same.
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

    /** The codes of certificates a claim found already shown, to open. */
    val opened = VisitOutcomes<List<String>>()

    fun claim() {
        if (claiming) return
        claiming = true
        failed = false
        val visit = opened.visit
        viewModelScope.launch {
            when (val result = store.claim(goalId)) {
                is MutationResult.Done -> {
                    val unshown = result.value.filter { it.shownAt == null }
                    when {
                        unshown.isEmpty() -> opened.send(visit, result.value.map { it.code })
                        visit == opened.visit -> awarded = unshown.map { it.naming }
                    }
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
