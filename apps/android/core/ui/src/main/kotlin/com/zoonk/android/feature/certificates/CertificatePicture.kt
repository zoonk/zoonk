package com.zoonk.android.feature.certificates

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import coil3.compose.AsyncImage
import com.zoonk.android.R
import com.zoonk.android.data.PrivateImages
import com.zoonk.android.ui.format.DateStyle
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.formatDate
import com.zoonk.android.ui.theme.ZoonkRadius
import com.zoonk.android.ui.theme.zoonkType
import com.zoonk.api.models.OwnedCertificate
import kotlinx.datetime.toJavaLocalDate

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
    corner: Dp = ZoonkRadius.md,
) {
    val context = LocalContext.current
    val sheet = modifier.sheet(Color.White, MaterialTheme.colorScheme.outlineVariant, corner)

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

/**
 * A locked certificate in its picture's place: the sheet's frame and shape with its name, its date
 * and a lock, and no picture. [compact] keeps only the lock, for a list row's thumbnail.
 */
@Composable
fun LockedCertificate(
    name: CertificateName,
    modifier: Modifier = Modifier,
    corner: Dp = ZoonkRadius.md,
    compact: Boolean = false,
) {
    val locked = stringResource(R.string.certificates_locked)

    Column(
        modifier
            .sheet(MaterialTheme.colorScheme.surfaceContainerHigh, MaterialTheme.colorScheme.outlineVariant, corner)
            .padding(if (compact) 8.dp else 16.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp, Alignment.CenterVertically),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Icon(
            painterResource(R.drawable.ic_lock),
            contentDescription = if (compact) null else locked,
            tint = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        if (!compact) {
            Text(
                name.words(),
                style = MaterialTheme.typography.titleMedium,
                textAlign = TextAlign.Center,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis,
            )
            Text(
                formatDate(name.completedOn.toJavaLocalDate(), currentLocale(), DateStyle.LongYear),
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                style = MaterialTheme.zoonkType.data,
            )
        }
    }
}

/** A locked one goes without, so callers show [LockedCertificate] instead. */
val OwnedCertificate.pictureUrl: String? get() = imageUrls?.screen?.toString()

private fun Modifier.sheet(
    color: Color,
    edge: Color,
    corner: Dp,
): Modifier {
    val shape = RoundedCornerShape(corner)
    return aspectRatio(SHEET_RATIO).clip(shape).background(color).border(1.dp, edge, shape)
}

/** Main's `screen` picture, 2246 × 1588: A4 landscape, as `print` is. */
private const val SHEET_RATIO = 2246f / 1588f
