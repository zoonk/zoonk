package com.zoonk.android.app

import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.material3.adaptive.navigationsuite.NavigationSuiteScaffold
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import com.zoonk.android.navigation.AppDestination
import com.zoonk.android.navigation.AppDestinationContent

@Composable
fun ZoonkApp() {
    var currentDestination by rememberSaveable { mutableStateOf(AppDestination.Home) }

    NavigationSuiteScaffold(
        navigationSuiteItems = {
            AppDestination.entries.forEach { destination ->
                item(
                    icon = {
                        Icon(
                            painter = painterResource(destination.iconResource),
                            contentDescription = null,
                        )
                    },
                    label = { Text(stringResource(destination.labelResource)) },
                    selected = destination == currentDestination,
                    onClick = { currentDestination = destination },
                )
            }
        },
    ) {
        AppDestinationContent(currentDestination)
    }
}
