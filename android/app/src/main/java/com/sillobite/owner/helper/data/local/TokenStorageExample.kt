package com.sillobite.owner.helper.data.local

import android.content.Context
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.sillobite.owner.helper.data.model.UserSession
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch

/**
 * Example ViewModel demonstrating TokenStorage usage
 * 
 * This class shows the recommended patterns for:
 * - Saving user session after login
 * - Observing authentication state
 * - Retrieving session data
 * - Clearing session on logout
 * 
 * NOTE: This is an example/reference implementation
 * You can use this pattern in your actual ViewModels
 */
class TokenStorageExample(context: Context) : ViewModel() {

    private val tokenStorage = TokenStorage(context)

    // Observable authentication state
    val isAuthenticated: Flow<Boolean> = tokenStorage.isAuthenticated()

    // Observable session data
    val userSession: Flow<UserSession> = tokenStorage.getSession()

    // Local state for UI
    private val _loginState = MutableStateFlow<LoginState>(LoginState.Idle)
    val loginState: StateFlow<LoginState> = _loginState

    sealed class LoginState {
        object Idle : LoginState()
        object Loading : LoginState()
        data class Success(val session: UserSession) : LoginState()
        data class Error(val message: String) : LoginState()
    }

    /**
     * Example: Save user session after successful login
     */
    fun saveUserSession(
        email: String,
        userId: String,
        userRole: String,
        canteenId: String,
        canteenName: String,
        serverUrl: String
    ) {
        viewModelScope.launch {
            try {
                _loginState.value = LoginState.Loading

                val session = UserSession(
                    email = email,
                    userId = userId,
                    userRole = userRole,
                    canteenId = canteenId,
                    canteenName = canteenName,
                    serverUrl = serverUrl,
                    isAuthenticated = true
                )

                // Save to DataStore
                tokenStorage.saveSession(session)

                _loginState.value = LoginState.Success(session)
            } catch (e: Exception) {
                _loginState.value = LoginState.Error(e.message ?: "Failed to save session")
            }
        }
    }

    /**
     * Example: Get current session synchronously
     */
    fun getCurrentSession() {
        viewModelScope.launch {
            val session = tokenStorage.getSessionSync()
            if (session.isValid()) {
                // Session is valid, user is authenticated
                println("Current session: ${session.email}")
            } else {
                // No valid session, user needs to login
                println("No valid session")
            }
        }
    }

    /**
     * Example: Observe canteen ID changes
     */
    fun observeCanteenId(): Flow<String?> {
        return tokenStorage.getCanteenId()
    }

    /**
     * Example: Update server URL (e.g., switching environments)
     */
    fun updateServerUrl(newUrl: String) {
        viewModelScope.launch {
            try {
                tokenStorage.updateServerUrl(newUrl)
            } catch (e: Exception) {
                _loginState.value = LoginState.Error("Failed to update server URL")
            }
        }
    }

    /**
     * Example: Logout user
     */
    fun logout() {
        viewModelScope.launch {
            try {
                // Clear all session data
                tokenStorage.clearSession()
                _loginState.value = LoginState.Idle
            } catch (e: Exception) {
                _loginState.value = LoginState.Error("Failed to logout")
            }
        }
    }

    /**
     * Example: Check if user is authenticated on app start
     */
    fun checkAuthenticationStatus() {
        viewModelScope.launch {
            val session = tokenStorage.getSessionSync()
            if (session.isAuthenticated && session.isValid()) {
                // User is logged in, navigate to main screen
                _loginState.value = LoginState.Success(session)
            } else {
                // User is not logged in, show login screen
                _loginState.value = LoginState.Idle
            }
        }
    }
}

/**
 * Usage examples in Composables:
 * 
 * ```kotlin
 * @Composable
 * fun LoginScreen(viewModel: TokenStorageExample) {
 *     // Observe authentication state
 *     val isAuthenticated by viewModel.isAuthenticated.collectAsState(initial = false)
 *     
 *     // Observe session data
 *     val session by viewModel.userSession.collectAsState(initial = UserSession.empty())
 *     
 *     // Observe login state
 *     val loginState by viewModel.loginState.collectAsState()
 *     
 *     when (loginState) {
 *         is LoginState.Success -> {
 *             // Navigate to home screen
 *             Text("Welcome ${session.canteenName}")
 *         }
 *         is LoginState.Error -> {
 *             // Show error message
 *             Text("Error: ${(loginState as LoginState.Error).message}")
 *         }
 *         is LoginState.Loading -> {
 *             CircularProgressIndicator()
 *         }
 *         LoginState.Idle -> {
 *             // Show login form
 *             Button(onClick = {
 *                 viewModel.saveUserSession(
 *                     email = "owner@example.com",
 *                     userId = "123",
 *                     userRole = "canteen_owner",
 *                     canteenId = "abc123",
 *                     canteenName = "Main Canteen",
 *                     serverUrl = "http://localhost:5000"
 *                 )
 *             }) {
 *                 Text("Login")
 *             }
 *         }
 *     }
 * }
 * ```
 * 
 * Usage in Service:
 * 
 * ```kotlin
 * class OrderNotificationService : Service() {
 *     private lateinit var tokenStorage: TokenStorage
 *     
 *     override fun onCreate() {
 *         super.onCreate()
 *         tokenStorage = TokenStorage(applicationContext)
 *     }
 *     
 *     override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
 *         lifecycleScope.launch {
 *             // Get session data to connect WebSocket
 *             val session = tokenStorage.getSessionSync()
 *             if (session.isValid()) {
 *                 connectWebSocket(session.serverUrl, session.canteenId)
 *             }
 *         }
 *         return START_STICKY
 *     }
 * }
 * ```
 */
