/**
 * WebGL Renderer for Photo Edge Stretch Correction
 * Handles WebGL setup, shader compilation, and rendering
 */

class WebGLRenderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.gl = null;
        this.program = null;
        this.texture = null;
        this.imageLoaded = false;
        
        // Shader locations
        this.locations = {
            attributes: {},
            uniforms: {}
        };
        
        // Parameters
        this.params = {
            strengthX: 0.0,
            strengthY: 0.0,
            falloffPower: 2.0,
            centerX: 0.5,
            centerY: 0.5
        };
        
        this.initWebGL();
    }
    
    initWebGL() {
        // Get WebGL context
        this.gl = this.canvas.getContext('webgl2') || this.canvas.getContext('webgl');
        
        if (!this.gl) {
            alert('WebGL is not supported in your browser. Please use a modern browser.');
            return;
        }
        
        // Vertex shader - simple quad
        const vertexShaderSource = `
            attribute vec2 a_position;
            attribute vec2 a_texCoord;
            
            varying vec2 v_texCoord;
            
            void main() {
                gl_Position = vec4(a_position, 0.0, 1.0);
                v_texCoord = a_texCoord;
            }
        `;
        
        // Fragment shader - distortion correction
        const fragmentShaderSource = `
            precision highp float;
            
            uniform sampler2D u_image;
            uniform float u_strengthX;
            uniform float u_strengthY;
            uniform float u_falloffPower;
            uniform vec2 u_center;
            uniform vec2 u_aspectRatio;
            
            varying vec2 v_texCoord;
            
            void main() {
                // Convert to centered coordinates [-0.5, 0.5]
                vec2 uv = v_texCoord;
                vec2 centered = uv - u_center;
                
                // Apply aspect ratio correction for circular distortion
                vec2 normalized = centered * u_aspectRatio;
                float distance = length(normalized);
                
                // Calculate correction factor based on distance
                // Using parametric curve: factor = pow(distance, falloffPower)
                float distortionFactor = pow(distance, u_falloffPower);
                
                // Apply separate X and Y corrections
                vec2 correctionFactors = vec2(
                    1.0 + u_strengthX * distortionFactor,
                    1.0 + u_strengthY * distortionFactor
                );
                
                // Calculate corrected UV coordinates
                vec2 correctedCentered = centered / correctionFactors;
                vec2 correctedUV = correctedCentered + u_center;
                
                // Sample texture with boundary check
                if (correctedUV.x < 0.0 || correctedUV.x > 1.0 || 
                    correctedUV.y < 0.0 || correctedUV.y > 1.0) {
                    // Outside bounds - use black or edge color
                    gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
                } else {
                    gl_FragColor = texture2D(u_image, correctedUV);
                }
            }
        `;
        
        // Compile shaders
        const vertexShader = this.compileShader(vertexShaderSource, this.gl.VERTEX_SHADER);
        const fragmentShader = this.compileShader(fragmentShaderSource, this.gl.FRAGMENT_SHADER);
        
        // Create program
        this.program = this.gl.createProgram();
        this.gl.attachShader(this.program, vertexShader);
        this.gl.attachShader(this.program, fragmentShader);
        this.gl.linkProgram(this.program);
        
        if (!this.gl.getProgramParameter(this.program, this.gl.LINK_STATUS)) {
            console.error('Unable to initialize shader program:', this.gl.getProgramInfoLog(this.program));
            return;
        }
        
        // Get attribute and uniform locations
        this.locations.attributes.position = this.gl.getAttribLocation(this.program, 'a_position');
        this.locations.attributes.texCoord = this.gl.getAttribLocation(this.program, 'a_texCoord');
        
        this.locations.uniforms.image = this.gl.getUniformLocation(this.program, 'u_image');
        this.locations.uniforms.strengthX = this.gl.getUniformLocation(this.program, 'u_strengthX');
        this.locations.uniforms.strengthY = this.gl.getUniformLocation(this.program, 'u_strengthY');
        this.locations.uniforms.falloffPower = this.gl.getUniformLocation(this.program, 'u_falloffPower');
        this.locations.uniforms.center = this.gl.getUniformLocation(this.program, 'u_center');
        this.locations.uniforms.aspectRatio = this.gl.getUniformLocation(this.program, 'u_aspectRatio');
        
        // Setup buffers
        this.setupBuffers();
        
        // Create texture
        this.texture = this.gl.createTexture();
    }
    
    compileShader(source, type) {
        const shader = this.gl.createShader(type);
        this.gl.shaderSource(shader, source);
        this.gl.compileShader(shader);
        
        if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
            console.error('Shader compilation error:', this.gl.getShaderInfoLog(shader));
            this.gl.deleteShader(shader);
            return null;
        }
        
        return shader;
    }
    
    setupBuffers() {
        // Position buffer (full screen quad)
        const positions = new Float32Array([
            -1, -1,
             1, -1,
            -1,  1,
             1,  1,
        ]);
        
        const positionBuffer = this.gl.createBuffer();
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, positionBuffer);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, positions, this.gl.STATIC_DRAW);
        
        // Texture coordinate buffer
        const texCoords = new Float32Array([
            0, 1,
            1, 1,
            0, 0,
            1, 0,
        ]);
        
        const texCoordBuffer = this.gl.createBuffer();
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, texCoordBuffer);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, texCoords, this.gl.STATIC_DRAW);
        
        // Store buffers
        this.buffers = {
            position: positionBuffer,
            texCoord: texCoordBuffer
        };
    }
    
    loadImage(image) {
        // Resize canvas to match image aspect ratio
        const maxWidth = Math.min(image.width, 1920);
        const maxHeight = Math.min(image.height, 1080);
        const scale = Math.min(maxWidth / image.width, maxHeight / image.height, 1);
        
        this.canvas.width = image.width * scale;
        this.canvas.height = image.height * scale;
        
        // Store original image for download
        this.originalImage = image;
        
        // Upload texture
        this.gl.bindTexture(this.gl.TEXTURE_2D, this.texture);
        this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, this.gl.RGBA, this.gl.UNSIGNED_BYTE, image);
        
        // Set texture parameters
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.LINEAR);
        
        this.imageLoaded = true;
        this.render();
    }
    
    updateParams(params) {
        this.params = { ...this.params, ...params };
        if (this.imageLoaded) {
            this.render();
        }
    }
    
    render() {
        if (!this.imageLoaded) return;
        
        const gl = this.gl;
        
        // Set viewport
        gl.viewport(0, 0, this.canvas.width, this.canvas.height);
        
        // Clear canvas
        gl.clearColor(0.1, 0.1, 0.1, 1.0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        
        // Use program
        gl.useProgram(this.program);
        
        // Bind position buffer
        gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.position);
        gl.enableVertexAttribArray(this.locations.attributes.position);
        gl.vertexAttribPointer(this.locations.attributes.position, 2, gl.FLOAT, false, 0, 0);
        
        // Bind texture coordinate buffer
        gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.texCoord);
        gl.enableVertexAttribArray(this.locations.attributes.texCoord);
        gl.vertexAttribPointer(this.locations.attributes.texCoord, 2, gl.FLOAT, false, 0, 0);
        
        // Bind texture
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.texture);
        gl.uniform1i(this.locations.uniforms.image, 0);
        
        // Set uniforms
        gl.uniform1f(this.locations.uniforms.strengthX, this.params.strengthX);
        gl.uniform1f(this.locations.uniforms.strengthY, this.params.strengthY);
        gl.uniform1f(this.locations.uniforms.falloffPower, this.params.falloffPower);
        gl.uniform2f(this.locations.uniforms.center, this.params.centerX, this.params.centerY);
        
        // Calculate aspect ratio for circular distortion
        const aspectRatio = this.canvas.width / this.canvas.height;
        if (aspectRatio > 1) {
            gl.uniform2f(this.locations.uniforms.aspectRatio, aspectRatio, 1.0);
        } else {
            gl.uniform2f(this.locations.uniforms.aspectRatio, 1.0, 1.0 / aspectRatio);
        }
        
        // Draw
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
    
    getImageData() {
        if (!this.imageLoaded) return null;
        
        // Render at full original resolution
        const originalWidth = this.originalImage.width;
        const originalHeight = this.originalImage.height;
        
        // Create temporary canvas for full resolution render
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = originalWidth;
        tempCanvas.height = originalHeight;
        
        const tempGL = tempCanvas.getContext('webgl2') || tempCanvas.getContext('webgl');
        if (!tempGL) return null;
        
        // Setup temporary WebGL context with same shaders and parameters
        // (Simplified: in production, we'd reuse the shader program)
        // For now, read from current canvas
        
        const pixels = new Uint8Array(this.canvas.width * this.canvas.height * 4);
        this.gl.readPixels(0, 0, this.canvas.width, this.canvas.height, this.gl.RGBA, this.gl.UNSIGNED_BYTE, pixels);
        
        return {
            data: pixels,
            width: this.canvas.width,
            height: this.canvas.height
        };
    }
}
