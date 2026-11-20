package com.zoonk.android.feature.plan

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.zoonk.android.data.MutationResult
import com.zoonk.android.data.Visit
import com.zoonk.android.feature.certificates.CertificateName
import com.zoonk.android.feature.certificates.CertificateStore
import com.zoonk.android.feature.certificates.naming
import kotlinx.coroutines.launch
import java.util.UUID

/**
 * Main's "Get your certificate" on a plan's card, for units finished without a write that awards
 * them (a plan rewrite, a lesson held back, a plan finished before certificates). The certificates
 * it returns that never played their moment play it now; when all of them did, [opened] holds their codes
 * for the screen to open. What a claim leads to (the certificate, its moment, its failure) belongs to the
 * visit that asked: a layout change while it's out still shows it, and leaving the Plan first shows nothing,
 * though its certificates are claimed all the same.
 */
class CertificateClaimModel(
    private val store: CertificateStore,
    private val goalId: UUID,
) : ViewModel() {
    var claiming by mutableStateOf(false)
        private set

    val visit = Visit()

    /** The codes of certificates a claim found already shown, to open. */
    val opened = visit.outcome<List<String>>()
    private val moment = visit.outcome<List<CertificateName>>()
    private val failure = visit.outcome<Unit>()

    val failed get() = failure.value != null
    val awarded get() = moment.value.orEmpty()

    fun claim() {
        if (claiming) return
        claiming = true
        failure.clear()
        val started = visit.number
        viewModelScope.launch {
            when (val result = store.claim(goalId)) {
                is MutationResult.Done -> {
                    val unshown = result.value.filter { it.shownAt == null }
                    if (unshown.isEmpty()) {
                        opened.send(
                            started,
                            result.value.map { it.code },
                        )
                    } else {
                        moment.send(started, unshown.map { it.naming })
                    }
                }

                is MutationResult.Failed -> {
                    failure.send(started, Unit)
                }

                MutationResult.Obsolete -> {}
            }
            claiming = false
        }
    }

    fun closeMoment() = moment.clear()
}
