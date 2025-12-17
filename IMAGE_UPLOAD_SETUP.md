# Image Upload Setup for Menu Management

This document explains how to set up image upload functionality for menu items in the canteen owner dashboard.

## Features Implemented

1. **Image Upload**: Upload images for menu items (optional)
2. **Image Compression**: Automatic compression to 20KB before upload to Cloudinary
3. **File Size Validation**: Client-side validation for 100KB limit
4. **Image Display**: Show images in menu item cards
5. **Image Management**: Upload, change, and remove images
6. **Fallback Handling**: Graceful handling of upload failures

## Setup Instructions

### 1. Cloudinary Configuration

Add the following environment variables to your `.env` file:

```env
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

### 2. Get Cloudinary Credentials

1. Sign up for a free Cloudinary account at https://cloudinary.com
2. Go to your dashboard and copy:
   - Cloud Name
   - API Key
   - API Secret

### 3. Database Schema Updates

The following fields have been added to the MenuItem model:
- `imageUrl`: Cloudinary image URL
- `imagePublicId`: Cloudinary public ID for deletion

### 4. API Endpoints

New endpoints have been added:
- `POST /api/menu/:id/image` - Upload image for menu item
- `DELETE /api/menu/:id/image` - Remove image from menu item

## Usage

### For Canteen Owners

1. **Adding Images to New Menu Items**:
   - When creating a new menu item, use the "Menu Image (Optional)" section
   - Click to select an image (max 100KB)
   - Image will be automatically compressed to 20KB

2. **Editing Existing Menu Items**:
   - Open the edit dialog for any menu item
   - Use the image upload section to add/change/remove images
   - Images are optional - menu items work fine without them

3. **Viewing Images**:
   - Images are displayed in the menu item cards
   - Click on an image to view it in full size

### Technical Details

#### Image Compression
- Images are compressed using Sharp library
- Target size: 20KB maximum
- Quality is automatically adjusted to meet size requirements
- Images are resized if necessary while maintaining aspect ratio

#### File Validation
- Client-side: 100KB maximum file size
- Server-side: Additional validation and compression
- Supported formats: JPG, PNG, GIF, WebP

#### Error Handling
- Graceful fallback if Cloudinary is unavailable
- User-friendly error messages
- Retry mechanisms for failed uploads

## Fallback Options

1. **No Image**: Menu items work perfectly without images
2. **Upload Failure**: Clear error messages with retry options
3. **Cloudinary Issues**: Graceful degradation with local storage fallback
4. **Network Issues**: Retry mechanisms and offline handling

## Security Considerations

- File type validation (images only)
- File size limits (100KB client, 20KB server)
- Secure Cloudinary configuration
- No direct file storage on server

## Performance

- Images are optimized for web delivery
- Lazy loading for better performance
- CDN delivery through Cloudinary
- Automatic format optimization (WebP when supported)

## Troubleshooting

### Common Issues

1. **"Failed to upload image"**:
   - Check Cloudinary credentials
   - Verify network connection
   - Try a smaller image file

2. **"File size exceeds limit"**:
   - Compress your image before uploading
   - Use image editing software to reduce file size

3. **Images not displaying**:
   - Check Cloudinary configuration
   - Verify image URLs are accessible
   - Check browser console for errors

### Support

For technical support or issues:
1. Check the browser console for error messages
2. Verify Cloudinary configuration
3. Test with different image files
4. Check network connectivity
