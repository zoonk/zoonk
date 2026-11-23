package com.zoonk.android.feature.onboarding.setup

import androidx.compose.foundation.layout.width
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.ui.components.Meter

/** Main's bar middle in setup and its tests (`onboarding-bar.tsx`): how far the learner is, where a title would sit. */
internal val BAR_PROGRESS_WIDTH = 96.dp
internal val BAR_PROGRESS_HEIGHT = 4.dp

/** Main's `TestProgress`: the share of a test answered ([share], 0 to 1), in the step dots' place. */
@Composable
internal fun TestProgress(share: Float) {
    Meter(
        share = share,
        modifier = Modifier.width(BAR_PROGRESS_WIDTH),
        color = MaterialTheme.colorScheme.onSurface,
        height = BAR_PROGRESS_HEIGHT,
        contentDescription = stringResource(R.string.onboarding_placement_progress),
    )
}
