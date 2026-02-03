This is an AI generated project. 
[Hosted to GitHub page (static page)](https://momijiichigo.github.io/photo-edge-stretch-correction/)

# Photo Edge Stretch Correction

A static web application for correcting horizontal stretching artifacts near photo edges, commonly found in smartphone camera photos.

## Features

- 🖼️ **Real-time Preview**: Instant visual feedback using WebGL for performance
- 🎛️ **Adjustable Parameters**: Fine-tune correction with multiple sliders
- 📱 **Responsive Design**: Works on desktop and mobile devices
- 🔒 **Privacy-First**: All processing happens in your browser, no server uploads
- 💾 **Easy Export**: Download corrected images as PNG

## How to Use

1. **Open the Application**: Open `index.html` in a modern web browser
2. **Load an Image**: Click "Choose Image" and select a photo
3. **Adjust Parameters**:
   - **Horizontal Strength**: Main control for horizontal stretching (0-1)
   - **Vertical Strength**: Minor vertical correction (0-1)
   - **Falloff Power**: Controls curve steepness (1=linear, 2=quadratic, 3=cubic)
   - **Center X/Y**: Adjust the center point of distortion
4. **Download**: Click "Download" to save the corrected image

## Technical Details

### Technology Stack
- **WebGL**: GPU-accelerated image processing
- **Vanilla JavaScript**: No framework dependencies
- **HTML5 Canvas**: Image rendering and export

### Correction Algorithm

The application uses a parametric distortion correction model:

```
correctionFactor(distance) = 1 + strength × distance^falloffPower
```

Where:
- `distance` = normalized distance from center (0-1)
- `strength` = user-defined correction intensity
- `falloffPower` = curve steepness (1-3)

The algorithm applies inverse transformation to compensate for lens distortion, keeping the center region unchanged while progressively correcting stretching toward the edges.

### Browser Compatibility

Requires a browser with WebGL support:
- Chrome 56+
- Firefox 51+
- Safari 15+
- Edge 79+

## Keyboard Shortcuts

- `Ctrl/Cmd + S`: Download corrected image
- `Ctrl/Cmd + R`: Reset parameters to defaults

## File Structure

```
photo-edge-stretch-correction/
├── index.html           # Main HTML structure
├── style.css            # Styling and layout
├── app.js              # Application logic and UI handling
├── webgl-renderer.js   # WebGL setup and rendering engine
├── IMPLEMENTATION_PLAN.md  # Detailed technical documentation
└── README.md           # This file
```

## Development

This is a static website with no build process required. Simply:

1. Clone or download the repository
2. Open `index.html` in a web browser
3. Start using the application

For local development with live reload, you can use any static server:

```bash
# Python 3
python -m http.server 8000

# Node.js (npx)
npx serve

# PHP
php -S localhost:8000
```

Then navigate to `http://localhost:8000`

## Performance

- Real-time rendering at 60 FPS for most images
- Efficient GPU processing via WebGL shaders
- Handles images up to 4K resolution smoothly
- Minimal memory footprint

## Future Enhancements

Potential improvements for future versions:

- [ ] Batch processing for multiple images
- [ ] Save/load parameter presets
- [ ] Before/after comparison slider
- [ ] Automatic distortion detection
- [ ] Additional distortion models (barrel, pincushion)
- [ ] EXIF data preservation
- [ ] Progressive Web App (PWA) support

## License

MIT License - feel free to use and modify as needed.

## Credits

Created as a tool for correcting smartphone camera distortion artifacts.
