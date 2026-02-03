# Photo Edge Stretch Correction - Implementation Plan

## Project Overview
A static web application that corrects horizontal stretching artifacts near photo edges, commonly seen in smartphone camera photos. The tool provides real-time preview with adjustable parameters using WebGL for performance.

## Problem Analysis

### Distortion Characteristics
- **Center region**: No distortion, should remain unchanged
- **Edge regions**: Horizontal stretching increases toward edges
- **Vertical axis**: May also have minor stretching
- **Distortion pattern**: Radial-based but non-uniform (stronger horizontally)

### Correction Approach
We need to apply inverse transformation:
- Stretched pixels near edges → compressed back to natural proportions
- Center pixels → unchanged
- Smooth transition between center and edge regions

## Mathematical Model

### Distortion Function
We'll use a parametric model where correction strength varies based on distance from center:

```
correctionFactor(x, y, distance) = 1 + strength * f(distance)
```

Where:
- `distance` = normalized distance from center (0 at center, 1 at edge)
- `strength` = user-adjustable parameter (0 to 1)
- `f(distance)` = smoothing curve function

### Curve Functions (to test and select best)
1. **Quadratic**: `f(d) = d²` - smooth, natural falloff
2. **Cubic**: `f(d) = d³` - gentler near center, aggressive at edges
3. **Exponential**: `f(d) = (e^(k*d) - 1) / (e^k - 1)` - configurable steepness
4. **Smoothstep**: `f(d) = 3d² - 2d³` - S-curve, very smooth transition

**Recommended**: Start with quadratic (d²) for its natural feel and computational efficiency.

### Coordinate Transformation
For each output pixel (x_out, y_out):
1. Convert to normalized coordinates [-1, 1]
2. Calculate distance from center
3. Apply correction: `x_in = x_out / correctionFactor(x, distance)`
4. Sample input image at (x_in, y_in)

## Technical Implementation

### Technology Stack
- **WebGL 2.0**: Better browser support than WebGPU, sufficient for our needs
- **Pure HTML/CSS/JavaScript**: No frameworks, minimal dependencies
- **File API**: For image upload
- **Canvas API**: For image download

### WebGL Architecture

#### Vertex Shader
- Simple quad rendering
- Pass texture coordinates to fragment shader

#### Fragment Shader (Core Logic)
```glsl
uniform float strengthX;    // Horizontal correction strength
uniform float strengthY;    // Vertical correction strength
uniform float falloffPower; // Curve steepness (1=linear, 2=quadratic, 3=cubic)
uniform vec2 center;        // Distortion center (default: 0.5, 0.5)

void main() {
    vec2 uv = v_texCoord;
    vec2 delta = uv - center;
    float distance = length(delta);
    
    // Apply parametric correction
    float factor = 1.0 + falloffPower * pow(distance, falloffPower);
    vec2 correctedUV = center + delta / vec2(
        1.0 + strengthX * factor,
        1.0 + strengthY * factor
    );
    
    gl_FragColor = texture2D(u_image, correctedUV);
}
```

### UI Components

#### File Input
- Accept image files (JPEG, PNG, WebP)
- Preview uploaded image
- Display image dimensions

#### Canvas
- Main display area
- Real-time rendering of corrected image
- Responsive sizing (maintain aspect ratio)

#### Parameter Controls
1. **Horizontal Strength** (0-1, step: 0.01, default: 0.3)
   - Primary correction for horizontal stretching
2. **Vertical Strength** (0-1, step: 0.01, default: 0.1)
   - Minor vertical correction
3. **Falloff Power** (1-3, step: 0.1, default: 2.0)
   - Curve steepness (1=linear, 2=quadratic, 3=cubic)
4. **Center X** (0-1, step: 0.01, default: 0.5)
   - Horizontal center of distortion
5. **Center Y** (0-1, step: 0.01, default: 0.5)
   - Vertical center of distortion

#### Actions
- **Reset**: Restore default parameters
- **Download**: Export corrected image as PNG

## File Structure

```
photo-edge-stretch-correction/
├── index.html          # Main HTML structure
├── style.css           # Styling
├── app.js              # Main application logic
├── webgl-renderer.js   # WebGL setup and rendering
└── IMPLEMENTATION_PLAN.md
```

## Implementation Steps

### Phase 1: Basic Structure
1. Create HTML layout with all UI elements
2. Basic CSS styling for clean interface
3. File input handling and image loading

### Phase 2: WebGL Setup
1. Initialize WebGL context
2. Create vertex and fragment shaders
3. Setup buffers and textures
4. Implement basic image rendering

### Phase 3: Distortion Correction
1. Implement correction algorithm in fragment shader
2. Connect UI sliders to shader uniforms
3. Real-time parameter updates

### Phase 4: Export Functionality
1. Render to offscreen canvas at full resolution
2. Convert to PNG blob
3. Trigger download

### Phase 5: Polish
1. Responsive design
2. Loading states
3. Error handling
4. Value displays on sliders

## Performance Considerations

- **GPU Processing**: All pixel operations in WebGL shader
- **Real-time Updates**: Debounce slider updates if needed (likely not necessary with WebGL)
- **Memory**: Handle large images efficiently (consider max resolution warnings)
- **Browser Compatibility**: WebGL 2.0 fallback to WebGL 1.0 if needed

## Testing Strategy

1. Test with various image sizes (small to 4K+)
2. Test with different aspect ratios (portrait, landscape, square)
3. Test edge cases (no distortion, extreme distortion)
4. Cross-browser testing (Chrome, Firefox, Safari, Edge)
5. Mobile device testing

## Future Enhancements (Out of Scope)

- Batch processing multiple images
- Save/load presets
- Before/after comparison slider
- Automatic distortion detection
- Support for RAW formats
- Advanced distortion models (barrel, pincushion, mustache)

## Conclusion

This implementation provides a performant, user-friendly tool for correcting edge stretching in photos. WebGL ensures real-time preview even for large images, and the parametric approach gives users fine control over the correction.
