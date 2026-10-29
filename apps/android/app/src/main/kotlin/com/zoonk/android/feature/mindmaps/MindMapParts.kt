package com.zoonk.android.feature.mindmaps

import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.size
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.repeatOnLifecycle
import coil3.compose.AsyncImage
import coil3.size.Size
import com.zoonk.android.R
import com.zoonk.android.app.LocalSnackbarHostState
import com.zoonk.android.navigation.AppNavigator
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.ui.components.Limit
import com.zoonk.android.ui.components.LimitNotice
import com.zoonk.android.ui.components.LimitSubject
import com.zoonk.android.ui.components.LocalPrivatePictures
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

/** The map in words: its title and central idea, its numbered branches, a comparison and the gist. */
@Composable
internal fun MindMapOutlineText(
    outline: MindMapOutline,
    modifier: Modifier = Modifier,
) {
    val quiet = MaterialTheme.colorScheme.onSurfaceVariant

    Column(modifier, verticalArrangement = Arrangement.spacedBy(20.dp)) {
        Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text(outline.title, Modifier.semantics { heading() }, style = MaterialTheme.typography.titleMedium)
            Text(outline.centralIdea, color = quiet, style = MaterialTheme.typography.bodyMedium)
        }

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
            Text("•", style = style)
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

/** A map that can't be made now: why, with Create a free account or See Plus where they help. */
@Composable
internal fun MindMapLimit(
    limit: Limit,
    navigator: AppNavigator,
    modifier: Modifier = Modifier,
) {
    LimitNotice(
        limit = limit,
        subject = LimitSubject.MindMaps,
        onCreateAccount = { navigator.open(AppRoute.Login) },
        onSeePlus = { navigator.open(AppRoute.Subscription) },
        modifier = modifier,
    )
}

/** Follows a map while it's drawn and the screen is started; [local] restarts it once this screen's answer changes. */
@Composable
internal fun FollowWhileDrawn(
    maps: MindMapViewModel,
    chapterId: UUID,
    shown: MindMapShown,
    local: MindMapLocal?,
) {
    if (shown != MindMapShown.Generating) return
    val lifecycle = LocalLifecycleOwner.current.lifecycle
    LaunchedEffect(lifecycle, chapterId, local) {
        lifecycle.repeatOnLifecycle(Lifecycle.State.STARTED) { maps.follow(chapterId) }
    }
}
