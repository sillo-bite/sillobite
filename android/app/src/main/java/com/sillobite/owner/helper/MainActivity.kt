package com.sillobite.owner.helper

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.runtime.*
import com.sillobite.owner.helper.ui.navigation.AppNavigation
import com.sillobite.owner.helper.ui.theme.CanteenOwnerHelperTheme
import com.sillobite.owner.helper.ui.viewmodel.HomeViewModel
import com.sillobite.owner.helper.ui.viewmodel.LoginViewModel
import com.sillobite.owner.helper.ui.viewmodel.SettingsViewModel

class MainActivity : ComponentActivity() {
    private lateinit var loginViewModel: LoginViewModel
    private lateinit var homeViewModel: HomeViewModel
    private lateinit var settingsViewModel: SettingsViewModel

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        
        // Initialize ViewModels
        loginViewModel = LoginViewModel(applicationContext)
        homeViewModel = HomeViewModel(applicationContext)
        settingsViewModel = SettingsViewModel(applicationContext)
        
        setContent {
            CanteenOwnerHelperTheme {
                var isAuthenticated by remember { mutableStateOf(false) }
                
                // Check authentication on app start
                LaunchedEffect(Unit) {
                    loginViewModel.checkAuthentication()
                }
                
                // Observe authentication state from LoginViewModel
                val loginSuccess by loginViewModel.uiState.collectAsState()
                LaunchedEffect(loginSuccess.isLoginSuccess) {
                    if (loginSuccess.isLoginSuccess) {
                        isAuthenticated = true
                    }
                }
                
                // Also observe authentication from TokenStorage Flow
                val isAuthenticatedFromStorage by loginViewModel.isAuthenticated.collectAsState(initial = false)
                LaunchedEffect(isAuthenticatedFromStorage) {
                    isAuthenticated = isAuthenticatedFromStorage
                }
                
                // App Navigation with proper back stack management
                AppNavigation(
                    loginViewModel = loginViewModel,
                    homeViewModel = homeViewModel,
                    settingsViewModel = settingsViewModel,
                    isAuthenticated = isAuthenticated
                )
            }
        }
    }
}
