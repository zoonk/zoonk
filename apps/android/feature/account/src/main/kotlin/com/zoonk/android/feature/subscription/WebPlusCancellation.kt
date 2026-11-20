package com.zoonk.android.feature.subscription

import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.res.stringResource
import com.zoonk.android.R
import com.zoonk.android.data.Resource
import com.zoonk.android.data.collectShown
import com.zoonk.android.data.value
import com.zoonk.api.models.StripeSubscriptionCancellation

@Composable
internal fun deletionPlusNotices(
    website: Resource<StripeSubscriptionCancellation>,
    provider: String?,
): List<String> {
    val web by website.collectShown()
    return listOfNotNull(
        stringResource(R.string.subscription_deletion_notice).takeIf { web.value != null },
        stringResource(R.string.subscription_deletion_app_store).takeIf { provider == "apple" },
        stringResource(R.string.subscription_deletion_google_play).takeIf { provider == "google" },
    )
}
