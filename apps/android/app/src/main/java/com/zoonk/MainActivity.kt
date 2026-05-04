package com.zoonk

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.tooling.preview.Preview
import com.zoonk.ui.theme.ZoonkTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            ZoonkTheme {
                HelloWorldApp()
            }
        }
    }
}

/**
 * Keeps the bootstrap screen separate from Android lifecycle setup so the first
 * real screen can replace this without changing how the app starts.
 */
@Composable
private fun HelloWorldApp() {
    Surface(
        modifier = Modifier.fillMaxSize(),
    ) {
        Box(
            modifier = Modifier.fillMaxSize(),
            contentAlignment = Alignment.Center,
        ) {
            Text(text = "hello world")
        }
    }
}

@Preview(showBackground = true)
@Composable
private fun HelloWorldPreview() {
    ZoonkTheme {
        HelloWorldApp()
    }
}
