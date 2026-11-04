package com.zoonk.android.ui.theme

import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Shapes

/**
 * Main's radii (`--radius` in globals.css) in Material's slots, so its components take them: chips
 * `small`, cards and answer options `medium`, panels `large`. Dialogs, sheets and pickers keep
 * Material's `extraLarge`: they're the system's containers, as iOS keeps its sheets. Buttons take
 * `lg`, which no slot holds, through the design system's wrappers.
 */
internal val ZoonkMaterialShapes =
    Shapes(
        extraSmall = RoundedCornerShape(ZoonkRadius.sm),
        small = RoundedCornerShape(ZoonkRadius.md),
        medium = RoundedCornerShape(ZoonkRadius.option),
        large = RoundedCornerShape(ZoonkRadius.xl),
    )
