package com.sillobite.owner.helper.data.remote.api

import com.sillobite.owner.helper.data.remote.dto.CanteenResponse
import com.sillobite.owner.helper.data.remote.dto.Counter
import com.sillobite.owner.helper.data.remote.dto.LoginRequest
import com.sillobite.owner.helper.data.remote.dto.LoginResponse
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.Path
import retrofit2.http.Query

/**
 * Retrofit API service interface
 * 
 * All methods are suspend functions for coroutine support
 * Throws exceptions on network/HTTP errors (handled by caller)
 */
interface ApiService {
    
    /**
     * Login endpoint
     * 
     * @param loginRequest Contains identifier (email) and password
     * @return LoginResponse with user data
     * @throws retrofit2.HttpException on HTTP errors (401, 500, etc.)
     * @throws java.io.IOException on network errors
     */
    @POST("/api/auth/login")
    suspend fun login(
        @Body loginRequest: LoginRequest
    ): LoginResponse
    
    /**
     * Get canteen by owner email
     * 
     * @param email Owner's email address
     * @return CanteenResponse with canteen data
     * @throws retrofit2.HttpException on HTTP errors (404 if not found)
     * @throws java.io.IOException on network errors
     */
    @GET("/api/system-settings/canteens/by-owner/{email}")
    suspend fun getCanteenByOwner(
        @Path("email") email: String
    ): CanteenResponse
    
    /**
     * Get counters for a canteen
     * 
     * @param canteenId MongoDB ObjectId of the canteen
     * @param type Optional filter by counter type (payment/store/kot)
     * @return List of Counter objects
     * @throws retrofit2.HttpException on HTTP errors (400 if canteenId missing)
     * @throws java.io.IOException on network errors
     */
    @GET("/api/counters")
    suspend fun getCounters(
        @Query("canteenId") canteenId: String,
        @Query("type") type: String? = null
    ): List<Counter>
}
