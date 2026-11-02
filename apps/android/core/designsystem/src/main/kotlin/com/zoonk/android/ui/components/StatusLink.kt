package com.zoonk.android.ui.components

import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.LinkAnnotation
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.TextLinkStyles
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.text.withLink

fun statusLink(
    label: String,
    onClick: () -> Unit,
): AnnotatedString =
    buildAnnotatedString {
        withLink(
            LinkAnnotation.Clickable(
                tag = label,
                styles = TextLinkStyles(SpanStyle(fontWeight = FontWeight.Medium, textDecoration = TextDecoration.Underline)),
            ) { onClick() },
        ) { append(label) }
    }
