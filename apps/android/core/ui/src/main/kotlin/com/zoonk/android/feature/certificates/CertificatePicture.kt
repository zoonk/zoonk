package com.zoonk.android.feature.certificates

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import coil3.compose.AsyncImage
import com.zoonk.android.data.PrivateImages
import com.zoonk.api.models.OwnedCertificate

/**
 * The certificate as main draws it, a white sheet in light and dark alike, as a
 * PDF viewer shows paper; a hairline keeps its edge on a white page. Null [url] keeps its space.
 */
@Composable
fun CertificatePicture(
    url: String?,
    images: PrivateImages,
    contentDescription: String?,
    modifier: Modifier = Modifier,
    corner: Dp = 6.dp,
) {
    val context = LocalContext.current
    val shape = RoundedCornerShape(corner)
    val sheet =
        modifier
            .aspectRatio(SHEET_RATIO)
            .clip(shape)
            .background(Color.White)
            .border(1.dp, MaterialTheme.colorScheme.outlineVariant, shape)

    if (url == null) {
        Box(sheet)
        return
    }

    AsyncImage(
        model = remember(url) { images.request(context, url, null) },
        imageLoader = images.loader,
        contentDescription = contentDescription,
        modifier = sheet,
        contentScale = ContentScale.Fit,
    )
}

/** The picture screens show; printing and Download take `print`. */
val OwnedCertificate.pictureUrl: String get() = imageUrls.screen.toString()

/** Main's `screen` picture, 2246 × 1588: A4 landscape, as `print` is. */
private const val SHEET_RATIO = 2246f / 1588f
