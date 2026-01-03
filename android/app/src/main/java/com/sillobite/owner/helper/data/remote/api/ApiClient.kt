package com.sillobite.owner.helper.data.remote.api

import android.util.Log
import com.google.gson.Gson
import com.google.gson.GsonBuilder
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.HttpException
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import java.io.IOException
import java.net.SocketTimeoutException
import java.net.UnknownHostException
import java.util.concurrent.TimeUnit

/**
 * API Client for REST API communication
 * 
 * Features:
 * - Dynamic base URL configuration
 * - HTTP logging in debug mode
 * - 30-second timeout for all operations
 * - Gson with lenient parsing
 * - Comprehensive error handling
 * 
 * Usage:
 * ```kotlin
 * val apiClient = ApiClient.getInstance()
 * val loginResponse = apiClient.login("email@example.com", "password")
 * ```
 */
class ApiClient private constructor(private val baseUrl: String) {

    companion object {
        private const val TAG = "ApiClient"
        
        // ========================================
        // SERVER URL CONFIGURATION
        // ========================================
        // Change DEFAULT_BASE_URL to switch environment
        
        // Development URLs
        const val URL_EMULATOR = "http://10.0.2.2:5000"       // Android emulator → localhost:5000
        const val URL_DEVICE_LOCAL = "http://192.168.1.x:5000" // Physical device → local network
        
        // Production URLs
        const val URL_RAILWAY = "https://sillobite.in"  // TODO: Replace with your Railway URL
        const val URL_PRODUCTION = "https://api.sillobite.com"  // Alternative production URL
        
        // ========================================
        // SET YOUR DEFAULT URL HERE
        // ========================================
        // For development: Use URL_EMULATOR
        // For testing on device: Use URL_DEVICE_LOCAL (update IP address)
        // For production: Use URL_RAILWAY or URL_PRODUCTION
        
        const val DEFAULT_BASE_URL = URL_RAILWAY  // <-- Change this to URL_RAILWAY for production
        
        // Legacy constants for compatibility
        const val DEFAULT_BASE_URL_EMULATOR = URL_EMULATOR
        const val DEFAULT_BASE_URL_DEVICE = URL_DEVICE_LOCAL
        const val DEFAULT_BASE_URL_PRODUCTION = URL_PRODUCTION
        
        private const val TIMEOUT_SECONDS = 30L
        
        @Volatile
        private var instance: ApiClient? = null
        
        /**
         * Get singleton instance with default URL
         * 
         * @param baseUrl Server base URL (default: configured URL)
         * @return ApiClient instance
         */
        fun getInstance(baseUrl: String = DEFAULT_BASE_URL): ApiClient {
            return instance ?: synchronized(this) {
                instance ?: ApiClient(baseUrl).also { instance = it }
            }
        }
        
        /**
         * Reinitialize with new base URL
         * Useful for switching between environments
         * 
         * @param baseUrl New server base URL
         */
        fun reinitialize(baseUrl: String) {
            synchronized(this) {
                instance = null
                instance = ApiClient(baseUrl)
                Log.d(TAG, "API Client reinitialized with URL: $baseUrl")
            }
        }
    }

    private val apiService: ApiService

    init {
        Log.d(TAG, "Initializing API Client with base URL: $baseUrl")
        
        // Create Gson with lenient parsing
        val gson: Gson = GsonBuilder()
            .setLenient()
            .create()
        
        // Create OkHttp client with logging and timeout
        val okHttpClient = OkHttpClient.Builder()
            .addInterceptor(createLoggingInterceptor())
            .connectTimeout(TIMEOUT_SECONDS, TimeUnit.SECONDS)
            .readTimeout(TIMEOUT_SECONDS, TimeUnit.SECONDS)
            .writeTimeout(TIMEOUT_SECONDS, TimeUnit.SECONDS)
            .build()
        
        // Create Retrofit instance
        val retrofit = Retrofit.Builder()
            .baseUrl(baseUrl)
            .client(okHttpClient)
            .addConverterFactory(GsonConverterFactory.create(gson))
            .build()
        
        apiService = retrofit.create(ApiService::class.java)
    }

    /**
     * Create HTTP logging interceptor
     * Logs full request/response in debug mode
     */
    private fun createLoggingInterceptor(): HttpLoggingInterceptor {
        return HttpLoggingInterceptor { message ->
            Log.d(TAG, message)
        }.apply {
            level = HttpLoggingInterceptor.Level.BODY
        }
    }

    /**
     * Login user with email and password
     * 
     * @param identifier User email or username
     * @param password User password
     * @return LoginResponse on success
     * @throws ApiException on errors
     */
    suspend fun login(identifier: String, password: String): Result<com.sillobite.owner.helper.data.remote.dto.LoginResponse> {
        return try {
            val request = com.sillobite.owner.helper.data.remote.dto.LoginRequest(identifier, password)
            val response = apiService.login(request)
            Log.d(TAG, "Login successful: ${response.user.email}")
            Result.success(response)
        } catch (e: Exception) {
            Log.e(TAG, "Login failed", e)
            Result.failure(handleException(e))
        }
    }

    /**
     * Get canteen by owner email
     * 
     * @param email Owner's email address
     * @return CanteenResponse on success
     * @throws ApiException on errors
     */
    suspend fun getCanteenByOwner(email: String): Result<com.sillobite.owner.helper.data.remote.dto.CanteenResponse> {
        return try {
            val response = apiService.getCanteenByOwner(email)
            Log.d(TAG, "Canteen retrieved: ${response.canteen.name} (${response.canteen.id})")
            Result.success(response)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to get canteen", e)
            Result.failure(handleException(e))
        }
    }

    /**
     * Get all counters for a canteen
     * 
     * @param canteenId MongoDB ObjectId of canteen
     * @param type Optional filter by counter type
     * @return List of Counter objects
     * @throws ApiException on errors
     */
    suspend fun getCounters(canteenId: String, type: String? = null): Result<List<com.sillobite.owner.helper.data.remote.dto.Counter>> {
        return try {
            val response = apiService.getCounters(canteenId, type)
            Log.d(TAG, "Retrieved ${response.size} counters for canteen $canteenId")
            Result.success(response)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to get counters", e)
            Result.failure(handleException(e))
        }
    }

    /**
     * Handle exceptions and convert to user-friendly error messages
     */
    private fun handleException(e: Exception): ApiException {
        return when (e) {
            is HttpException -> {
                val code = e.code()
                val errorBody = e.response()?.errorBody()?.string()
                when (code) {
                    401 -> ApiException.Unauthorized("Invalid credentials")
                    404 -> ApiException.NotFound("Resource not found")
                    500 -> ApiException.ServerError("Server error occurred")
                    else -> ApiException.HttpError(code, errorBody ?: "HTTP error $code")
                }
            }
            is UnknownHostException -> {
                ApiException.NetworkError("Cannot connect to server. Check your internet connection.")
            }
            is SocketTimeoutException -> {
                ApiException.NetworkError("Request timed out. Please try again.")
            }
            is IOException -> {
                ApiException.NetworkError("Network error: ${e.message}")
            }
            else -> {
                ApiException.Unknown("Unexpected error: ${e.message}")
            }
        }
    }
}

/**
 * API Exception types for better error handling
 */
sealed class ApiException(message: String) : Exception(message) {
    class Unauthorized(message: String) : ApiException(message)
    class NotFound(message: String) : ApiException(message)
    class ServerError(message: String) : ApiException(message)
    class NetworkError(message: String) : ApiException(message)
    class HttpError(val code: Int, message: String) : ApiException(message)
    class Unknown(message: String) : ApiException(message)
}
