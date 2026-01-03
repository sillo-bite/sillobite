package com.sillobite.owner.helper.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalSoftwareKeyboardController
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.sillobite.owner.helper.ui.viewmodel.LoginViewModel

/**
 * Login Screen with Material 3 Design
 * 
 * Features:
 * - Server URL configuration
 * - Email/password authentication
 * - Real-time validation
 * - Loading states
 * - Error handling
 * - Accessibility support
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LoginScreen(
    viewModel: LoginViewModel,
    onLoginSuccess: () -> Unit
) {
    val uiState by viewModel.uiState.collectAsState()
    val keyboardController = LocalSoftwareKeyboardController.current
    
    // Handle login success navigation
    LaunchedEffect(uiState.isLoginSuccess) {
        if (uiState.isLoginSuccess) {
            onLoginSuccess()
            viewModel.resetLoginSuccess()
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Canteen Owner Helper") },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.primaryContainer,
                    titleContentColor = MaterialTheme.colorScheme.onPrimaryContainer
                )
            )
        }
    ) { paddingValues ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
            // App Branding
            AppBranding()

            Spacer(modifier = Modifier.height(32.dp))

            // Server URL Field
            ServerUrlField(
                value = uiState.serverUrl,
                onValueChange = viewModel::onServerUrlChange,
                enabled = !uiState.isLoading
            )

            Spacer(modifier = Modifier.height(16.dp))

            // Email Field
            EmailField(
                value = uiState.email,
                onValueChange = viewModel::onEmailChange,
                enabled = !uiState.isLoading,
                error = uiState.emailError
            )

            Spacer(modifier = Modifier.height(16.dp))

            // Password Field
            PasswordField(
                value = uiState.password,
                onValueChange = viewModel::onPasswordChange,
                enabled = !uiState.isLoading,
                error = uiState.passwordError,
                onDone = {
                    keyboardController?.hide()
                    viewModel.login()
                }
            )

            Spacer(modifier = Modifier.height(24.dp))

            // Login Button
            LoginButton(
                onClick = {
                    keyboardController?.hide()
                    viewModel.login()
                },
                enabled = !uiState.isLoading,
                isLoading = uiState.isLoading
            )

            Spacer(modifier = Modifier.height(16.dp))

            // Error Message
            uiState.errorMessage?.let { errorMsg ->
                ErrorCard(
                    message = errorMsg,
                    onDismiss = viewModel::clearError
                )
            }

            Spacer(modifier = Modifier.height(32.dp))
        }
    }
}

/**
 * App branding section with icon and title
 */
@Composable
private fun AppBranding() {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        modifier = Modifier.padding(vertical = 16.dp)
    ) {
        // App Icon (placeholder)
        Icon(
            imageVector = Icons.Default.Restaurant,
            contentDescription = "App Icon",
            modifier = Modifier.size(80.dp),
            tint = MaterialTheme.colorScheme.primary
        )

        Spacer(modifier = Modifier.height(16.dp))

        // App Title
        Text(
            text = "Canteen Owner Helper",
            style = MaterialTheme.typography.headlineMedium,
            color = MaterialTheme.colorScheme.primary,
            textAlign = TextAlign.Center
        )

        Spacer(modifier = Modifier.height(8.dp))

        Text(
            text = "Stay connected with your orders",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center
        )
    }
}

/**
 * Server URL text field
 */
@Composable
private fun ServerUrlField(
    value: String,
    onValueChange: (String) -> Unit,
    enabled: Boolean
) {
    OutlinedTextField(
        value = value,
        onValueChange = onValueChange,
        label = { Text("Server URL") },
        placeholder = { Text("https://your-app.railway.app") },
        leadingIcon = {
            Icon(
                imageVector = Icons.Default.Cloud,
                contentDescription = "Server"
            )
        },
        keyboardOptions = KeyboardOptions(
            keyboardType = KeyboardType.Uri,
            imeAction = ImeAction.Next
        ),
        singleLine = true,
        enabled = enabled,
        modifier = Modifier.fillMaxWidth(),
        colors = OutlinedTextFieldDefaults.colors()
    )
}

/**
 * Email text field with validation
 */
@Composable
private fun EmailField(
    value: String,
    onValueChange: (String) -> Unit,
    enabled: Boolean,
    error: String?
) {
    OutlinedTextField(
        value = value,
        onValueChange = onValueChange,
        label = { Text("Email") },
        placeholder = { Text("owner@example.com") },
        leadingIcon = {
            Icon(
                imageVector = Icons.Default.Email,
                contentDescription = "Email"
            )
        },
        keyboardOptions = KeyboardOptions(
            keyboardType = KeyboardType.Email,
            imeAction = ImeAction.Next
        ),
        singleLine = true,
        enabled = enabled,
        isError = error != null,
        supportingText = if (error != null) {
            { Text(error) }
        } else null,
        modifier = Modifier.fillMaxWidth(),
        colors = OutlinedTextFieldDefaults.colors()
    )
}

/**
 * Password text field with visibility toggle
 */
@Composable
private fun PasswordField(
    value: String,
    onValueChange: (String) -> Unit,
    enabled: Boolean,
    error: String?,
    onDone: () -> Unit
) {
    var passwordVisible by remember { mutableStateOf(false) }

    OutlinedTextField(
        value = value,
        onValueChange = onValueChange,
        label = { Text("Password") },
        placeholder = { Text("Enter your password") },
        leadingIcon = {
            Icon(
                imageVector = Icons.Default.Lock,
                contentDescription = "Password"
            )
        },
        trailingIcon = {
            IconButton(onClick = { passwordVisible = !passwordVisible }) {
                Icon(
                    imageVector = if (passwordVisible) Icons.Default.Visibility else Icons.Default.VisibilityOff,
                    contentDescription = if (passwordVisible) "Hide password" else "Show password"
                )
            }
        },
        visualTransformation = if (passwordVisible) VisualTransformation.None else PasswordVisualTransformation(),
        keyboardOptions = KeyboardOptions(
            keyboardType = KeyboardType.Password,
            imeAction = ImeAction.Done
        ),
        keyboardActions = KeyboardActions(
            onDone = { onDone() }
        ),
        singleLine = true,
        enabled = enabled,
        isError = error != null,
        supportingText = if (error != null) {
            { Text(error) }
        } else null,
        modifier = Modifier.fillMaxWidth(),
        colors = OutlinedTextFieldDefaults.colors()
    )
}

/**
 * Login button with loading state
 */
@Composable
private fun LoginButton(
    onClick: () -> Unit,
    enabled: Boolean,
    isLoading: Boolean
) {
    Button(
        onClick = onClick,
        enabled = enabled,
        modifier = Modifier
            .fillMaxWidth()
            .height(56.dp),
        contentPadding = PaddingValues(16.dp)
    ) {
        if (isLoading) {
            CircularProgressIndicator(
                modifier = Modifier.size(24.dp),
                color = MaterialTheme.colorScheme.onPrimary,
                strokeWidth = 2.dp
            )
            Spacer(modifier = Modifier.width(8.dp))
            Text("Logging in...")
        } else {
            Icon(
                imageVector = Icons.Default.Login,
                contentDescription = null,
                modifier = Modifier.size(20.dp)
            )
            Spacer(modifier = Modifier.width(8.dp))
            Text("Login")
        }
    }
}

/**
 * Error message card
 */
@Composable
private fun ErrorCard(
    message: String,
    onDismiss: () -> Unit
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.errorContainer
        )
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Icon(
                imageVector = Icons.Default.Error,
                contentDescription = "Error",
                tint = MaterialTheme.colorScheme.error,
                modifier = Modifier.size(24.dp)
            )

            Spacer(modifier = Modifier.width(12.dp))

            Text(
                text = message,
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onErrorContainer,
                modifier = Modifier.weight(1f)
            )

            IconButton(onClick = onDismiss) {
                Icon(
                    imageVector = Icons.Default.Close,
                    contentDescription = "Dismiss",
                    tint = MaterialTheme.colorScheme.onErrorContainer
                )
            }
        }
    }
}
