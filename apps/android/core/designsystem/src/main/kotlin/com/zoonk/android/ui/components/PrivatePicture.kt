package com.zoonk.android.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalWindowInfo
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import coil3.compose.AsyncImage
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.PrivateImages
import com.zoonk.android.ui.theme.ZoonkRadius

/** Private pictures load with the signed-in session, provided once at the app's root through [LocalPrivatePictures]. */
class PrivatePictures(
    val images: PrivateImages,
    val session: AuthenticatedSession?,
)

val LocalPrivatePictures = staticCompositionLocalOf<PrivatePictures?> { null }

/** How tall a picture may grow, as a share of the window's height (main's `PICTURE_FRAME_CLASS`). */
enum class PictureFrame(
    val heightShare: Float,
) {
    Hero(0.55f),
    Inline(0.45f),
    Question(0.40f),
}

/** The shape a picture reserves when its stored size is unknown. */
enum class PictureShape(
    val ratio: Float,
) {
    Portrait(1024f / 1280f),
    Landscape(1536f / 1024f),
    Square(1f),
}

@Composable
private fun PictureFrame.maxHeight(): Dp =
    with(LocalDensity.current) {
        LocalWindowInfo.current.containerSize.height
            .toDp()
    } * heightShare

/**
 * Sized from its stored [width] and [height], or its [shape] when they're unknown, so nothing jumps;
 * a muted surface until it loads, and a picture that fails to load leaves no gap. Draws nothing
 * outside [LocalPrivatePictures].
 */
@Composable
fun PrivatePicture(
    url: String,
    alt: String?,
    width: Long?,
    height: Long?,
    frame: PictureFrame,
    modifier: Modifier = Modifier,
    shape: PictureShape = PictureShape.Portrait,
) {
    val pictures = LocalPrivatePictures.current ?: return
    val context = LocalContext.current
    var failed by remember(url) { mutableStateOf(false) }
    val ratio = if (width != null && height != null && width > 0 && height > 0) width.toFloat() / height else shape.ratio
    val maxHeight = frame.maxHeight()

    if (failed) return

    AsyncImage(
        model = remember(url, pictures.session) { pictures.images.request(context, url, pictures.session) },
        imageLoader = pictures.images.loader,
        contentDescription = alt,
        modifier =
            modifier
                .heightIn(max = maxHeight)
                .aspectRatio(ratio)
                .clip(RoundedCornerShape(ZoonkRadius.xl))
                .background(MaterialTheme.colorScheme.surfaceContainerHigh),
        contentScale = ContentScale.Fit,
        onError = { failed = true },
    )
}

/** A picture still being drawn, in the space a drawn one of its [shape] takes. */
@Composable
fun PendingPicture(
    frame: PictureFrame,
    modifier: Modifier = Modifier,
    shape: PictureShape = PictureShape.Portrait,
    content: @Composable ColumnScope.() -> Unit,
) = MediaPending(modifier.heightIn(max = frame.maxHeight()).aspectRatio(shape.ratio), content)
