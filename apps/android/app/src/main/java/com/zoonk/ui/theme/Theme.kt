package com.zoonk.ui.theme

import android.os.Build
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.dynamicDarkColorScheme
import androidx.compose.material3.dynamicLightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.platform.LocalContext

/**
 * Uses Android's system-derived dynamic colors when the device supports them.
 * Older Android versions fall back to Material's defaults instead of carrying
 * custom template colors that would drift before the app has a real design
 * system.
 */
@Composable
fun ZoonkTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    dynamicColor: Boolean = true,
    content: @Composable () -> Unit,
) {
    val context = LocalContext.current
    val supportsDynamicColor = dynamicColor && Build.VERSION.SDK_INT >= Build.VERSION_CODES.S

    if (supportsDynamicColor) {
        MaterialTheme(
            colorScheme = if (darkTheme) dynamicDarkColorScheme(context) else dynamicLightColorScheme(context),
            content = content,
        )
        return
    }

    MaterialTheme(content = content)
}
