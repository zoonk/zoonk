package com.zoonk.android.feature.catalog

import androidx.compose.runtime.Composable
import androidx.compose.runtime.ReadOnlyComposable
import androidx.compose.ui.res.stringResource
import com.zoonk.android.R

/** A course level's name from the API's value, which every generated model's level enum shares: "beginner" is "Beginner". */
@Composable
@ReadOnlyComposable
fun courseLevelName(value: String): String =
    stringResource(
        when (value) {
            "overview" -> R.string.catalog_level_overview
            "beginner" -> R.string.catalog_level_beginner
            "intermediate" -> R.string.catalog_level_intermediate
            "advanced" -> R.string.catalog_level_advanced
            else -> error("Unknown course level: $value")
        },
    )
