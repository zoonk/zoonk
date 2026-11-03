package com.zoonk.android.feature.certificates

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.ListItem
import androidx.compose.material3.ListItemDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.derivedStateOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.app.AppContainer
import com.zoonk.android.data.LoadState
import com.zoonk.android.data.collectShown
import com.zoonk.android.data.value
import com.zoonk.android.navigation.AppNavigator
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.navigation.AppTab
import com.zoonk.android.ui.components.EmptyState
import com.zoonk.android.ui.components.Eyebrow
import com.zoonk.android.ui.components.LIST_ITEM_INSET
import com.zoonk.android.ui.components.LoadFailedMessage
import com.zoonk.android.ui.components.Meter
import com.zoonk.android.ui.components.SectionHeader
import com.zoonk.android.ui.components.bleed
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.formatPercent
import com.zoonk.android.ui.scaffold.DETAIL_PAGE_WIDTH
import com.zoonk.android.ui.scaffold.PageScaffold
import com.zoonk.android.ui.scaffold.PageWithSupportingPane
import com.zoonk.android.ui.scaffold.detailPagePadding
import com.zoonk.android.ui.scaffold.pageTitle
import com.zoonk.android.ui.theme.withTabularFigures
import com.zoonk.api.models.OwnedCertificate
import kotlinx.coroutines.launch

/** Main's `/certificates`: every certificate the learner earned, newest first, each opening its page. */
@Composable
fun CertificatesScreen(
    app: AppContainer,
    navigator: AppNavigator,
) {
    val resource = app.certificates.certificates
    val state by resource.collectShown()
    val scope = rememberCoroutineScope()
    val listState = rememberLazyListState()
    val titleAway by remember { derivedStateOf { listState.firstVisibleItemIndex > 0 } }
    val title = stringResource(R.string.certificates_title)

    PageScaffold(
        onBack = { navigator.back() },
        title = { if (titleAway) Text(title, maxLines = 1, overflow = TextOverflow.Ellipsis) },
    ) { padding ->
        Box(Modifier.fillMaxSize().padding(padding)) {
            when (state) {
                is LoadState.Loaded, LoadState.Empty -> {
                    PageWithSupportingPane(supportingPane = null) {
                        Box(Modifier.fillMaxSize(), contentAlignment = Alignment.TopStart) {
                            LazyColumn(Modifier.widthIn(max = DETAIL_PAGE_WIDTH).fillMaxSize(), listState, detailPagePadding()) {
                                certificates(app, navigator, state.value.orEmpty())
                            }
                        }
                    }
                }

                is LoadState.Failed -> {
                    LoadFailedMessage(onRetry = { scope.launch { resource.refresh() } })
                }

                else -> {
                    Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { CircularProgressIndicator() }
                }
            }
        }
    }
}

private fun androidx.compose.foundation.lazy.LazyListScope.certificates(
    app: AppContainer,
    navigator: AppNavigator,
    certificates: List<OwnedCertificate>,
) {
    item(key = "header", contentType = "header") {
        Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
            if (certificates.isNotEmpty()) {
                val count = certificates.size
                Eyebrow(pluralStringResource(R.plurals.certificates_count, count, count))
            }
            Text(stringResource(R.string.certificates_title), Modifier.pageTitle(), style = MaterialTheme.typography.titleLarge)
            Text(
                stringResource(R.string.certificates_lead),
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                style = MaterialTheme.typography.bodyMedium,
            )
        }
    }

    if (certificates.isEmpty()) {
        item(key = "empty", contentType = "empty") { Empty(app, navigator) }
        return
    }

    items(certificates, key = { it.code }, contentType = { "certificate" }) { certificate ->
        Column(Modifier.bleed(LIST_ITEM_INSET).padding(top = if (certificate == certificates.first()) 16.dp else 0.dp)) {
            if (certificate != certificates.first()) HorizontalDivider()
            CertificateRow(app, certificate) { navigator.open(AppRoute.Certificate(certificate.code)) }
        }
    }
}

@Composable
private fun CertificateRow(
    app: AppContainer,
    certificate: OwnedCertificate,
    onOpen: () -> Unit,
) {
    ListItem(
        headlineContent = { Text(certificate.naming.words()) },
        modifier = Modifier.clickable(role = Role.Button, onClick = onOpen),
        supportingContent = { Text(certificate.kindLine()) },
        leadingContent = {
            CertificatePicture(
                certificate.pictureUrl,
                app.images,
                contentDescription = null,
                Modifier.width(88.dp),
                corner = 4.dp,
            )
        },
        trailingContent = { Icon(painterResource(R.drawable.ic_chevron_right), contentDescription = null) },
        colors = ListItemDefaults.colors(containerColor = Color.Transparent),
    )
}

/**
 * Main's empty page: how certificates are earned, Continue learning, and under "Up next" each active
 * goal that earns one and how: a course's share of lessons done, or what a language level asks.
 */
@Composable
private fun Empty(
    app: AppContainer,
    navigator: AppNavigator,
) {
    val goals by app.certificates.goals.collectShown()
    val upNext = certificateUpNext(goals.value.orEmpty())

    Column(Modifier.padding(top = 24.dp)) {
        EmptyState(
            icon = R.drawable.ic_workspace_premium,
            title = stringResource(R.string.certificates_empty_title),
            description = stringResource(R.string.certificates_empty_description),
            action = {
                Button(
                    onClick = { navigator.showRoot(AppTab.Today) },
                ) { Text(stringResource(R.string.certificates_continue_learning)) }
            },
        )

        if (upNext.isNotEmpty()) {
            SectionHeader(stringResource(R.string.certificates_up_next), Modifier.padding(top = 32.dp, bottom = 8.dp))
            Column(Modifier.bleed(LIST_ITEM_INSET)) {
                upNext.forEachIndexed { index, item ->
                    if (index > 0) HorizontalDivider()
                    UpNextRow(item)
                }
            }
        }
    }
}

@Composable
private fun UpNextRow(item: CertificateUpNext) {
    val progress = item.progress
    ListItem(
        headlineContent = { Text(item.goal.title) },
        supportingContent = {
            Text(stringResource(if (progress == null) R.string.certificates_up_next_language else R.string.certificates_up_next_course))
        },
        trailingContent =
            progress?.let { share ->
                {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Meter(share.toFloat(), Modifier.width(64.dp))
                        Text(formatPercent(share, currentLocale()), style = MaterialTheme.typography.labelLarge.withTabularFigures())
                    }
                }
            },
        colors = ListItemDefaults.colors(containerColor = Color.Transparent),
    )
}
