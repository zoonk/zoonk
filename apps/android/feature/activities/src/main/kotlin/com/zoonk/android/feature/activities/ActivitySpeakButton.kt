package com.zoonk.android.feature.activities

import androidx.compose.foundation.layout.size
import androidx.compose.material3.FilledTonalIconButton
import androidx.compose.material3.Icon
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import com.zoonk.android.R
import com.zoonk.android.feature.audio.SpeechStatusIcon
import com.zoonk.android.feature.audio.SpokenAudio
import com.zoonk.android.feature.audio.SpokenText
import com.zoonk.android.feature.audio.buttonIconSize
import com.zoonk.android.feature.audio.speechActionLabel

/** Main's `ActivitySpeakButton`: an icon-only listen button named by what it plays, then by its state. */
@Composable
fun ActivitySpeakButton(
    audio: SpokenAudio,
    text: String,
    label: String,
    modifier: Modifier = Modifier,
) {
    val name = speechActionLabel(audio.state, label)
    FilledTonalIconButton(
        onClick = { if (audio.isBusy) audio.cancel() else audio.speak(listOf(SpokenText(text))) },
        modifier = modifier.semantics { contentDescription = name },
    ) {
        SpeechStatusIcon(audio.state) {
            Icon(painterResource(R.drawable.ic_volume_up), contentDescription = null, modifier = Modifier.size(buttonIconSize()))
        }
    }
}
