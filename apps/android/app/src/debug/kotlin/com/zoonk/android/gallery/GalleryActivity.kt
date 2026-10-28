package com.zoonk.android.gallery

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import com.zoonk.android.ui.theme.ZoonkTheme

/** The design system's gallery on a device, following its dark theme, contrast and font size. */
class GalleryActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            ZoonkTheme {
                ComponentGallery()
            }
        }
    }
}
