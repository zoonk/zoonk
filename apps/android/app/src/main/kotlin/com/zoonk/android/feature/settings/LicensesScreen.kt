package com.zoonk.android.feature.settings

import android.content.Context
import androidx.browser.customtabs.CustomTabsIntent
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.ListItem
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.produceState
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.core.net.toUri
import com.mikepenz.aboutlibraries.Libs
import com.mikepenz.aboutlibraries.entity.Library
import com.zoonk.android.R
import com.zoonk.android.navigation.AppNavigator
import com.zoonk.android.ui.scaffold.PageScaffold
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

/** Every library the build ships and its license, from the list AboutLibraries' Gradle plugin writes. */
@Composable
fun LicensesScreen(navigator: AppNavigator) {
    val context = LocalContext.current
    val libraries by produceState<List<Library>?>(null) { value = withContext(Dispatchers.IO) { readLibraries(context) } }
    var openId by rememberSaveable { mutableStateOf<String?>(null) }

    PageScaffold(onBack = { navigator.back() }, title = { Text(stringResource(R.string.settings_licenses)) }) { padding ->
        val list = libraries
        if (list == null) {
            Box(Modifier.fillMaxSize().padding(padding), contentAlignment = Alignment.Center) { CircularProgressIndicator() }
        } else {
            LazyColumn(Modifier.fillMaxSize(), contentPadding = padding, horizontalAlignment = Alignment.CenterHorizontally) {
                items(list, key = { it.uniqueId }) { library ->
                    ListItem(
                        headlineContent = { Text(library.name) },
                        supportingContent = {
                            Text(listOfNotNull(library.artifactVersion, library.licenses.joinToString { it.name }).joinToString(" · "))
                        },
                        modifier =
                            Modifier
                                .widthIn(max = 640.dp)
                                .clickable(role = Role.Button) { openId = library.uniqueId },
                    )
                }
            }
            list.firstOrNull { it.uniqueId == openId }?.let { LicenseSheet(it, onDismiss = { openId = null }) }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun LicenseSheet(
    library: Library,
    onDismiss: () -> Unit,
) {
    val context = LocalContext.current

    ModalBottomSheet(onDismissRequest = onDismiss, sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)) {
        Column(
            modifier =
                Modifier
                    .verticalScroll(rememberScrollState())
                    .padding(horizontal = 24.dp)
                    .padding(bottom = 24.dp)
                    .navigationBarsPadding(),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Text(library.name, Modifier.semantics { heading() }, style = MaterialTheme.typography.titleLarge)
            library.website?.let { website ->
                TextButton(onClick = { openWeb(context, website) }) { Text(stringResource(R.string.settings_licenses_website)) }
            }
            library.licenses.forEach { license ->
                HorizontalDivider()
                Text(license.name, Modifier.semantics { heading() }, style = MaterialTheme.typography.titleSmall)
                val text = license.licenseContent?.takeIf { it.isNotBlank() }
                if (text != null) {
                    Text(text, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                } else {
                    license.url?.let { url ->
                        TextButton(onClick = { openWeb(context, url) }) { Text(stringResource(R.string.settings_licenses_read)) }
                    }
                }
            }
        }
    }
}

private fun readLibraries(context: Context): List<Library> {
    val json =
        context.resources
            .openRawResource(R.raw.aboutlibraries)
            .bufferedReader()
            .use { it.readText() }
    return Libs
        .Builder()
        .withJson(json)
        .build()
        .libraries
        .sortedBy { it.name.lowercase() }
}

private fun openWeb(
    context: Context,
    url: String,
) = CustomTabsIntent.Builder().build().launchUrl(context, url.toUri())
