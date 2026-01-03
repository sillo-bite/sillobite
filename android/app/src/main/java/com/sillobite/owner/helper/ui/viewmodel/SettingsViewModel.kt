package com.sillobite.owner.helper.ui.viewmodel

import android.content.Context
import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.sillobite.owner.helper.BuildConfig
import com.sillobite.owner.helper.CanteenOwnerHelperApplication
import com.sillobite.owner.helper.data.local.TokenStorage
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

/**
 * ViewModel for Settings Screen
 * 
 * Manages:
 * - Server configuration display
 * - Canteen information display
 * - App version information
 */
class SettingsViewModel(context: Context) : ViewModel() {

    companion object {
        private const val TAG = "SettingsViewModel"
    }

    // Use singleton TokenStorage from Application
    private val tokenStorage = CanteenOwnerHelperApplication.getTokenStorage(context.applicationContext as CanteenOwnerHelperApplication)

    // UI State
    private val _uiState = MutableStateFlow(SettingsUiState())
    val uiState: StateFlow<SettingsUiState> = _uiState.asStateFlow()

    /**
     * UI State data class
     */
    data class SettingsUiState(
        val serverUrl: String = "",
        val canteenName: String = "",
        val canteenId: String = "",
        val appVersion: String = BuildConfig.VERSION_NAME,
        val alarmRepeatMode: Boolean = false, // false = play once, true = repeat
        val isLoading: Boolean = true,
        val errorMessage: String? = null
    )

    init {
        loadSettings()
        observeSessionChanges()
    }

    /**
     * Load settings data from TokenStorage (one-time)
     */
    private fun loadSettings() {
        viewModelScope.launch {
            try {
                val session = tokenStorage.getSessionSync()
                val alarmRepeatMode = tokenStorage.getAlarmRepeatModeSync()

                if (!session.isValid()) {
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        errorMessage = "Invalid session. Please login again."
                    )
                    return@launch
                }

                _uiState.value = _uiState.value.copy(
                    serverUrl = session.serverUrl,
                    canteenName = session.canteenName,
                    canteenId = session.canteenId,
                    alarmRepeatMode = alarmRepeatMode,
                    isLoading = false
                )

                Log.d(TAG, "Settings loaded successfully")

            } catch (e: Exception) {
                Log.e(TAG, "Error loading settings", e)
                _uiState.value = _uiState.value.copy(
                    isLoading = false,
                    errorMessage = "Failed to load settings: ${e.message}"
                )
            }
        }
    }

    /**
     * Observe session changes for reactive updates
     * 
     * Data Flow: TokenStorage.getSession() → Flow → collect → update state
     * Provides reactive updates if session changes
     */
    private fun observeSessionChanges() {
        viewModelScope.launch {
            tokenStorage.getSession().collect { session ->
                if (session.isValid()) {
                    _uiState.value = _uiState.value.copy(
                        serverUrl = session.serverUrl,
                        canteenName = session.canteenName,
                        canteenId = session.canteenId
                    )
                    Log.d(TAG, "Settings updated reactively")
                }
            }
        }
    }

    /**
     * Clear error message
     */
    fun clearError() {
        _uiState.value = _uiState.value.copy(errorMessage = null)
    }
    
    /**
     * Update alarm repeat mode setting
     * 
     * @param repeatMode true = repeat until dismissed, false = play once
     */
    fun updateAlarmRepeatMode(repeatMode: Boolean) {
        viewModelScope.launch {
            try {
                tokenStorage.updateAlarmRepeatMode(repeatMode)
                _uiState.value = _uiState.value.copy(alarmRepeatMode = repeatMode)
                Log.d(TAG, "Alarm repeat mode updated: ${if (repeatMode) "Repeat" else "Once"}")
            } catch (e: Exception) {
                Log.e(TAG, "Error updating alarm repeat mode", e)
                _uiState.value = _uiState.value.copy(
                    errorMessage = "Failed to update setting: ${e.message}"
                )
            }
        }
    }
}
