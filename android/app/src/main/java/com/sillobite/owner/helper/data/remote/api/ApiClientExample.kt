package com.sillobite.owner.helper.data.remote.api

import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.sillobite.owner.helper.data.local.TokenStorage
import com.sillobite.owner.helper.data.model.UserSession
import com.sillobite.owner.helper.data.remote.dto.Canteen
import com.sillobite.owner.helper.data.remote.dto.Counter
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch

/**
 * Example usage of ApiClient
 * 
 * Demonstrates:
 * - Login flow with error handling
 * - Fetching canteen data after login
 * - Fetching counters for canteen
 * - Saving session to TokenStorage
 * - Error handling patterns
 * 
 * This is a reference implementation showing recommended patterns
 */
class ApiClientExample(
    private val tokenStorage: TokenStorage
) : ViewModel() {

    companion object {
        private const val TAG = "ApiClientExample"
    }

    private val apiClient = ApiClient.getInstance()

    private val _loginState = MutableStateFlow<LoginState>(LoginState.Idle)
    val loginState: StateFlow<LoginState> = _loginState

    private val _canteenData = MutableStateFlow<Canteen?>(null)
    val canteenData: StateFlow<Canteen?> = _canteenData

    private val _counters = MutableStateFlow<List<Counter>>(emptyList())
    val counters: StateFlow<List<Counter>> = _counters

    sealed class LoginState {
        object Idle : LoginState()
        object Loading : LoginState()
        data class Success(val session: UserSession) : LoginState()
        data class Error(val message: String) : LoginState()
    }

    /**
     * Complete login flow
     * 1. Authenticate user
     * 2. Fetch canteen data
     * 3. Fetch counters (optional)
     * 4. Save session to storage
     */
    fun performLogin(email: String, password: String, serverUrl: String) {
        viewModelScope.launch {
            try {
                _loginState.value = LoginState.Loading

                // Step 1: Login
                val loginResult = apiClient.login(email, password)
                if (loginResult.isFailure) {
                    throw loginResult.exceptionOrNull() ?: Exception("Login failed")
                }

                val loginResponse = loginResult.getOrThrow()
                val user = loginResponse.user

                // Validate user role
                if (user.role != "canteen_owner") {
                    throw ApiException.Unauthorized("Only canteen owners can use this app")
                }

                // Step 2: Get canteen data
                val canteenResult = apiClient.getCanteenByOwner(user.email)
                if (canteenResult.isFailure) {
                    throw canteenResult.exceptionOrNull() ?: Exception("Failed to fetch canteen")
                }

                val canteen = canteenResult.getOrThrow().canteen
                _canteenData.value = canteen

                // Step 3: Get counters (optional)
                val countersResult = apiClient.getCounters(canteen.id)
                if (countersResult.isSuccess) {
                    _counters.value = countersResult.getOrThrow()
                }

                // Step 4: Save session
                val session = UserSession(
                    email = user.email,
                    userId = user.id.toString(),
                    userRole = user.role,
                    canteenId = canteen.id,
                    canteenName = canteen.name,
                    serverUrl = serverUrl,
                    isAuthenticated = true
                )

                tokenStorage.saveSession(session)

                _loginState.value = LoginState.Success(session)
                Log.d(TAG, "Login successful: ${user.email} -> ${canteen.name}")

            } catch (e: Exception) {
                val errorMessage = when (e) {
                    is ApiException.Unauthorized -> e.message ?: "Invalid credentials"
                    is ApiException.NotFound -> "Canteen not found for this user"
                    is ApiException.NetworkError -> e.message ?: "Network error"
                    is ApiException.ServerError -> "Server error. Please try again later"
                    else -> "Login failed: ${e.message}"
                }
                _loginState.value = LoginState.Error(errorMessage)
                Log.e(TAG, "Login failed", e)
            }
        }
    }

    /**
     * Fetch canteen data only
     * Useful for refreshing canteen information
     */
    fun fetchCanteenData(email: String) {
        viewModelScope.launch {
            try {
                val result = apiClient.getCanteenByOwner(email)
                if (result.isSuccess) {
                    _canteenData.value = result.getOrThrow().canteen
                    Log.d(TAG, "Canteen data fetched successfully")
                } else {
                    Log.e(TAG, "Failed to fetch canteen data", result.exceptionOrNull())
                }
            } catch (e: Exception) {
                Log.e(TAG, "Error fetching canteen data", e)
            }
        }
    }

    /**
     * Fetch counters for a canteen
     * Can filter by type: "payment", "store", or "kot"
     */
    fun fetchCounters(canteenId: String, type: String? = null) {
        viewModelScope.launch {
            try {
                val result = apiClient.getCounters(canteenId, type)
                if (result.isSuccess) {
                    _counters.value = result.getOrThrow()
                    Log.d(TAG, "Fetched ${_counters.value.size} counters")
                } else {
                    Log.e(TAG, "Failed to fetch counters", result.exceptionOrNull())
                }
            } catch (e: Exception) {
                Log.e(TAG, "Error fetching counters", e)
            }
        }
    }

    /**
     * Switch server environment
     * Useful for dev/staging/production switching
     */
    fun switchEnvironment(newBaseUrl: String) {
        ApiClient.reinitialize(newBaseUrl)
        viewModelScope.launch {
            tokenStorage.updateServerUrl(newBaseUrl)
        }
        Log.d(TAG, "Switched to new environment: $newBaseUrl")
    }
}

/**
 * Usage in Composable:
 * 
 * ```kotlin
 * @Composable
 * fun LoginScreen(viewModel: ApiClientExample) {
 *     val loginState by viewModel.loginState.collectAsState()
 *     val canteenData by viewModel.canteenData.collectAsState()
 *     
 *     var email by remember { mutableStateOf("") }
 *     var password by remember { mutableStateOf("") }
 *     
 *     Column(modifier = Modifier.padding(16.dp)) {
 *         TextField(
 *             value = email,
 *             onValueChange = { email = it },
 *             label = { Text("Email") }
 *         )
 *         
 *         TextField(
 *             value = password,
 *             onValueChange = { password = it },
 *             label = { Text("Password") },
 *             visualTransformation = PasswordVisualTransformation()
 *         )
 *         
 *         Button(
 *             onClick = {
 *                 viewModel.performLogin(
 *                     email = email,
 *                     password = password,
 *                     serverUrl = ApiClient.DEFAULT_BASE_URL_EMULATOR
 *                 )
 *             },
 *             enabled = loginState !is LoginState.Loading
 *         ) {
 *             Text("Login")
 *         }
 *         
 *         when (val state = loginState) {
 *             is LoginState.Loading -> {
 *                 CircularProgressIndicator()
 *             }
 *             is LoginState.Success -> {
 *                 Text("Welcome to ${canteenData?.name}")
 *                 // Navigate to home screen
 *             }
 *             is LoginState.Error -> {
 *                 Text("Error: ${state.message}", color = Color.Red)
 *             }
 *             LoginState.Idle -> {
 *                 // Show nothing or welcome message
 *             }
 *         }
 *     }
 * }
 * ```
 */
