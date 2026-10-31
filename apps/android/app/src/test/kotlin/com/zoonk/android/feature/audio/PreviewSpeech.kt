package com.zoonk.android.feature.audio

import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.platform.LocalContext
import com.zoonk.android.app.AppContainer

/** The app's player for screens under test; it makes no request and no sound unless a test asks. */
@Composable
fun previewSpeech(): SpeechPlayer {
    val context = LocalContext.current
    return remember { AppContainer.preview(context).speech }
}
