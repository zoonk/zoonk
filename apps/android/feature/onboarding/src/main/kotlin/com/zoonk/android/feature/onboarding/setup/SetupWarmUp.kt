package com.zoonk.android.feature.onboarding.setup

import androidx.compose.runtime.Composable
import androidx.compose.runtime.compositionLocalOf
import com.zoonk.android.data.AnalyticsEvent
import com.zoonk.android.feature.warmup.ReadyHold
import com.zoonk.android.feature.warmup.WarmUpCard
import com.zoonk.android.feature.warmup.WarmUpStore

internal val LocalSetupWarmUp = compositionLocalOf<WarmUpStore?> { null }

@Composable
internal fun SetupWarmUpCard(
    warmUpId: String?,
    surface: AnalyticsEvent.WarmUpSurface,
    hold: ReadyHold,
) {
    val warmUps = LocalSetupWarmUp.current ?: return
    WarmUpCard(warmUpId, warmUps, surface, hold)
}
