package com.zoonk.android.navigation

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.zoonk.android.app.AppContainer

/**
 * Stands in for a screen its feature lane hasn't built yet, in the route's own frame, so every
 * route opens something. It shows the route verbatim on purpose: no placeholder ships.
 */
@Composable
fun RoutePlaceholder(
    route: AppRoute,
    app: AppContainer,
    navigator: AppNavigator,
) {
    RouteFrame(route, app, navigator) { padding ->
        Box(
            modifier =
                Modifier
                    .fillMaxSize()
                    .padding(padding)
                    .padding(24.dp),
            contentAlignment = Alignment.Center,
        ) {
            Text(text = route.toString(), style = MaterialTheme.typography.headlineSmall, textAlign = TextAlign.Center)
        }
    }
}
