/**
 * WebGPU Renderer for Photo Edge Stretch Correction
 * Handles WebGPU setup, shader compilation, and rendering with HDR support
 */

class WebGPURenderer {
    constructor(canvas) {
        /** @type {HTMLCanvasElement} */
        this.canvas = canvas;
        /** @type {GPUDevice} */
        this.device = null;
        /** @type {GPUCanvasContext} */
        this.context = null;
        /** @type {GPURenderPipeline} */
        this.pipeline = null;
        /** @type {GPUTexture} */
        this.texture = null;
        /** @type {GPUSampler} */
        this.sampler = null;
        this.imageLoaded = false;
        
        // Bind groups and buffers
        /** @type {GPUBindGroup} */
        this.bindGroup = null;
        this.uniformBuffer = null;
        this.vertexBuffer = null;
        
        // Parameters
        this.params = {
            strengthX: 0.0,
            strengthY: 0.0,
            falloffPower: 2.0,
            centerX: 0.5,
            centerY: 0.5
        };
        
        this.initWebGPU();
    }
    
    async initWebGPU() {
        // Check WebGPU support
        if (!navigator.gpu) {
            alert('WebGPU is not supported in your browser. Please use Chrome 113+ or Edge 113+.');
            return;
        }
        
        try {
            // Request adapter
            const adapter = await navigator.gpu.requestAdapter();
            if (!adapter) {
                alert('Failed to get WebGPU adapter.');
                return;
            }
            
            // Request device
            this.device = await adapter.requestDevice();
            
            // Setup canvas context with HDR support
            this.context = this.canvas.getContext('webgpu', { preserveDrawingBuffer: true });
            const format = navigator.gpu.getPreferredCanvasFormat();
            
            // Configure with HDR support
            this.context.configure({
                device: this.device,
                format: 'rgba16float', // HDR format
                colorSpace: 'display-p3', // Wide color gamut
                toneMapping: { mode: 'extended' }, // HDR tone mapping
                alphaMode: 'premultiplied',
            });
            
            // Create shaders
            await this.createPipeline();
            
            // Create sampler
            this.sampler = this.device.createSampler({
                magFilter: 'linear',
                minFilter: 'linear',
                addressModeU: 'clamp-to-edge',
                addressModeV: 'clamp-to-edge',
            });
            
            // Create vertex buffer (full screen quad)
            this.createVertexBuffer();
            
            // Create uniform buffer
            this.uniformBuffer = this.device.createBuffer({
                size: 32, // 5 floats * 4 bytes + padding
                usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
            });
            
        } catch (error) {
            console.error('WebGPU initialization failed:', error);
            alert('Failed to initialize WebGPU. Please ensure you have a compatible browser and GPU.');
        }
    }
    
    async createPipeline() {
        // WGSL Shader code
        const shaderCode = `
            struct VertexOutput {
                @builtin(position) position: vec4f,
                @location(0) texCoord: vec2f,
            };
            
            struct Uniforms {
                strengthX: f32,
                strengthY: f32,
                falloffPower: f32,
                centerX: f32,
                centerY: f32,
                aspectRatioX: f32,
                aspectRatioY: f32,
                padding: f32,
            };
            
            @group(0) @binding(0) var<uniform> uniforms: Uniforms;
            @group(0) @binding(1) var textureSampler: sampler;
            @group(0) @binding(2) var inputTexture: texture_2d<f32>;
            
            @vertex
            fn vertexMain(@location(0) position: vec2f, @location(1) texCoord: vec2f) -> VertexOutput {
                var output: VertexOutput;
                output.position = vec4f(position, 0.0, 1.0);
                output.texCoord = texCoord;
                return output;
            }
            
            @fragment
            fn fragmentMain(input: VertexOutput) -> @location(0) vec4f {
                let uv = input.texCoord;
                let center = vec2f(uniforms.centerX, uniforms.centerY);
                let centered = uv - center;
                
                // Apply aspect ratio correction for circular distortion
                let aspectRatio = vec2f(uniforms.aspectRatioX, uniforms.aspectRatioY);
                let normalized = centered * aspectRatio;
                let distance = length(normalized);
                
                // Calculate correction factor based on distance
                let distortionFactor = pow(distance, uniforms.falloffPower);
                
                // Apply separate X and Y corrections
                let correctionFactors = vec2f(
                    1.0 + uniforms.strengthX * distortionFactor,
                    1.0 + uniforms.strengthY * distortionFactor
                );
                
                // Calculate corrected UV coordinates
                let correctedCentered = centered / correctionFactors;
                let correctedUV = correctedCentered + center;
                
                // Clamp UV coordinates to valid range for sampling
                let clampedUV = clamp(correctedUV, vec2f(0.0), vec2f(1.0));
                
                // Sample texture (must be in uniform control flow)
                let sampledColor = textureSample(inputTexture, textureSampler, clampedUV);
                
                // Check if original UV was out of bounds
                let inBounds = correctedUV.x >= 0.0 && correctedUV.x <= 1.0 && 
                               correctedUV.y >= 0.0 && correctedUV.y <= 1.0;
                
                // Return black for out of bounds, sampled color otherwise
                return select(vec4f(0.0, 0.0, 0.0, 1.0), sampledColor, inBounds);
            }
        `;
        
        const shaderModule = this.device.createShaderModule({
            code: shaderCode,
        });
        
        // Create pipeline layout
        const bindGroupLayout = this.device.createBindGroupLayout({
            entries: [
                {
                    binding: 0,
                    visibility: GPUShaderStage.FRAGMENT,
                    buffer: { type: 'uniform' }
                },
                {
                    binding: 1,
                    visibility: GPUShaderStage.FRAGMENT,
                    sampler: { type: 'filtering' }
                },
                {
                    binding: 2,
                    visibility: GPUShaderStage.FRAGMENT,
                    texture: { sampleType: 'float' }
                }
            ]
        });
        
        const pipelineLayout = this.device.createPipelineLayout({
            bindGroupLayouts: [bindGroupLayout]
        });
        
        // Create render pipeline
        this.pipeline = this.device.createRenderPipeline({
            layout: pipelineLayout,
            vertex: {
                module: shaderModule,
                entryPoint: 'vertexMain',
                buffers: [
                    {
                        arrayStride: 16, // 4 floats * 4 bytes
                        attributes: [
                            {
                                shaderLocation: 0,
                                offset: 0,
                                format: 'float32x2'
                            },
                            {
                                shaderLocation: 1,
                                offset: 8,
                                format: 'float32x2'
                            }
                        ]
                    }
                ]
            },
            fragment: {
                module: shaderModule,
                entryPoint: 'fragmentMain',
                targets: [
                    {
                        format: 'rgba16float' // HDR format
                    }
                ]
            },
            primitive: {
                topology: 'triangle-strip',
            }
        });
        
        this.bindGroupLayout = bindGroupLayout;
    }
    
    createVertexBuffer() {
        // Full screen quad with positions and texture coordinates
        const vertices = new Float32Array([
            // position (x, y), texCoord (u, v)
            -1, -1,  0, 1,
             1, -1,  1, 1,
            -1,  1,  0, 0,
             1,  1,  1, 0,
        ]);
        
        this.vertexBuffer = this.device.createBuffer({
            size: vertices.byteLength,
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
        });
        
        this.device.queue.writeBuffer(this.vertexBuffer, 0, vertices);
    }
    /**
     * 
     * @param {HTMLImageElement} image 
     * @returns {Promise<void>}
     */
    async loadImage(image) {
        if (!this.device) {
            console.error('WebGPU device not initialized');
            return;
        }
        
        // Resize canvas to match image aspect ratio
        const maxWidth = Math.min(image.width, 1920);
        const maxHeight = Math.min(image.height, 1080);
        const scale = Math.min(maxWidth / image.width, maxHeight / image.height, 1);

        const displayWidth = image.width * scale;
        const displayHeight = image.height * scale;
        const dpr = window.devicePixelRatio || 1;

        // Set canvas internal resolution (accounting for device pixel ratio)
        this.canvas.width = displayWidth * dpr;
        this.canvas.height = displayHeight * dpr;

        // // Set canvas CSS size
        // this.canvas.style.width = `${displayWidth}px`;
        // this.canvas.style.height = `${displayHeight}px`;

        // Store original image for download
        this.originalImage = image;
        
        // Create texture from image
        const imageBitmap = await createImageBitmap(image);
        
        this.texture = this.device.createTexture({
            size: [imageBitmap.width, imageBitmap.height, 1],
            format: 'rgba16float',
            usage: GPUTextureUsage.TEXTURE_BINDING | 
                   GPUTextureUsage.COPY_DST | 
                   GPUTextureUsage.RENDER_ATTACHMENT
        });
        
        this.device.queue.copyExternalImageToTexture(
            { source: imageBitmap },
            { texture: this.texture },
            [imageBitmap.width, imageBitmap.height]
        );
        
        // Create bind group
        this.bindGroup = this.device.createBindGroup({
            layout: this.bindGroupLayout,
            entries: [
                {
                    binding: 0,
                    resource: { buffer: this.uniformBuffer }
                },
                {
                    binding: 1,
                    resource: this.sampler
                },
                {
                    binding: 2,
                    resource: this.texture.createView()
                }
            ]
        });
        
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
        if (!this.imageLoaded || !this.device) return;
        
        // Update uniform buffer
        const aspectRatio = this.canvas.width / this.canvas.height;
        const aspectRatioX = aspectRatio > 1 ? aspectRatio : 1.0;
        const aspectRatioY = aspectRatio > 1 ? 1.0 : 1.0 / aspectRatio;
        
        const uniformData = new Float32Array([
            this.params.strengthX,
            this.params.strengthY,
            this.params.falloffPower,
            this.params.centerX,
            this.params.centerY,
            aspectRatioX,
            aspectRatioY,
            0, // padding
        ]);
        
        this.device.queue.writeBuffer(this.uniformBuffer, 0, uniformData);
        
        // Create command encoder
        const commandEncoder = this.device.createCommandEncoder();
        
        // Get current texture
        const textureView = this.context.getCurrentTexture().createView();
        
        // Create render pass
        const renderPass = commandEncoder.beginRenderPass({
            colorAttachments: [
                {
                    view: textureView,
                    clearValue: { r: 0.1, g: 0.1, b: 0.1, a: 1.0 },
                    loadOp: 'clear',
                    storeOp: 'store'
                }
            ]
        });
        
        renderPass.setPipeline(this.pipeline);
        renderPass.setBindGroup(0, this.bindGroup);
        renderPass.setVertexBuffer(0, this.vertexBuffer);
        renderPass.draw(4, 1, 0, 0);
        renderPass.end();
        
        // Submit commands
        this.device.queue.submit([commandEncoder.finish()]);
    }
    
    getImageData() {
        if (!this.imageLoaded) return null;
        
        // For download, we still return the canvas data
        // The canvas will be in HDR format if supported
        return {
            width: this.canvas.width,
            height: this.canvas.height
        };
    }
}

// Make it globally available with the same interface
window.WebGLRenderer = WebGPURenderer;
