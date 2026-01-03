package com.sillobite.owner.helper.ui.navigation

/**
 * Screen destinations for navigation
 * 
 * Sealed class containing all navigation routes as constants
 */
sealed class Screen(val route: String) {
    
    /**
     * Login Screen
     * - Start destination if not authenticated
     * - On login success: Navigate to Home, clear back stack
     */
    object Login : Screen("login")
    
    /**
     * Home Screen
     * - Start destination if authenticated
     * - On settings click: Navigate to Settings
     * - On logout click: Navigate to Login, clear entire back stack
     */
    object Home : Screen("home")
    
    /**
     * Settings Screen
     * - On back click: Pop back stack
     */
    object Settings : Screen("settings")
}
