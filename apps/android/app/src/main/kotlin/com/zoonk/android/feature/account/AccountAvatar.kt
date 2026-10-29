package com.zoonk.android.feature.account

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.unit.Dp
import coil3.compose.AsyncImage
import com.zoonk.api.models.MeUser

/** Main's user avatar: the account's picture, or the first letter of its name. Decorative: rows name the account. */
@Composable
fun AccountAvatar(
    user: MeUser,
    size: Dp,
    modifier: Modifier = Modifier,
) {
    val shape = modifier.size(size).clip(CircleShape)
    val image = user.image

    if (image != null) {
        AsyncImage(model = image, contentDescription = null, modifier = shape, contentScale = ContentScale.Crop)
        return
    }

    Box(shape.background(MaterialTheme.colorScheme.secondaryContainer), contentAlignment = Alignment.Center) {
        Text(
            text =
                user.name
                    .ifBlank { user.email }
                    .take(1)
                    .uppercase(),
            color = MaterialTheme.colorScheme.onSecondaryContainer,
            style = MaterialTheme.typography.titleMedium,
        )
    }
}
