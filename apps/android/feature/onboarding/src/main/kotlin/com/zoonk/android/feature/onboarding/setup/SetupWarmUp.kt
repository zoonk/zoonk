package com.zoonk.android.feature.onboarding.setup

import androidx.compose.runtime.Composable
import androidx.compose.runtime.compositionLocalOf
import com.zoonk.android.data.AnalyticsEvent
import com.zoonk.android.feature.warmup.ReadyHold
import com.zoonk.android.feature.warmup.WarmUpCard
import com.zoonk.android.feature.warmup.WarmUpStore
import com.zoonk.api.models.Goal

internal data class SetupWarmUp(
    val store: WarmUpStore,
    val goalKind: Goal.Kind,
)

internal val LocalSetupWarmUp = compositionLocalOf<SetupWarmUp?> { null }

@Composable
internal fun SetupWarmUpCard(
    warmUpId: String?,
    surface: AnalyticsEvent.WarmUpSurface,
    hold: ReadyHold,
) {
    val warmUp = LocalSetupWarmUp.current ?: return
    WarmUpCard(warmUpId, warmUp.store, surface, hold, goalKind = warmUp.goalKind)
}
