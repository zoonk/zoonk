package com.zoonk.android.feature.certificates

import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import com.zoonk.android.R
import com.zoonk.android.feature.subscription.PlusNotice

/** The Plus notice beside a locked certificate, on its moment and its page; the Certificates page passes its own [title]. */
@Composable
fun CertificatesPlusNotice(
    onSeePlus: () -> Unit,
    modifier: Modifier = Modifier,
    title: String = stringResource(R.string.certificates_plus_title),
) {
    PlusNotice(
        onSeePlus = onSeePlus,
        modifier = modifier,
        title = title,
        description = stringResource(R.string.certificates_plus_description),
    )
}
