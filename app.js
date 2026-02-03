/**
 * Main Application Logic
 * Handles UI interactions, file upload, and coordination with WebGL renderer
 */

// Global state
let renderer = null;
let currentImage = null;
let currentBackend = 'webgl';
let webglRenderer = null;
let webgpuRenderer = null;

// Default parameter values
const DEFAULT_PARAMS = {
    strengthX: 0.0,
    strengthY: 0.0,
    falloffPower: 2.0,
    centerX: 0.5,
    centerY: 0.5
};

// Initialize application
document.addEventListener('DOMContentLoaded', async () => {
    await initializeRenderer();
    setupEventListeners();
});

async function initializeRenderer(backend = currentBackend) {
    const webglCanvas = document.getElementById('webglCanvas');
    const webgpuCanvas = document.getElementById('webgpuCanvas');
    const backendInfo = document.getElementById('backendInfo');
    
    showLoading(true);
    
    try {
        if (backend === 'webgpu') {
            // Initialize WebGPU if not already done
            if (!webgpuRenderer) {
                if (!navigator.gpu) {
                    throw new Error('WebGPU not supported');
                }
                webgpuRenderer = new WebGPURenderer(webgpuCanvas);
                await webgpuRenderer.initWebGPU();
            }
            
            // Switch to WebGPU
            renderer = webgpuRenderer;
            currentBackend = 'webgpu';
            webglCanvas.classList.add('hidden');
            webgpuCanvas.classList.remove('hidden');
            backendInfo.innerHTML = '<span class="backend-badge webgpu">🚀 WebGPU (HDR)</span>';
        } else {
            // Initialize WebGL if not already done
            if (!webglRenderer) {
                webglRenderer = new WebGLRenderer(webglCanvas);
            }
            
            // Switch to WebGL
            renderer = webglRenderer;
            currentBackend = 'webgl';
            webgpuCanvas.classList.add('hidden');
            webglCanvas.classList.remove('hidden');
            backendInfo.innerHTML = '<span class="backend-badge webgl">⚡ WebGL</span>';
        }
        backendInfo.style.display = 'block';
        
        // Update select value
        document.getElementById('rendererSelect').value = currentBackend;
        
        // Reload current image if exists
        if (currentImage) {
            await renderer.loadImage(currentImage.img);
            // Restore current parameters
            const params = {};
            ['strengthX', 'strengthY', 'falloffPower', 'centerX', 'centerY'].forEach(param => {
                params[param] = parseFloat(document.getElementById(param).value);
            });
            renderer.updateParams(params);
        }
    } catch (error) {
        console.error('Renderer initialization failed:', error);
        if (backend === 'webgpu') {
            // Fall back to WebGL
            backendInfo.innerHTML = '<span class="backend-badge warning">⚠️ WebGPU unavailable, using WebGL</span>';
            backendInfo.style.display = 'block';
            await initializeRenderer('webgl');
        } else {
            alert('Failed to initialize graphics renderer. Please use a modern browser.');
        }
    } finally {
        showLoading(false);
    }
}

function setupEventListeners() {
    // File input
    const fileInput = document.getElementById('fileInput');
    fileInput.addEventListener('change', handleFileSelect);
    
    // Renderer backend selector
    const rendererSelect = document.getElementById('rendererSelect');
    rendererSelect.addEventListener('change', async (e) => {
        await initializeRenderer(e.target.value);
    });

    // Parameter sliders
    const sliders = [
        { id: 'strengthX', param: 'strengthX' },
        { id: 'strengthY', param: 'strengthY' },
        { id: 'falloffPower', param: 'falloffPower' },
        { id: 'centerX', param: 'centerX' },
        { id: 'centerY', param: 'centerY' }
    ];

    sliders.forEach(({ id, param }) => {
        const slider = document.getElementById(id);
        const valueDisplay = document.getElementById(id + 'Value');

        slider.addEventListener('input', (e) => {
            const value = parseFloat(e.target.value);
            valueDisplay.textContent = value.toFixed(3);
            renderer.updateParams({ [param]: value });
        });
    });

    // Reset button
    document.getElementById('resetBtn').addEventListener('click', resetParameters);

    // Download button
    document.getElementById('downloadBtn').addEventListener('click', downloadImage);

    // Drag and drop
    setupDragAndDrop();
}

function setupDragAndDrop() {
    const canvasContainer = document.getElementById('canvasContainer');
    const dropZone = document.getElementById('dropZone');

    // Prevent default drag behaviors
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        canvasContainer.addEventListener(eventName, preventDefaults, false);
        document.body.addEventListener(eventName, preventDefaults, false);
    });

    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    // Highlight drop zone when dragging over it
    ['dragenter', 'dragover'].forEach(eventName => {
        canvasContainer.addEventListener(eventName, () => {
            canvasContainer.classList.add('drag-over');
            if (!currentImage) {
                dropZone.classList.add('visible');
            }
        }, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        canvasContainer.addEventListener(eventName, () => {
            canvasContainer.classList.remove('drag-over');
            dropZone.classList.remove('visible');
        }, false);
    });

    // Handle dropped files
    canvasContainer.addEventListener('drop', handleDrop, false);
}

function handleDrop(e) {
    const dt = e.dataTransfer;
    const files = dt.files;

    if (files.length > 0) {
        handleFile(files[0]);
    }
}

function handleFile(file) {
    if (!file.type.match('image.*')) {
        alert('Please drop an image file.');
        return;
    }

    showLoading(true);

    const reader = new FileReader();
    reader.onload = async (e) => {
        const img = new Image();
        img.onload = async () => {
            currentImage = { img, file };
            await renderer.loadImage(img);
            updateImageInfo(img, file);
            document.getElementById('downloadBtn').disabled = false;
            showLoading(false);
        };
        img.onerror = () => {
            alert('Failed to load image. Please try another file.');
            showLoading(false);
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

function handleFileSelect(event) {
    const file = event.target.files[0];
    if (!file) return;
    handleFile(file);
}

function updateImageInfo(img, file) {
    const info = document.getElementById('imageInfo');
    const sizeKB = (file.size / 1024).toFixed(1);
    const sizeMB = (file.size / 1024 / 1024).toFixed(2);
    const sizeText = file.size > 1024 * 1024 ? `${sizeMB} MB` : `${sizeKB} KB`;

    info.innerHTML = `
        <strong>${file.name}</strong><br>
        ${img.width} × ${img.height} px • ${sizeText}
    `;
    info.style.display = 'block';
}

function resetParameters() {
    // Reset all sliders to default values
    Object.entries(DEFAULT_PARAMS).forEach(([param, value]) => {
        const slider = document.getElementById(param);
        const valueDisplay = document.getElementById(param + 'Value');

        slider.value = value;
        valueDisplay.textContent = value.toFixed(2);
    });

    // Update renderer
    renderer.updateParams(DEFAULT_PARAMS);
}

function showLoading(show) {
    const overlay = document.getElementById('loadingOverlay');
    if (show) {
        overlay.classList.remove('hidden');
    } else {
        overlay.classList.add('hidden');
    }
}

function downloadImage() {
    if (!currentImage) return;

    showLoading(true);

    // Small delay to allow loading overlay to show
    setTimeout(() => {
        try {
            // Get the active canvas
            const canvas = currentBackend === 'webgpu' 
                ? document.getElementById('webgpuCanvas')
                : document.getElementById('webglCanvas');

            // Convert canvas to blob and download
            canvas.toBlob(
                (blob) => {
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `corrected_${Date.now()}.png`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                    showLoading(false);
                },
                'image/png',
                1.0
            );
        } catch (error) {
            console.error('Download failed:', error);
            alert('Failed to download image. Please try again.');
            showLoading(false);
        }
    }, 50);
}

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
    // Ctrl/Cmd + S to download
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (currentImage) {
            downloadImage();
        }
    }

    // Ctrl/Cmd + R to reset
    if ((e.ctrlKey || e.metaKey) && e.key === 'r') {
        e.preventDefault();
        resetParameters();
    }
});
