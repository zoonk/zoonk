package com.zoonk.android

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import com.zoonk.android.app.ZoonkApp
import com.zoonk.android.ui.theme.ZoonkTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            ZoonkTheme {
                ZoonkApp()
            }
        }
    }
}
