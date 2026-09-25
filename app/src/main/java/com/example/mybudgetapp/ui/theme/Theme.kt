package com.example.mybudgetapp.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

private val LightColors = lightColorScheme(
    primary = Color(0xFF176B58),
    onPrimary = Color.White,
    primaryContainer = Color(0xFFCEEDE0),
    onPrimaryContainer = Color(0xFF102F27),
    secondaryContainer = Color(0xFFE9EEDF),
    onSecondaryContainer = Color(0xFF394632),
    background = Color(0xFFF7F8F3),
    surface = Color(0xFFF7F8F3),
    surfaceVariant = Color(0xFFDDE5DC),
)
private val DarkColors = darkColorScheme(
    primary = Color(0xFF8ED5B8),
    onPrimary = Color(0xFF00382B),
    primaryContainer = Color(0xFF18513F),
    onPrimaryContainer = Color(0xFFC9EDDE),
    secondaryContainer = Color(0xFF354538),
    onSecondaryContainer = Color(0xFFD8E7D6),
    background = Color(0xFF111815),
    surface = Color(0xFF111815),
    surfaceVariant = Color(0xFF3E4942),
)

@Composable
fun MyBudgetAppTheme(darkTheme: Boolean = isSystemInDarkTheme(), content: @Composable () -> Unit) {
    MaterialTheme(colorScheme = if (darkTheme) DarkColors else LightColors,
        typography = Typography, content = content)
}
