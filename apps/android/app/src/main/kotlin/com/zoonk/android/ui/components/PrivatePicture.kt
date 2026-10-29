package com.zoonk.android.ui.components

import androidx.compose.foundation.background
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
import androidx.compose.ui.unit.dp
import coil3.compose.AsyncImage
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.PrivateImages

/** Private pictures load with the session the screen shows, provided once by the screen through [LocalPrivatePictures]. */
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

/**
 * Sized from its stored [width] and [height] so nothing jumps, a muted surface until it loads; a
 * picture that fails to load leaves no gap. Draws nothing outside [LocalPrivatePictures].
 */
@Composable
fun PrivatePicture(
    url: String,
    alt: String?,
    width: Long?,
    height: Long?,
    frame: PictureFrame,
    modifier: Modifier = Modifier,
) {
    val pictures = LocalPrivatePictures.current ?: return
    val context = LocalContext.current
    var failed by remember(url) { mutableStateOf(false) }
    val ratio = (width ?: DEFAULT_WIDTH).toFloat() / (height ?: DEFAULT_HEIGHT).coerceAtLeast(1)
    val windowHeight =
        with(LocalDensity.current) {
            LocalWindowInfo.current.containerSize.height
                .toDp()
        }

    if (failed) return

    AsyncImage(
        model = remember(url, pictures.session) { pictures.images.request(context, url, pictures.session) },
        imageLoader = pictures.images.loader,
        contentDescription = alt,
        modifier =
            modifier
                .heightIn(max = windowHeight * frame.heightShare)
                .aspectRatio(ratio)
                .clip(RoundedCornerShape(16.dp))
                .background(MaterialTheme.colorScheme.surfaceContainerHigh),
        contentScale = ContentScale.Fit,
        onError = { failed = true },
    )
}

private const val DEFAULT_WIDTH = 1024L
private const val DEFAULT_HEIGHT = 1280L
