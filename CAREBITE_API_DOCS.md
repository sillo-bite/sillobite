# CareBite Menu API Documentation

## Overview
API endpoint for CareBite to fetch menu items based on user's location.

## Endpoint

### POST /api/carebite/menu

Fetches canteens and menu items available for the user's selected location.

## Request

### Headers
```
Content-Type: application/json
```

### Body
```json
{
  "email": "user@example.com",
  "accessToken": "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2"
}
```

### Parameters
- `email` (string, required): User's email address
- `accessToken` (string, required): Access token obtained from connection code verification

## Response

### Success (200 OK)
```json
{
  "user": {
    "id": 123,
    "email": "user@example.com",
    "name": "John Doe",
    "locationType": "college",
    "locationId": "college-123"
  },
  "canteens": [
    {
      "id": "canteen-1234567890",
      "name": "Main Canteen",
      "description": "Best food on campus",
      "imageUrl": "https://cloudinary.com/...",
      "logoUrl": "https://cloudinary.com/...",
      "location": "Building A, Ground Floor",
      "contactNumber": "+91 9876543210",
      "isActive": true
    }
  ],
  "menuItems": [
    {
      "id": "507f1f77bcf86cd799439011",
      "name": "Masala Dosa",
      "price": 50,
      "imageUrl": "https://cloudinary.com/...",
      "description": "Crispy dosa with potato filling",
      "isVegetarian": true,
      "stock": 25,
      "available": true,
      "canteenId": "canteen-1234567890",
      "canteenName": "Main Canteen",
      "categoryName": "South Indian",
      "cookingTime": 15,
      "calories": 350
    }
  ]
}
```

### Error Responses

#### 400 Bad Request
```json
{
  "error": "Email and accessToken are required"
}
```

#### 401 Unauthorized
```json
{
  "error": "User not found"
}
```
or
```json
{
  "error": "Invalid access token"
}
```
or
```json
{
  "error": "User has not selected a location"
}
```

#### 500 Internal Server Error
```json
{
  "error": "Failed to fetch menu"
}
```

## Flow

1. **Token Validation**
   - Find user by email
   - Fetch token from `api_tokens` table
   - Compare provided token with stored token
   - If mismatch → 401 error

2. **Location Check**
   - Get user's `selectedLocationType` and `selectedLocationId`
   - If not set → 401 error

3. **Fetch Canteens**
   - Query `CanteenEntity` collection based on location type:
     - `college`: Match `collegeIds` array
     - `organization`: Match `organizationIds` array
     - `restaurant`: Match `restaurantId`
   - Filter by `isActive: true`

4. **Fetch Menu Items**
   - Get all menu items from matched canteens
   - Filter by:
     - `available: true`
     - `stock > 0`
   - Populate category information
   - Include canteen name for each item

5. **Format Response**
   - Return user info, canteens list, and menu items array

## Example Usage

### Step 1: Get Connection Code (SilloBite)
```javascript
const codeResponse = await fetch('http://localhost:5000/api/auth/generate-code', {
  method: 'POST',
  credentials: 'include'
});
const { code } = await codeResponse.json();
// code: "ABC123"
```

### Step 2: Verify Code (CareBite)
```javascript
const verifyResponse = await fetch('http://localhost:5000/api/auth/verify-code', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'user@example.com',
    code: 'ABC123'
  })
});
const { access_token } = await verifyResponse.json();
```

### Step 3: Fetch Menu (CareBite)
```javascript
const menuResponse = await fetch('http://localhost:5000/api/carebite/menu', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'user@example.com',
    accessToken: access_token
  })
});
const menuData = await menuResponse.json();

console.log('User:', menuData.user);
console.log('Canteens:', menuData.canteens.length);
console.log('Menu Items:', menuData.menuItems.length);
```

## Data Models

### User
- `id`: User ID (integer)
- `email`: User email
- `name`: User name
- `locationType`: "college" | "organization" | "restaurant"
- `locationId`: ID of the selected location

### Canteen
- `id`: Canteen ID (string)
- `name`: Canteen name
- `description`: Canteen description
- `imageUrl`: Canteen image URL
- `logoUrl`: Canteen logo URL
- `location`: Physical location
- `contactNumber`: Contact number
- `isActive`: Whether canteen is active

### MenuItem
- `id`: Menu item ID (MongoDB ObjectId as string)
- `name`: Item name
- `price`: Price in rupees
- `imageUrl`: Item image URL
- `description`: Item description
- `isVegetarian`: Vegetarian flag
- `stock`: Current stock quantity
- `available`: Availability flag
- `canteenId`: Parent canteen ID
- `canteenName`: Parent canteen name
- `categoryName`: Category name
- `cookingTime`: Preparation time in minutes
- `calories`: Calorie content in kcal

## Security

- Token validation ensures only authorized users can access menu
- Each user can only access menu for their selected location
- Tokens are unique per user (one token per user)
- Old tokens are automatically replaced on reconnection

## Performance

- Optimized MongoDB queries with proper indexes
- Lean queries for better performance
- Only fetches available items with stock > 0
- Minimal data transfer with field selection

## Notes

- User must have selected a location in SilloBite before using this API
- Only active canteens are returned
- Only available menu items with stock are returned
- Menu items are populated with category information
- Canteen name is included with each menu item for easy display
