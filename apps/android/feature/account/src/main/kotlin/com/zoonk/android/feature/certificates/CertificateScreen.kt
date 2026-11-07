package com.zoonk.android.feature.certificates

import androidx.annotation.DrawableRes
import androidx.compose.foundation.ScrollState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.consumeWindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.Layout
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Constraints
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.zoonk.android.R
import com.zoonk.android.app.AppContainer
import com.zoonk.android.data.LoadState
import com.zoonk.android.data.collectShown
import com.zoonk.android.data.value
import com.zoonk.android.navigation.AppNavigator
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.ui.components.Button
import com.zoonk.android.ui.components.ButtonIcon
import com.zoonk.android.ui.components.ButtonSize
import com.zoonk.android.ui.components.EmptyState
import com.zoonk.android.ui.components.LoadFailedMessage
import com.zoonk.android.ui.components.MarkStatus
import com.zoonk.android.ui.components.OutlinedButton
import com.zoonk.android.ui.components.PageLoading
import com.zoonk.android.ui.components.StatusMark
import com.zoonk.android.ui.components.TextButton
import com.zoonk.android.ui.format.DateStyle
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.formatDate
import com.zoonk.android.ui.format.formatDuration
import com.zoonk.android.ui.format.formatNumber
import com.zoonk.android.ui.scaffold.BeforeFold
import com.zoonk.android.ui.scaffold.DETAIL_PAGE_WIDTH
import com.zoonk.android.ui.scaffold.PageScaffold
import com.zoonk.android.ui.scaffold.PageWithSupportingPane
import com.zoonk.android.ui.scaffold.detailPagePadding
import com.zoonk.android.ui.scaffold.pageTitle
import com.zoonk.android.ui.theme.zoonkType
import com.zoonk.api.models.OwnedCertificate
import kotlinx.coroutines.launch
import kotlinx.datetime.toJavaLocalDate

/**
 * Main's `/c/<code>` for its owner: the certificate's headline, Share, Print, Download and Add to
 * LinkedIn, its picture, its details (the name, with Change, and the link, with Copy), what it
 * means and what it covers, or, earned without Plus, locked with the Plus notice. It reads the learner's list, so a
 * rename or a subscription shows here at once, and a locked one, which the public read refuses,
 * shows at all.
 */
@Composable
fun CertificateScreen(
    code: String,
    app: AppContainer,
    navigator: AppNavigator,
) {
    val resource = app.certificates.certificates
    val state by resource.collectShown()
    val scope = rememberCoroutineScope()
    val wanted = normalizeCertificateCode(code)
    val certificate = state.value?.find { it.code == wanted }
    val actions = rememberCertificateActions(app)

    PageScaffold(
        onBack = { navigator.back() },
        title = { Text(stringResource(R.string.certificates_certificate)) },
    ) { padding ->
        Box(
            Modifier
                .fillMaxSize()
                .padding(padding)
                .consumeWindowInsets(padding)
                .imePadding(),
        ) {
            when {
                certificate != null -> {
                    Certificate(app, certificate, actions) { navigator.open(AppRoute.Subscription) }
                }

                state is LoadState.Failed -> {
                    LoadFailedMessage(onRetry = { scope.launch { resource.refresh() } })
                }

                state is LoadState.Loaded || state == LoadState.Empty -> {
                    BeforeFold { beforeFold ->
                        EmptyState(
                            icon = R.drawable.ic_workspace_premium,
                            title = stringResource(R.string.certificates_not_found),
                            description = stringResource(R.string.not_found_description),
                            modifier = beforeFold.padding(detailPagePadding()),
                        )
                    }
                }

                else -> {
                    PageLoading()
                }
            }
        }
    }
}

/**
 * Main's page, in its order: the headline, what the learner can do with it, the picture, the
 * details, what it means and what it covers, which on an open book take the page after the fold.
 */
@Composable
private fun Certificate(
    app: AppContainer,
    certificate: OwnedCertificate,
    actions: CertificateActions,
    onSeePlus: () -> Unit,
) {
    // Above both layouts: folding moves the details between the one column and the page after the fold, and each keeps its scroll.
    val name = certificateNameModel(app)
    var linkedIn by rememberSaveable { mutableStateOf(false) }
    val pageScroll = rememberScrollState()
    val detailsScroll = rememberScrollState()
    val naming = certificate.naming
    val details =
        @Composable { modifier: Modifier ->
            Column(modifier) {
                CertificateDetails(certificate, name, actions)
                CertificateMeaning(certificate, Modifier.padding(top = 32.dp))
                CertificateCovered(certificate, Modifier.padding(top = 32.dp))
            }
        }

    PageWithSupportingPane(
        supportingPane = { DetailColumn(detailsScroll) { details(Modifier) } },
        panesTouch = true,
        atFoldOnly = true,
    ) { detailsBeside ->
        DetailColumn(pageScroll) {
            CertificateIntro(certificate)
            OwnerActions(certificate, actions, name, onSeePlus, Modifier.padding(top = 24.dp)) { linkedIn = true }
            if (naming.locked) {
                LockedCertificate(naming, Modifier.padding(top = 32.dp).fillMaxWidth())
            } else {
                CertificatePicture(
                    certificate.pictureUrl,
                    app.images,
                    certificate.pictureLabel(),
                    Modifier.padding(top = 32.dp).fillMaxWidth(),
                )
            }
            if (!detailsBeside) details(Modifier.padding(top = 28.dp))
        }
    }

    if (linkedIn && !naming.locked) LinkedInSheet(certificate, onCopy = actions::copy, onDismiss = { linkedIn = false })
}

@Composable
private fun DetailColumn(
    scroll: ScrollState,
    content: @Composable ColumnScope.() -> Unit,
) {
    Column(
        Modifier
            .fillMaxSize()
            .verticalScroll(scroll)
            .padding(detailPagePadding())
            .widthIn(max = DETAIL_PAGE_WIDTH),
        content = content,
    )
}

/** Main's `CertificateIntro`: a locked certificate isn't issued yet, so it claims neither the check nor the date. */
@Composable
private fun CertificateIntro(certificate: OwnedCertificate) {
    val locked = certificate.locked

    Column {
        if (!locked) {
            Row(
                Modifier.padding(bottom = 14.dp),
                horizontalArrangement = Arrangement.spacedBy(6.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Icon(
                    painterResource(R.drawable.ic_verified),
                    contentDescription = null,
                    modifier = Modifier.size(16.dp),
                    tint = MaterialTheme.colorScheme.tertiary,
                )
                Text(
                    stringResource(R.string.certificates_verified),
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    style = MaterialTheme.typography.bodyMedium,
                )
            }
        }
        Text(certificate.sentence(), Modifier.pageTitle(), style = MaterialTheme.typography.displaySmall)
        if (!locked) {
            Text(
                stringResource(
                    R.string.certificates_issued_on,
                    formatDate(certificate.completedOn.toJavaLocalDate(), currentLocale(), DateStyle.LongYear),
                ),
                Modifier.padding(top = 10.dp),
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                style = MaterialTheme.zoonkType.lead,
            )
        }
    }
}

/** Main's `CertificateOwnerActions`: Share leads; without a name, the name comes first; locked, the Plus notice. */
@Composable
private fun OwnerActions(
    certificate: OwnedCertificate,
    actions: CertificateActions,
    name: CertificateNameModel,
    onSeePlus: () -> Unit,
    modifier: Modifier = Modifier,
    onAddToLinkedIn: () -> Unit,
) {
    val fileName = certificate.fileName()
    val caption = certificate.caption()

    when {
        certificate.locked -> {
            CertificatesPlusNotice(onSeePlus, modifier)
        }

        certificate.recipientName == null -> {
            CertificateNameField(current = null, name, modifier)
        }

        else -> {
            Column(modifier, verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Button(
                    onClick = { actions.share(certificate, fileName, caption) },
                    modifier = Modifier.fillMaxWidth(),
                    enabled = actions.busy == null,
                    busy = actions.busy == CertificateAction.Share,
                    leadingIcon = { ButtonIcon(R.drawable.ic_share) },
                    size = ButtonSize.Large,
                ) {
                    ActionText(stringResource(R.string.certificates_share))
                }
                SideBySideOrStacked {
                    OutlinedButton(
                        onClick = { actions.print(certificate, fileName) },
                        enabled = actions.busy == null,
                        busy = actions.busy == CertificateAction.Print,
                        leadingIcon = { ButtonIcon(R.drawable.ic_print) },
                        size = ButtonSize.Large,
                    ) {
                        ActionText(stringResource(R.string.certificates_print))
                    }
                    OutlinedButton(
                        onClick = { actions.download(certificate, fileName) },
                        enabled = actions.busy == null,
                        busy = actions.busy == CertificateAction.Download,
                        leadingIcon = { ButtonIcon(R.drawable.ic_download) },
                        size = ButtonSize.Large,
                    ) {
                        ActionText(stringResource(R.string.certificates_download))
                    }
                }
                OutlinedButton(
                    onClick = onAddToLinkedIn,
                    modifier = Modifier.fillMaxWidth(),
                    leadingIcon = { ButtonIcon(R.drawable.ic_north_east) },
                    size = ButtonSize.Large,
                ) {
                    ActionText(stringResource(R.string.certificates_add_to_linkedin))
                }
            }
        }
    }
}

@Composable
private fun ActionText(text: String) = Text(text, textAlign = TextAlign.Center)

/**
 * Main's two columns for Print and Download, one under the other when either's words need more than
 * half the width, so a long word (German's "Herunterladen") or a large font never cuts them.
 */
@Composable
private fun SideBySideOrStacked(content: @Composable () -> Unit) {
    Layout(content) { buttons, constraints ->
        val gap = 8.dp.roundToPx()
        val half = (constraints.maxWidth - gap) / 2
        val sideBySide = buttons.all { it.maxIntrinsicWidth(Constraints.Infinity) <= half }
        val width = if (sideBySide) half else constraints.maxWidth
        val placed = buttons.map { it.measure(Constraints(minWidth = width, maxWidth = width)) }
        val height = if (sideBySide) placed.maxOf { it.height } else placed.sumOf { it.height } + gap * (placed.size - 1)

        layout(constraints.maxWidth, height) {
            var y = 0
            placed.forEachIndexed { index, button ->
                if (sideBySide) {
                    button.placeRelative(index * (width + gap), 0)
                } else {
                    button.placeRelative(0, y)
                    y += button.height + gap
                }
            }
        }
    }
}

/**
 * Main's `CertificateDetails`, the picture's text equivalent: the name with Change, what was done,
 * the ID and the link with Copy. A locked one shows what was done, without the ID or the link.
 */
@Composable
private fun CertificateDetails(
    certificate: OwnedCertificate,
    name: CertificateNameModel,
    actions: CertificateActions,
    modifier: Modifier = Modifier,
) {
    val recipient = certificate.recipientName
    val url = certificate.url.takeUnless { certificate.locked }

    Column(modifier) {
        Text(
            stringResource(R.string.certificates_details),
            Modifier.padding(bottom = 6.dp).semantics { heading() },
            style = MaterialTheme.zoonkType.sectionTitle,
        )
        if (recipient != null && url != null) {
            if (name.changing) {
                HorizontalDivider()
                CertificateNameField(recipient, name, Modifier.padding(vertical = 12.dp))
            } else {
                DetailRow(stringResource(R.string.certificates_recipient_name), recipient) {
                    TextButton(onClick = { name.change(recipient) }, size = ButtonSize.Small) {
                        Text(stringResource(R.string.certificates_change))
                    }
                }
            }
        }
        certificateFacts(certificate).forEach { (label, value, mono) -> DetailRow(label, value, mono) }
        if (url != null) {
            DetailRow(stringResource(R.string.certificates_detail_link), url.host.removePrefix("www.") + url.path, mono = true) {
                TextButton(onClick = { actions.copy(url.toString(), R.string.certificates_link_copied) }, size = ButtonSize.Small) {
                    Text(stringResource(R.string.certificates_copy))
                }
            }
            HorizontalDivider()
            Text(
                stringResource(R.string.certificates_link_note),
                Modifier.padding(top = 10.dp),
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                style = MaterialTheme.typography.bodySmall,
            )
        }
    }
}

private data class CertificateFact(
    val label: String,
    val value: String,
    val mono: Boolean,
)

@Composable
private fun certificateFacts(certificate: OwnedCertificate): List<CertificateFact> {
    val locale = currentLocale()

    fun number(value: Long) = formatNumber(value.toDouble(), locale)
    return listOfNotNull(
        certificate.courseLevel?.let {
            CertificateFact(
                stringResource(R.string.certificates_detail_level),
                certificateLevelName(it.value, certificate.cefrRange),
                mono = false,
            )
        },
        CertificateFact(
            stringResource(R.string.certificates_detail_completed),
            formatDate(certificate.completedOn.toJavaLocalDate(), locale, DateStyle.Short),
            mono = true,
        ),
        certificate.lessonsStudied?.takeIf { it > 0 }?.let {
            CertificateFact(stringResource(R.string.certificates_detail_lessons_studied), number(it), mono = true)
        },
        certificate.lessonsTestedOut?.takeIf { it > 0 }?.let {
            CertificateFact(stringResource(R.string.certificates_detail_passed_by_test), number(it), mono = true)
        },
        certificate.minutes?.takeIf { it > 0 }?.let {
            CertificateFact(
                stringResource(R.string.certificates_detail_study_time),
                stringResource(
                    R.string.certificates_about_duration,
                    formatDuration(roundStudyMinutes(it) * SECONDS_PER_MINUTE, locale),
                ),
                mono = true,
            )
        },
        if (certificate.locked) {
            null
        } else {
            CertificateFact(stringResource(R.string.certificates_detail_id), formatCertificateCode(certificate.code), mono = true)
        },
    )
}

/** Main's `CertificateMeaning`: how Zoonk decides to issue this kind of certificate, and what it isn't. */
@Composable
private fun CertificateMeaning(
    certificate: OwnedCertificate,
    modifier: Modifier = Modifier,
) {
    val nameNote = stringResource(R.string.certificates_meaning_name)
    val paragraphs =
        if (certificate.cefrRange != null) {
            listOf(
                stringResource(R.string.certificates_meaning_language),
                "${stringResource(R.string.certificates_meaning_cefr)} $nameNote",
            )
        } else {
            listOf(
                stringResource(
                    if (certificate.courseLevel !=
                        null
                    ) {
                        R.string.certificates_meaning_level
                    } else {
                        R.string.certificates_meaning_plan
                    },
                ),
                "${stringResource(R.string.certificates_meaning_record)} $nameNote",
            )
        }

    Column(modifier, verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Text(
            stringResource(R.string.certificates_meaning_title),
            Modifier.semantics { heading() },
            style = MaterialTheme.typography.titleLarge,
        )
        paragraphs.forEach {
            Text(
                it,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                style = MaterialTheme.typography.bodyLarge.copy(fontSize = 15.sp, lineHeight = 24.sp),
            )
        }
    }
}

@Composable
private fun CertificateCovered(
    certificate: OwnedCertificate,
    modifier: Modifier = Modifier,
) {
    val items = certificate.topics
    if (items.isEmpty()) return

    Column(modifier) {
        Row(Modifier.semantics(mergeDescendants = true) { heading() }, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(
                stringResource(R.string.certificates_topics_covered),
                Modifier.alignByBaseline(),
                style = MaterialTheme.typography.titleMedium.copy(fontSize = 15.sp, fontWeight = FontWeight.SemiBold, lineHeight = 21.sp),
            )
            Text(
                formatNumber(items.size.toDouble(), currentLocale()),
                Modifier.alignByBaseline(),
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                style = MaterialTheme.zoonkType.data,
            )
        }
        Column(Modifier.padding(top = 12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            items.forEach { item ->
                Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    StatusMark(MarkStatus.Done)
                    // bodyLarge's line is the mark's box, so the check sits on the first line at any font size.
                    Text(item, Modifier.weight(1f), style = MaterialTheme.typography.bodyLarge.copy(fontSize = 15.sp))
                }
            }
        }
    }
}

/** Main's `roundStudyMinutes`: the plan's estimate, so whole hours past the first one. */
internal fun roundStudyMinutes(minutes: Long): Long =
    if (minutes < MINUTES_PER_HOUR) minutes else Math.round(minutes / MINUTES_PER_HOUR.toDouble()) * MINUTES_PER_HOUR

/**
 * Main's `DetailRow`: a fact's label and its value at the row's end, with the [action] that changes
 * or copies it. A value that doesn't fit beside its label goes under it, so a large font never
 * splits a date or a code mid-word.
 */
@Composable
private fun DetailRow(
    label: String,
    value: String,
    mono: Boolean = false,
    action: (@Composable () -> Unit)? = null,
) {
    HorizontalDivider()
    Row(
        Modifier.fillMaxWidth().padding(vertical = if (action == null) 10.dp else 0.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        FlowRow(
            Modifier.weight(1f).semantics(mergeDescendants = true) {},
            horizontalArrangement = Arrangement.SpaceBetween,
        ) {
            Text(
                label,
                Modifier.padding(end = 16.dp).alignByBaseline(),
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                style = MaterialTheme.typography.bodyMedium,
            )
            Text(
                value,
                Modifier.alignByBaseline(),
                style =
                    if (mono) {
                        MaterialTheme.zoonkType.data.copy(color = MaterialTheme.colorScheme.onSurface)
                    } else {
                        MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.Medium)
                    },
            )
        }
        action?.invoke()
    }
}

private const val MINUTES_PER_HOUR = 60
private const val SECONDS_PER_MINUTE = 60
