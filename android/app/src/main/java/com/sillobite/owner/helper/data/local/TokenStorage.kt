package com.sillobite.owner.helper.data.local

import android.content.Context
import android.util.Log
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.booleanPreferencesKey
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.emptyPreferences
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import com.sillobite.owner.helper.data.model.UserSession
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map
import java.io.IOException

/**
 * Secure token storage using DataStore Preferences
 * 
 * Responsibilities:
 * - Store user session data securely
 * - Provide observable state via Kotlin Flow
 * - Handle authentication state changes
 * - Thread-safe operations
 * 
 * All operations are performed on IO dispatcher and are safe for concurrent access
 */
class TokenStorage(private val context: Context) {

    companion object {
        private const val TAG = "TokenStorage"
        private const val DATASTORE_NAME = "user_session"

        // Preference keys
        private val KEY_EMAIL = stringPreferencesKey("email")
        private val KEY_USER_ID = stringPreferencesKey("user_id")
        private val KEY_USER_ROLE = stringPreferencesKey("user_role")
        private val KEY_CANTEEN_ID = stringPreferencesKey("canteen_id")
        private val KEY_CANTEEN_NAME = stringPreferencesKey("canteen_name")
        private val KEY_SERVER_URL = stringPreferencesKey("server_url")
        private val KEY_IS_AUTHENTICATED = booleanPreferencesKey("is_authenticated")
        
        // Notification settings
        private val KEY_ALARM_REPEAT_MODE = booleanPreferencesKey("alarm_repeat_mode") // true = repeat, false = once
    }

    // DataStore instance (lazy initialization)
    private val Context.dataStore: DataStore<Preferences> by preferencesDataStore(
        name = DATASTORE_NAME
    )

    /**
     * Save complete user session atomically
     * All fields are saved in a single transaction
     * 
     * @param session UserSession data to save
     */
    suspend fun saveSession(session: UserSession) {
        try {
            context.dataStore.edit { preferences ->
                preferences[KEY_EMAIL] = session.email
                preferences[KEY_USER_ID] = session.userId
                preferences[KEY_USER_ROLE] = session.userRole
                preferences[KEY_CANTEEN_ID] = session.canteenId
                preferences[KEY_CANTEEN_NAME] = session.canteenName
                preferences[KEY_SERVER_URL] = session.serverUrl
                preferences[KEY_IS_AUTHENTICATED] = session.isAuthenticated
            }
            Log.d(TAG, "Session saved: email=${session.email}, canteenId=${session.canteenId}")
        } catch (e: IOException) {
            Log.e(TAG, "Error saving session", e)
            throw e
        }
    }

    /**
     * Retrieve user session as observable Flow
     * Automatically updates when data changes
     * 
     * @return Flow emitting UserSession updates
     */
    fun getSession(): Flow<UserSession> {
        return context.dataStore.data
            .catch { exception ->
                if (exception is IOException) {
                    Log.e(TAG, "Error reading session", exception)
                    emit(emptyPreferences())
                } else {
                    throw exception
                }
            }
            .map { preferences ->
                UserSession(
                    email = preferences[KEY_EMAIL] ?: "",
                    userId = preferences[KEY_USER_ID] ?: "",
                    userRole = preferences[KEY_USER_ROLE] ?: "",
                    canteenId = preferences[KEY_CANTEEN_ID] ?: "",
                    canteenName = preferences[KEY_CANTEEN_NAME] ?: "",
                    serverUrl = preferences[KEY_SERVER_URL] ?: "",
                    isAuthenticated = preferences[KEY_IS_AUTHENTICATED] ?: false
                )
            }
    }

    /**
     * Retrieve user session synchronously (suspend function)
     * Use this when you need immediate session data
     * 
     * @return Current UserSession
     */
    suspend fun getSessionSync(): UserSession {
        return try {
            getSession().first()
        } catch (e: Exception) {
            Log.e(TAG, "Error getting session synchronously", e)
            UserSession.empty()
        }
    }

    /**
     * Check authentication status as observable Flow
     * 
     * @return Flow<Boolean> emitting true if authenticated
     */
    fun isAuthenticated(): Flow<Boolean> {
        return context.dataStore.data
            .catch { exception ->
                if (exception is IOException) {
                    Log.e(TAG, "Error reading auth state", exception)
                    emit(emptyPreferences())
                } else {
                    throw exception
                }
            }
            .map { preferences ->
                preferences[KEY_IS_AUTHENTICATED] ?: false
            }
    }

    /**
     * Get canteen ID as observable Flow
     * 
     * @return Flow<String?> emitting canteenId or null
     */
    fun getCanteenId(): Flow<String?> {
        return context.dataStore.data
            .catch { exception ->
                if (exception is IOException) {
                    Log.e(TAG, "Error reading canteen ID", exception)
                    emit(emptyPreferences())
                } else {
                    throw exception
                }
            }
            .map { preferences ->
                preferences[KEY_CANTEEN_ID]?.takeIf { it.isNotBlank() }
            }
    }

    /**
     * Get server URL as observable Flow
     * 
     * @return Flow<String?> emitting serverUrl or null
     */
    fun getServerUrl(): Flow<String?> {
        return context.dataStore.data
            .catch { exception ->
                if (exception is IOException) {
                    Log.e(TAG, "Error reading server URL", exception)
                    emit(emptyPreferences())
                } else {
                    throw exception
                }
            }
            .map { preferences ->
                preferences[KEY_SERVER_URL]?.takeIf { it.isNotBlank() }
            }
    }

    /**
     * Clear all session data (logout)
     * Atomically removes all stored preferences
     */
    suspend fun clearSession() {
        try {
            context.dataStore.edit { preferences ->
                preferences.clear()
            }
            Log.d(TAG, "Session cleared (logout)")
        } catch (e: IOException) {
            Log.e(TAG, "Error clearing session", e)
            throw e
        }
    }

    /**
     * Update server URL only
     * Useful for switching between dev/staging/production
     * 
     * @param serverUrl New server URL
     */
    suspend fun updateServerUrl(serverUrl: String) {
        try {
            context.dataStore.edit { preferences ->
                preferences[KEY_SERVER_URL] = serverUrl
            }
            Log.d(TAG, "Server URL updated: $serverUrl")
        } catch (e: IOException) {
            Log.e(TAG, "Error updating server URL", e)
            throw e
        }
    }

    /**
     * Update authentication status only
     * 
     * @param isAuthenticated New authentication state
     */
    suspend fun updateAuthenticationStatus(isAuthenticated: Boolean) {
        try {
            context.dataStore.edit { preferences ->
                preferences[KEY_IS_AUTHENTICATED] = isAuthenticated
            }
            Log.d(TAG, "Authentication status updated: $isAuthenticated")
        } catch (e: IOException) {
            Log.e(TAG, "Error updating authentication status", e)
            throw e
        }
    }
    
    /**
     * Get alarm repeat mode setting
     * 
     * @return Flow<Boolean> true = repeat until dismissed, false = play once
     */
    fun getAlarmRepeatMode(): Flow<Boolean> {
        return context.dataStore.data
            .catch { exception ->
                if (exception is IOException) {
                    Log.e(TAG, "Error reading alarm repeat mode", exception)
                    emit(emptyPreferences())
                } else {
                    throw exception
                }
            }
            .map { preferences ->
                preferences[KEY_ALARM_REPEAT_MODE] ?: false // Default: play once
            }
    }
    
    /**
     * Get alarm repeat mode synchronously
     * 
     * @return Boolean true = repeat, false = play once
     */
    suspend fun getAlarmRepeatModeSync(): Boolean {
        return try {
            getAlarmRepeatMode().first()
        } catch (e: Exception) {
            Log.e(TAG, "Error getting alarm repeat mode synchronously", e)
            false // Default: play once
        }
    }
    
    /**
     * Update alarm repeat mode setting
     * 
     * @param repeatMode true = repeat until dismissed, false = play once
     */
    suspend fun updateAlarmRepeatMode(repeatMode: Boolean) {
        try {
            context.dataStore.edit { preferences ->
                preferences[KEY_ALARM_REPEAT_MODE] = repeatMode
            }
            Log.d(TAG, "Alarm repeat mode updated: ${if (repeatMode) "Repeat" else "Once"}")
        } catch (e: IOException) {
            Log.e(TAG, "Error updating alarm repeat mode", e)
            throw e
        }
    }
}
