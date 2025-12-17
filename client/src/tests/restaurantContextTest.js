// Manual test script for restaurant context prioritization
// Run these tests in the browser console to verify the fix

// Test Case 1: Authenticated user with restaurant context
function testAuthenticatedUserWithRestaurantContext() {
  console.log('🧪 TEST 1: Authenticated user with restaurant context');
  
  // Setup: Create authenticated user with restaurant context
  const userData = {
    id: 'test-user-id',
    name: 'Test User',
    email: 'test@example.com',
    role: 'customer',
    college: 'test-college-id',
    organization: 'test-org-id',
    isAuthenticated: true,
    isTemporary: false,
    // Restaurant context
    restaurantId: 'test-restaurant-id',
    restaurantName: 'Test Restaurant',
    tableNumber: 'A1',
    hasRestaurantContext: true
  };
  
  // Store in localStorage
  localStorage.setItem('user', JSON.stringify(userData));
  
  console.log('✅ Test data set up. Refresh the page and check that:');
  console.log('1. The CanteenContext logs show "PRIORITIZING restaurant context for authenticated user"');
  console.log('2. The restaurant-specific canteens are loaded instead of college/organization canteens');
  console.log('3. The HomeScreen shows restaurant-specific content');
}

// Test Case 2: Authenticated user without restaurant context
function testAuthenticatedUserWithoutRestaurantContext() {
  console.log('🧪 TEST 2: Authenticated user without restaurant context');
  
  // Setup: Create authenticated user without restaurant context
  const userData = {
    id: 'test-user-id',
    name: 'Test User',
    email: 'test@example.com',
    role: 'customer',
    college: 'test-college-id',
    organization: 'test-org-id',
    isAuthenticated: true,
    isTemporary: false
    // No restaurant context
  };
  
  // Store in localStorage
  localStorage.setItem('user', JSON.stringify(userData));
  
  console.log('✅ Test data set up. Refresh the page and check that:');
  console.log('1. The CanteenContext logs show college/organization-specific query');
  console.log('2. The college/organization-specific canteens are loaded');
  console.log('3. The HomeScreen shows college/organization-specific content');
}

// Test Case 3: Temporary user with restaurant context
function testTemporaryUserWithRestaurantContext() {
  console.log('🧪 TEST 3: Temporary user with restaurant context');
  
  // Setup: Create temporary user with restaurant context
  const userData = {
    id: 'temp-user-id',
    name: 'Temp User',
    isAuthenticated: false,
    isTemporary: true,
    restaurantId: 'test-restaurant-id',
    restaurantName: 'Test Restaurant',
    tableNumber: 'A1'
  };
  
  // Store in localStorage
  localStorage.setItem('tempUser', JSON.stringify(userData));
  
  console.log('✅ Test data set up. Refresh the page and check that:');
  console.log('1. The CanteenContext logs show "Using restaurant-specific query for temporary user"');
  console.log('2. The restaurant-specific canteens are loaded');
  console.log('3. The HomeScreen shows restaurant-specific content');
}

// Test Case 4: Simulate QR code scan by authenticated user
function testQRCodeScanByAuthenticatedUser() {
  console.log('🧪 TEST 4: QR code scan by authenticated user');
  
  // Setup: Create authenticated user without restaurant context
  const userData = {
    id: 'test-user-id',
    name: 'Test User',
    email: 'test@example.com',
    role: 'customer',
    college: 'test-college-id',
    organization: 'test-org-id',
    isAuthenticated: true,
    isTemporary: false
    // No restaurant context initially
  };
  
  // Store in localStorage
  localStorage.setItem('user', JSON.stringify(userData));
  
  console.log('✅ Test data set up. Now:');
  console.log('1. Navigate to a table URL (e.g., /table/test-restaurant-id/A1/hash)');
  console.log('2. After redirection to home, check that restaurant context is prioritized');
  console.log('3. Verify the CanteenContext logs show "PRIORITIZING restaurant context for authenticated user"');
}

// Helper to clean up test data
function cleanupTestData() {
  localStorage.removeItem('user');
  localStorage.removeItem('tempUser');
  console.log('🧹 Test data cleaned up. Refresh the page to return to normal state.');
}

// Instructions for running tests
console.log('📋 RESTAURANT CONTEXT PRIORITIZATION TESTS');
console.log('Run these functions one at a time in the browser console:');
console.log('1. testAuthenticatedUserWithRestaurantContext()');
console.log('2. testAuthenticatedUserWithoutRestaurantContext()');
console.log('3. testTemporaryUserWithRestaurantContext()');
console.log('4. testQRCodeScanByAuthenticatedUser()');
console.log('After each test, run cleanupTestData() before running the next test.');