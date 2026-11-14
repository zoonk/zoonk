package com.zoonk.android.feature.mindmaps

import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.focusable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.size
import androidx.compose.material3.Icon
import androidx.compose.material3.IconToggleButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.repeatOnLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import coil3.compose.AsyncImage
import coil3.size.Size
import com.zoonk.android.R
import com.zoonk.android.app.AppContainer
import com.zoonk.android.app.LocalSnackbarHostState
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.collectShown
import com.zoonk.android.data.value
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.ui.components.Limit
import com.zoonk.android.ui.components.LimitNotice
import com.zoonk.android.ui.components.LimitSubject
import com.zoonk.android.ui.components.LimitTier
import com.zoonk.android.ui.components.LocalPrivatePictures
import com.zoonk.android.ui.components.PrivatePictures
import com.zoonk.api.models.AllowanceItem
import com.zoonk.api.models.LearnerSummary
import com.zoonk.api.models.MindMapImage
import com.zoonk.api.models.MindMapOutline
import java.util.UUID

/** A map's picture through the session the screen shows; [original] decodes it whole, for zooming. */
@Composable
internal fun MapPicture(
    url: String,
    contentDescription: String?,
    modifier: Modifier = Modifier,
    contentScale: ContentScale = ContentScale.Crop,
    original: Boolean = false,
) {
    val pictures = LocalPrivatePictures.current ?: return
    val context = LocalContext.current
    val request =
        remember(url, pictures.session, original) {
            pictures.images
                .request(context, url, pictures.session)
                .let { if (original) it.newBuilder().size(Size.ORIGINAL).build() else it }
        }

    AsyncImage(
        model = request,
        imageLoader = pictures.images.loader,
        contentDescription = contentDescription,
        modifier = modifier.background(MaterialTheme.colorScheme.surfaceContainerHigh),
        contentScale = contentScale,
    )
}

/** Main's alt text: the map's title and central idea, or the chapter's title before it has words. */
@Composable
internal fun mindMapAlt(
    outline: MindMapOutline?,
    chapterTitle: String,
): String =
    when {
        outline == null -> {
            stringResource(R.string.mindmaps_alt_chapter, chapterTitle)
        }

        outline.title.trim().lastOrNull() in SENTENCE_ENDS -> {
            stringResource(
                R.string.mindmaps_alt_sentence,
                outline.title,
                outline.centralIdea,
            )
        }

        else -> {
            stringResource(R.string.mindmaps_alt, outline.title, outline.centralIdea)
        }
    }

private val SENTENCE_ENDS = setOf('.', '!', '?', '…')

/**
 * The picture's alt text followed by the map in words, for TalkBack where the outline isn't on
 * screen beside it (main pairs them with `aria-describedby`); a line per idea, so it pauses between.
 */
@Composable
internal fun mindMapDescription(
    outline: MindMapOutline?,
    chapterTitle: String,
): String {
    val alt = mindMapAlt(outline, chapterTitle)
    if (outline == null) return alt
    val inShort = stringResource(R.string.mindmaps_in_short)

    return buildList {
        add(alt)
        outline.branches.forEachIndexed { index, branch ->
            add("${index + 1}. ${branch.title}")
            add(branch.explanation)
            addAll(branch.points)
        }
        outline.comparison?.let { comparison ->
            add(comparison.title)
            comparison.columns.forEach { column ->
                add(column.name)
                addAll(column.points)
            }
        }
        add("$inShort ${outline.summary}")
    }.joinToString("\n")
}

/**
 * The map in words under the header that names it: its central idea, its numbered branches, a
 * comparison and the gist.
 */
@Composable
internal fun MindMapOutlineText(
    outline: MindMapOutline,
    modifier: Modifier = Modifier,
) {
    val quiet = MaterialTheme.colorScheme.onSurfaceVariant

    Column(modifier, verticalArrangement = Arrangement.spacedBy(20.dp)) {
        Text(outline.centralIdea, color = quiet, style = MaterialTheme.typography.bodyMedium)

        outline.branches.forEachIndexed { index, branch ->
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                Box(
                    Modifier
                        .size(24.dp)
                        .background(MaterialTheme.colorScheme.surfaceContainerHigh, MaterialTheme.shapes.extraSmall),
                    contentAlignment = Alignment.Center,
                ) {
                    Text("${index + 1}", color = quiet, style = MaterialTheme.typography.labelMedium.copy(fontFeatureSettings = "tnum"))
                }
                Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Text(branch.title, style = MaterialTheme.typography.titleSmall)
                    Text(branch.explanation, style = MaterialTheme.typography.bodyMedium)
                    Points(branch.points)
                }
            }
        }

        outline.comparison?.let { comparison ->
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(comparison.title, color = quiet, style = MaterialTheme.typography.labelLarge)
                comparison.columns.forEach { column ->
                    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        Text(column.name, style = MaterialTheme.typography.titleSmall)
                        Points(column.points)
                    }
                }
            }
        }

        val inShort = stringResource(R.string.mindmaps_in_short)
        Text(
            text =
                buildAnnotatedString {
                    withStyle(SpanStyle(fontWeight = FontWeight.Medium)) { append(inShort) }
                    append(" ")
                    append(outline.summary)
                },
            style = MaterialTheme.typography.bodyMedium,
        )
    }
}

@Composable
private fun Points(points: List<String>) {
    val style = MaterialTheme.typography.bodyMedium.copy(color = MaterialTheme.colorScheme.onSurfaceVariant)
    points.forEach { point ->
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Text("•", Modifier.clearAndSetSemantics {}, style = style)
            Text(point, Modifier.weight(1f), style = style)
        }
    }
}

/**
 * Saves a map's picture where the learner picks (the system's Save dialog, which needs no storage
 * permission on any version) and says whether it worked.
 */
@Composable
internal fun rememberSavePicture(
    maps: MindMapViewModel,
    image: MindMapImage,
    chapterTitle: String,
): () -> Unit {
    val context = LocalContext.current
    val snackbar = LocalSnackbarHostState.current
    val save by maps.save.collectAsStateWithLifecycle()
    val saved = stringResource(R.string.mindmaps_saved)
    val failed = stringResource(R.string.mindmaps_save_failed)
    val launcher =
        rememberLauncherForActivityResult(ActivityResultContracts.CreateDocument(PICTURE_TYPE)) { uri ->
            if (uri != null) maps.savePicture(image.url) { context.contentResolver.openOutputStream(uri) }
        }

    LaunchedEffect(save) {
        val result = save ?: return@LaunchedEffect
        maps.savedShown()
        snackbar.showSnackbar(if (result == PictureSave.Saved) saved else failed)
    }

    return { launcher.launch(mindMapFileName(chapterTitle)) }
}

private const val PICTURE_TYPE = "image/webp"

/** Keys reach a screen only from focus inside it; this takes that focus as the screen opens, without a stop for TalkBack. */
@Composable
internal fun KeyFocus() {
    val focus = remember { FocusRequester() }
    Box(Modifier.focusRequester(focus).focusable().clearAndSetSemantics {})
    LaunchedEffect(Unit) { focus.requestFocus() }
}

/** A map's bookmark in its top bar, wherever the map shows: outlined, then filled once saved. */
@Composable
internal fun MapBookmark(
    saved: Boolean,
    onToggle: () -> Unit,
) {
    IconToggleButton(checked = saved, onCheckedChange = { onToggle() }) {
        Icon(
            painterResource(if (saved) R.drawable.ic_bookmark_filled else R.drawable.ic_bookmark),
            contentDescription = stringResource(R.string.mindmaps_save),
        )
    }
}

/** A map that can't be made now: why, worded by what ran out, with Create a free account or See Plus where they help. */
@Composable
internal fun MindMapLimit(
    limit: Limit,
    subject: LimitSubject,
    navigate: (AppRoute) -> Unit,
    modifier: Modifier = Modifier,
) {
    LimitNotice(
        limit = limit,
        subject = subject,
        onCreateAccount = { navigate(AppRoute.Login) },
        onSubscribe = { navigate(AppRoute.Subscription) },
        modifier = modifier,
    )
}

/** Follows a map while it's on its way and the screen is started, again whenever what it shows changes. */
@Composable
internal fun FollowWhileOnItsWay(
    maps: MindMapViewModel,
    chapterId: UUID,
    shown: MindMapShown,
) {
    if (!shown.onItsWay) return
    val lifecycle = LocalLifecycleOwner.current.lifecycle
    LaunchedEffect(maps, lifecycle, chapterId, shown) {
        lifecycle.repeatOnLifecycle(Lifecycle.State.STARTED) { maps.follow(chapterId, shown) }
    }
}

/**
 * What a screen's mind maps need from the app: the store, the session it shows (for its pictures
 * and the polls), the plan's cap on new maps (read only where a map could still be made), the
 * learner's plan (on Plus, rows say a chapter's lessons get written first without counting), and
 * where a failed save says so.
 */
internal class MindMapsHost(
    val store: MindMapStore,
    val session: AuthenticatedSession,
    val pictures: PrivatePictures,
    val cap: @Composable () -> Limit?,
    val tier: @Composable () -> LimitTier,
    private val currentSession: () -> AuthenticatedSession?,
    private val saveFailed: () -> Unit = {},
) {
    @Composable
    fun plus(): Boolean = tier() == LimitTier.Plus

    @Composable
    fun maps(goalId: UUID): MindMapViewModel =
        viewModel(key = "mindmaps-$goalId-${session.localId}") { MindMapViewModel(store, session, goalId, currentSession, saveFailed) }
}

@Composable
internal fun mindMapsHost(app: AppContainer): MindMapsHost? {
    val session = app.sessions.current ?: return null
    return MindMapsHost(
        store = app.mindMaps,
        session = session,
        pictures = PrivatePictures(app.images, session),
        cap = {
            val allowance by app.subscriptions.allowance.collectShown()
            allowance.value?.reachedCap(AllowanceItem.Kind.MIND_MAP)
        },
        tier = {
            val summary by app.learnerSummary.summary.collectShown()
            when (summary.value?.tier) {
                LearnerSummary.Tier.PLUS -> LimitTier.Plus
                LearnerSummary.Tier.GUEST -> LimitTier.Guest
                else -> LimitTier.Free
            }
        },
        currentSession = { app.sessions.current },
        saveFailed = { app.snackbars.show(R.string.mindmaps_save_map_failed) },
    )
}
