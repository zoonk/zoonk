package com.zoonk.android.ui.theme

import android.app.UiModeManager
import android.os.Build
import androidx.annotation.RequiresApi
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.ColorScheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext

/**
 * Never the wallpaper's colors: they would drop what each color means. The mapping:
 * `.agents/skills/android-material-guidelines/references/design-system.md`.
 */
@Composable
fun ZoonkTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    moreContrast: Boolean = rememberMoreContrast(),
    content: @Composable () -> Unit,
) {
    val scheme =
        when {
            darkTheme && moreContrast -> DarkMoreContrast
            darkTheme -> Dark
            moreContrast -> LightMoreContrast
            else -> Light
        }

    CompositionLocalProvider(
        LocalZoonkColors provides scheme.zoonk,
        LocalLightScheme provides if (moreContrast) LightMoreContrast else Light,
    ) {
        MaterialTheme(colorScheme = scheme.material, content = content)
    }
}

/** For marks on a surface that keeps its light look in dark theme, like a piano's keys. */
@Composable
fun LightTheme(content: @Composable () -> Unit) {
    val scheme = LocalLightScheme.current

    CompositionLocalProvider(LocalZoonkColors provides scheme.zoonk) {
        MaterialTheme(colorScheme = scheme.material, content = content)
    }
}

/** The web has one more-contrast mode, so medium and high contrast share it. */
@Composable
fun rememberMoreContrast(): Boolean =
    Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE &&
        rememberContrastLevel() >= MEDIUM_CONTRAST

private const val MEDIUM_CONTRAST = 0.5f

@RequiresApi(Build.VERSION_CODES.UPSIDE_DOWN_CAKE)
@Composable
private fun rememberContrastLevel(): Float {
    val context = LocalContext.current
    val uiModeManager = remember(context) { context.getSystemService(UiModeManager::class.java) }
    var level by remember(uiModeManager) { mutableFloatStateOf(uiModeManager.contrast) }

    DisposableEffect(uiModeManager) {
        val listener = UiModeManager.ContrastChangeListener { level = it }
        uiModeManager.addContrastChangeListener(context.mainExecutor, listener)
        onDispose { uiModeManager.removeContrastChangeListener(listener) }
    }

    return level
}

private class Scheme(
    val material: ColorScheme,
    val zoonk: ZoonkColors,
)

private val Light = scheme(LightPalette, dark = false, fixed = LightPalette)
private val Dark = scheme(DarkPalette, dark = true, fixed = LightPalette)
private val LightMoreContrast = scheme(LightMoreContrastPalette, dark = false, fixed = LightMoreContrastPalette)
private val DarkMoreContrast = scheme(DarkMoreContrastPalette, dark = true, fixed = LightMoreContrastPalette)

private val LocalLightScheme = staticCompositionLocalOf { Light }

/**
 * `tertiary` is progress's blue, which Material never draws by default, so progress indicators
 * pass it. `error` takes the deeper `destructive-text` because Material writes field errors in it.
 * Material's fixed roles don't change with the mode, so they take the light palette.
 */
private fun scheme(
    palette: ZoonkPalette,
    dark: Boolean,
    fixed: ZoonkPalette,
): Scheme =
    with(palette) {
        Scheme(
            material =
                ColorScheme(
                    primary = primary,
                    onPrimary = primaryForeground,
                    primaryContainer = muted,
                    onPrimaryContainer = foreground,
                    inversePrimary = primaryForeground,
                    secondary = mutedForeground,
                    onSecondary = background,
                    secondaryContainer = muted,
                    onSecondaryContainer = foreground,
                    tertiary = success,
                    onTertiary = background,
                    tertiaryContainer = successTint,
                    onTertiaryContainer = successText,
                    background = background,
                    onBackground = foreground,
                    surface = background,
                    onSurface = foreground,
                    surfaceVariant = muted,
                    onSurfaceVariant = mutedForeground,
                    surfaceTint = primary,
                    inverseSurface = foreground,
                    inverseOnSurface = background,
                    error = destructiveText,
                    onError = background,
                    errorContainer = destructiveTint,
                    onErrorContainer = destructiveText,
                    outline = input,
                    outlineVariant = border,
                    scrim = Color.Black,
                    surfaceBright = if (dark) surface3 else background,
                    surfaceDim = if (dark) background else surface3,
                    surfaceContainer = popover,
                    surfaceContainerHigh = muted,
                    surfaceContainerHighest = surface3,
                    surfaceContainerLow = card,
                    surfaceContainerLowest = background,
                    primaryFixed = fixed.muted,
                    primaryFixedDim = fixed.surface3,
                    onPrimaryFixed = fixed.foreground,
                    onPrimaryFixedVariant = fixed.mutedForeground,
                    secondaryFixed = fixed.muted,
                    secondaryFixedDim = fixed.surface3,
                    onSecondaryFixed = fixed.foreground,
                    onSecondaryFixedVariant = fixed.mutedForeground,
                    tertiaryFixed = fixed.successTint,
                    tertiaryFixedDim = fixed.success,
                    onTertiaryFixed = fixed.foreground,
                    onTertiaryFixedVariant = fixed.successText,
                ),
            zoonk = zoonkColors(),
        )
    }
