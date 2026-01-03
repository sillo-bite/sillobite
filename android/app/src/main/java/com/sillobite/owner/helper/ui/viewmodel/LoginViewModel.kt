package com.sillobite.owner.helper.ui.viewmodel

import android.content.Context
import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.sillobite.owner.helper.CanteenOwnerHelperApplication
import com.sillobite.owner.helper.data.local.TokenStorage
import com.sillobite.owner.helper.data.model.UserSession
import com.sillobite.owner.helper.data.remote.api.ApiClient
import com.sillobite.owner.helper.data.remote.api.ApiException
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

/**
 * ViewModel for Login Screen
 * 
 * Handles:
 * - User input validation
 * - Authentication logic
 * - Session storage
 * - Error handling
 * - Navigation state
 */
class LoginViewModel(context: Context) : ViewModel() {

    companion object {
        private const val TAG = "LoginViewModel"
    }

    // Use singleton TokenStorage from Application
    private val tokenStorage = CanteenOwnerHelperApplication.getTokenStorage(context.applicationContext as CanteenOwnerHelperApplication)
    private val apiClient = ApiClient.getInstance()

    // UI State
    private val _uiState = MutableStateFlow(LoginUiState())
    val uiState: StateFlow<LoginUiState> = _uiState.asStateFlow()

    // Authentication state (observable for auto-login check)
    val isAuthenticated = tokenStorage.isAuthenticated()

    /**
     * UI State data class
     */
    data class LoginUiState(
        val serverUrl: String = ApiClient.DEFAULT_BASE_URL,
        val email: String = "",
        val password: String = "",
        val isLoading: Boolean = false,
        val errorMessage: String? = null,
        val isLoginSuccess: Boolean = false,
        val emailError: String? = null,
        val passwordError: String? = null
    )

    /**
     * Update server URL
     */
    fun onServerUrlChange(url: String) {
        _uiState.value = _uiState.value.copy(
            serverUrl = url,
            errorMessage = null
        )
    }

    /**
     * Update email
     */
    fun onEmailChange(email: String) {
        _uiState.value = _uiState.value.copy(
            email = email,
            emailError = null,
            errorMessage = null
        )
    }

    /**
     * Update password
     */
    fun onPasswordChange(password: String) {
        _uiState.value = _uiState.value.copy(
            password = password,
            passwordError = null,
            errorMessage = null
        )
    }

    /**
     * Clear error message
     */
    fun clearError() {
        _uiState.value = _uiState.value.copy(errorMessage = null)
    }

    /**
     * Validate inputs
     */
    private fun validateInputs(): Boolean {
        val state = _uiState.value
        var isValid = true

        // Validate server URL
        if (state.serverUrl.isBlank()) {
            _uiState.value = state.copy(errorMessage = "Server URL is required")
            return false
        }

        // Validate email
        if (state.email.isBlank()) {
            _uiState.value = state.copy(emailError = "Email is required")
            isValid = false
        } else if (!android.util.Patterns.EMAIL_ADDRESS.matcher(state.email).matches()) {
            _uiState.value = state.copy(emailError = "Invalid email format")
            isValid = false
        }

        // Validate password
        if (state.password.isBlank()) {
            _uiState.value = state.copy(passwordError = "Password is required")
            isValid = false
        } else if (state.password.length < 6) {
            _uiState.value = state.copy(passwordError = "Password must be at least 6 characters")
            isValid = false
        }

        return isValid
    }

    /**
     * Perform login
     */
    fun login() {
        if (!validateInputs()) {
            return
        }

        viewModelScope.launch {
            try {
                val state = _uiState.value
                _uiState.value = state.copy(
                    isLoading = true,
                    errorMessage = null
                )

                Log.d(TAG, "Starting login for ${state.email}")

                // Reinitialize API client with new server URL if changed
                if (state.serverUrl != ApiClient.DEFAULT_BASE_URL) {
                    ApiClient.reinitialize(state.serverUrl)
                }

                // Step 1: Login
                val loginResult = apiClient.login(state.email, state.password)
                if (loginResult.isFailure) {
                    throw loginResult.exceptionOrNull() ?: Exception("Login failed")
                }

                val loginResponse = loginResult.getOrThrow()
                val user = loginResponse.user

                // Validate user role
                if (user.role != "canteen_owner") {
                    throw ApiException.Unauthorized("Only canteen owners can use this app")
                }

                Log.d(TAG, "Login successful, fetching canteen data")

                // Step 2: Get canteen data
                val canteenResult = apiClient.getCanteenByOwner(user.email)
                if (canteenResult.isFailure) {
                    throw canteenResult.exceptionOrNull() ?: Exception("Failed to fetch canteen")
                }

                val canteen = canteenResult.getOrThrow().canteen

                Log.d(TAG, "Canteen data retrieved: ${canteen.name}")

                // Step 3: Save session
                val session = UserSession(
                    email = user.email,
                    userId = user.id.toString(),
                    userRole = user.role,
                    canteenId = canteen.id,
                    canteenName = canteen.name,
                    serverUrl = state.serverUrl,
                    isAuthenticated = true
                )

                tokenStorage.saveSession(session)

                Log.d(TAG, "Session saved, login complete")

                _uiState.value = state.copy(
                    isLoading = false,
                    isLoginSuccess = true,
                    errorMessage = null
                )

            } catch (e: Exception) {
                Log.e(TAG, "Login failed", e)

                val errorMessage = when (e) {
                    is ApiException.Unauthorized -> e.message ?: "Invalid credentials"
                    is ApiException.NotFound -> "Canteen not found for this user"
                    is ApiException.NetworkError -> e.message ?: "Network error. Check your connection."
                    is ApiException.ServerError -> "Server error. Please try again later."
                    else -> "Login failed: ${e.message}"
                }

                _uiState.value = _uiState.value.copy(
                    isLoading = false,
                    errorMessage = errorMessage
                )
            }
        }
    }

    /**
     * Check if already authenticated on app start
     */
    fun checkAuthentication() {
        viewModelScope.launch {
            val session = tokenStorage.getSessionSync()
            if (session.isAuthenticated && session.isValid()) {
                Log.d(TAG, "User already authenticated: ${session.email}")
                _uiState.value = _uiState.value.copy(isLoginSuccess = true)
            }
        }
    }

    /**
     * Reset login success state
     * Call this after navigation to prevent repeated navigation
     */
    fun resetLoginSuccess() {
        _uiState.value = _uiState.value.copy(isLoginSuccess = false)
    }
}
