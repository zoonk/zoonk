package com.zoonk.android.feature.certificates

import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import com.zoonk.android.R
import com.zoonk.android.data.AnalyticsEvent
import com.zoonk.android.data.TrackShown
import com.zoonk.android.feature.subscription.SubscribeGate
import com.zoonk.android.ui.components.ModalBottomSheet
import com.zoonk.android.ui.scaffold.pagePadding

/** A certificate that needs a subscription, tried from the list or the award moment: the gate in a sheet; closing it goes back. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CertificateGateSheet(
    onSubscribe: () -> Unit,
    onDismiss: () -> Unit,
) {
    ModalBottomSheet(onDismissRequest = onDismiss) {
        TrackShown(AnalyticsEvent.SubscriptionGateShown)
        SubscribeGate(
            title = stringResource(R.string.certificates_gate_title),
            onSubscribe = onSubscribe,
            modifier = Modifier.padding(pagePadding()).navigationBarsPadding(),
        )
    }
}
