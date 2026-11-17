package com.zoonk.android.feature.activities

import com.zoonk.android.ui.format.formatAmount
import com.zoonk.android.ui.format.isMoneyUnit
import java.util.Locale

internal fun formatGuessAmount(
    value: Double,
    locale: Locale,
    unit: String?,
    compact: Boolean = false,
): String = formatAmount(value, locale, unit.takeIf(::isMoneyUnit), compact)
