package com.sillobite.owner.helper.ui.navigation

import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import com.sillobite.owner.helper.ui.screens.HomeScreen
import com.sillobite.owner.helper.ui.screens.LoginScreen
import com.sillobite.owner.helper.ui.screens.SettingsScreen
import com.sillobite.owner.helper.ui.viewmodel.HomeViewModel
import com.sillobite.owner.helper.ui.viewmodel.LoginViewModel
import com.sillobite.owner.helper.ui.viewmodel.SettingsViewModel

/**
 * Main App Navigation
 * 
 * Manages navigation between Login, Home, and Settings screens
 * with proper back stack management and authentication checks
 */
@Composable
fun AppNavigation(
    loginViewModel: LoginViewModel,
    homeViewModel: HomeViewModel,
    settingsViewModel: SettingsViewModel,
    isAuthenticated: Boolean
) {
    val navController = rememberNavController()
    
    // Determine start destination based on authentication state
    val startDestination = if (isAuthenticated) {
        Screen.Home.route
    } else {
        Screen.Login.route
    }

    NavHost(
        navController = navController,
        startDestination = startDestination
    ) {
        // Login Screen
        composable(route = Screen.Login.route) {
            LoginScreen(
                viewModel = loginViewModel,
                onLoginSuccess = {
                    // Navigate to Home, clear back stack (prevent back to login)
                    navController.navigate(Screen.Home.route) {
                        popUpTo(Screen.Login.route) { inclusive = true }
                        launchSingleTop = true
                    }
                }
            )
        }

        // Home Screen
        composable(route = Screen.Home.route) {
            HomeScreen(
                viewModel = homeViewModel,
                onLogout = {
                    // Navigate to Login, clear entire back stack
                    navController.navigate(Screen.Login.route) {
                        popUpTo(0) { inclusive = true }
                        launchSingleTop = true
                    }
                },
                onNavigateToSettings = {
                    // Normal navigation to Settings
                    navController.navigate(Screen.Settings.route)
                }
            )
        }

        // Settings Screen
        composable(route = Screen.Settings.route) {
            SettingsScreen(
                viewModel = settingsViewModel,
                onNavigateBack = {
                    // Pop back stack (return to Home)
                    navController.popBackStack()
                }
            )
        }
    }
}

/**
 * Navigation helper to handle logout from any screen
 * 
 * Usage in any screen:
 * ```
 * val navController = LocalNavController.current
 * navigateToLoginAndClearStack(navController)
 * ```
 */
fun navigateToLoginAndClearStack(navController: NavHostController) {
    navController.navigate(Screen.Login.route) {
        popUpTo(0) { inclusive = true }
        launchSingleTop = true
    }
}

/**
 * Navigation helper to navigate from Login to Home with back stack cleared
 */
fun navigateToHomeFromLogin(navController: NavHostController) {
    navController.navigate(Screen.Home.route) {
        popUpTo(Screen.Login.route) { inclusive = true }
        launchSingleTop = true
    }
}
