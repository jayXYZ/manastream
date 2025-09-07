# PWA Setup for DxC Overlay Life Tracker

This document explains the Progressive Web App (PWA) implementation for the DxC Overlay Life Tracker, designed to provide a fullscreen experience on mobile devices during Magic: The Gathering tournaments.

## Features Implemented

### 1. Fullscreen Display Mode

- **Android**: Uses `display: "fullscreen"` in manifest.json to hide browser UI
- **iOS**: Uses `apple-mobile-web-app-capable` meta tag for fullscreen mode
- **Viewport**: Configured with `viewport-fit: "cover"` for edge-to-edge display

### 2. PWA Installation

- Automatic installation prompt appears on supported browsers
- Custom installation component with clear benefits explanation
- Service worker registration for offline functionality

### 3. Authentication Compatibility

- **No interference** with Convex Auth or existing authentication flow
- PWA operates within standard web security model
- Session management works identically to web version

## Files Added/Modified

### New Files

- `public/manifest.json` - PWA manifest configuration
- `public/sw.js` - Service worker for offline functionality
- `components/pwa-installer.tsx` - Installation prompt component
- `scripts/generate-icons.js` - Icon generation script
- `public/icons/` - PWA icons directory

### Modified Files

- `app/layout.tsx` - Added PWA meta tags and manifest link
- `app/lifetracker/page.tsx` - Added PWA installer component
- `next.config.ts` - Added PWA-specific headers

## Installation Instructions for Users

### Android Devices

1. Open the lifetracker page in Chrome
2. Look for the "Install Life Tracker" prompt at the bottom
3. Tap "Install" to add to home screen
4. The app will open in fullscreen mode

### iOS Devices

1. Open the lifetracker page in Safari
2. Tap the Share button
3. Select "Add to Home Screen"
4. The app will open in fullscreen mode

## Technical Details

### Manifest Configuration

```json
{
  "display": "fullscreen",
  "orientation": "portrait",
  "start_url": "/lifetracker",
  "scope": "/lifetracker"
}
```

### Service Worker Features

- Caches essential resources for offline use
- Handles network requests with cache-first strategy
- Automatically updates when new versions are deployed

### Security Considerations

- PWA operates within browser security model
- No additional permissions required
- HTTPS required for PWA functionality (handled by hosting)

## Testing

### Desktop Testing

1. Open Chrome DevTools
2. Go to Application tab
3. Check Manifest and Service Workers sections
4. Test installation prompt

### Mobile Testing

1. Deploy to HTTPS environment
2. Test on actual Android/iOS devices
3. Verify fullscreen mode works correctly
4. Test installation process

## Benefits for Tournament Use

1. **Prevents Accidental Tab Closure**: Fullscreen mode removes browser UI
2. **App-like Experience**: Installed as native app on device
3. **Offline Functionality**: Basic functionality works without internet
4. **Quick Access**: Direct launch from home screen
5. **No App Store**: No need for app store approval or distribution

## Troubleshooting

### Installation Prompt Not Showing

- Ensure site is served over HTTPS
- Check browser compatibility (Chrome, Edge, Safari)
- Verify manifest.json is accessible

### Fullscreen Not Working

- Check device orientation settings
- Verify meta tags are properly set
- Test on different devices/browsers

### Authentication Issues

- PWA uses same authentication as web version
- Check Convex Auth configuration
- Verify service worker doesn't interfere with auth requests

## Future Enhancements

1. **Better Icons**: Replace placeholder icons with professional designs
2. **Push Notifications**: Add tournament updates/notifications
3. **Offline Sync**: Enhanced offline functionality with data sync
4. **Custom Splash Screen**: Branded loading screen for PWA
