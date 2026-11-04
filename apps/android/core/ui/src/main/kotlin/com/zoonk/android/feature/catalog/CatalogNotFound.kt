package com.zoonk.android.feature.catalog

import androidx.compose.material3.Button
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.res.stringResource
import com.zoonk.android.R
import com.zoonk.android.navigation.AppNavigator
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.ui.components.StatusMessage

/** A course, chapter or lesson that no longer exists is a not-found page inside the frame, as on main. */
@Composable
fun CatalogNotFound(navigator: AppNavigator) {
    StatusMessage(
        icon = R.drawable.ic_search_off,
        title = stringResource(R.string.not_found_title),
        description = stringResource(R.string.not_found_description),
    ) {
        Button(onClick = { navigator.open(AppRoute.Catalog()) }) { Text(stringResource(R.string.catalog_title)) }
    }
}
