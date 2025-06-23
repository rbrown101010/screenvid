// Global variables
let currentVideo = null;
let videoElement = null;
let mediaRecorder = null;
let recordedChunks = [];

// DOM elements
const videoInput = document.getElementById('video-input');
const uploadArea = document.getElementById('upload-area');
const exportSection = document.getElementById('export-section');
const exportBtn = document.getElementById('export-btn');
const videoContainer = document.getElementById('video-container');
const phoneDevice = document.getElementById('phone-device');

// Check if we're on iOS
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

// Initialize the app
document.addEventListener('DOMContentLoaded', function() {
    setupEventListeners();
    setupIOSWorkarounds();
});

// Setup all event listeners
function setupEventListeners() {
    // File input change - multiple events for better iOS compatibility
    videoInput.addEventListener('change', handleVideoUpload);
    videoInput.addEventListener('input', handleVideoUpload); // iOS backup
    
    // Upload area click - more explicit for iOS
    uploadArea.addEventListener('click', handleUploadAreaClick);
    uploadArea.addEventListener('touchend', handleUploadAreaClick);
    
    // Drag and drop functionality (disabled on mobile)
    if (!isIOS) {
        uploadArea.addEventListener('dragover', handleDragOver);
        uploadArea.addEventListener('dragleave', handleDragLeave);
        uploadArea.addEventListener('drop', handleDrop);
        
        // Prevent default drag behaviors on document
        document.addEventListener('dragover', e => e.preventDefault());
        document.addEventListener('drop', e => e.preventDefault());
    }
}

// Setup iOS-specific workarounds
function setupIOSWorkarounds() {
    if (isIOS || isSafari) {
        // Update upload area text for mobile
        const uploadText = uploadArea.querySelector('h3');
        const uploadSubtext = uploadArea.querySelector('p');
        
        if (uploadText) {
            uploadText.textContent = 'Tap to select your video';
        }
        if (uploadSubtext) {
            uploadSubtext.textContent = 'Choose from Photos or Files';
        }
        
        // Add more specific file type acceptance for iOS
        videoInput.setAttribute('accept', 'video/mp4,video/mov,video/quicktime,video/m4v,video/*');
        
        // Add capture attribute for direct camera access
        videoInput.setAttribute('capture', 'environment');
    }
}

// Handle upload area clicks
function handleUploadAreaClick(event) {
    event.preventDefault();
    event.stopPropagation();
    
    // Small delay to ensure iOS processes the user interaction
    setTimeout(() => {
        videoInput.click();
    }, 100);
}

// Handle video file upload with better iOS support
function handleVideoUpload(event) {
    const files = event.target.files;
    
    if (!files || files.length === 0) {
        console.log('No files selected');
        return;
    }
    
    const file = files[0];
    console.log('File selected:', file.name, file.type, file.size);
    
    // Check if it's a video file
    if (!file.type.startsWith('video/') && !isVideoFile(file)) {
        showNotification('Please select a valid video file (MP4, MOV, etc.)', 'error');
        return;
    }
    
    // Check file size (limit to 500MB for iOS)
    const maxSize = isIOS ? 500 * 1024 * 1024 : 1024 * 1024 * 1024; // 500MB for iOS, 1GB for others
    if (file.size > maxSize) {
        const maxSizeText = isIOS ? '500MB' : '1GB';
        showNotification(`File too large. Please select a video smaller than ${maxSizeText}.`, 'error');
        return;
    }
    
    currentVideo = file;
    loadVideo(file);
    showExportSection();
    showNotification('Video uploaded successfully!', 'success');
}

// Check if file is a video based on extension (iOS backup)
function isVideoFile(file) {
    const videoExtensions = ['.mp4', '.mov', '.m4v', '.quicktime', '.avi', '.webm', '.mkv'];
    const fileName = file.name.toLowerCase();
    return videoExtensions.some(ext => fileName.endsWith(ext));
}

// Load and display video with iOS optimizations
function loadVideo(file) {
    try {
        const videoURL = URL.createObjectURL(file);
        
        // Clear container
        videoContainer.innerHTML = '';
        
        // Create video element with iOS-specific attributes
        videoElement = document.createElement('video');
        videoElement.src = videoURL;
        videoElement.controls = false;
        videoElement.muted = true;
        videoElement.loop = true;
        videoElement.playsInline = true; // Crucial for iOS
        videoElement.setAttribute('webkit-playsinline', 'true'); // Safari specific
        videoElement.preload = 'metadata';
        
        // iOS-specific: Don't autoplay, wait for user interaction
        if (isIOS || isSafari) {
            videoElement.autoplay = false;
        } else {
            videoElement.autoplay = true;
        }
        
        // Add error handling
        videoElement.addEventListener('error', (e) => {
            console.error('Video error:', e);
            showNotification('Error loading video. Please try a different format.', 'error');
        });
        
        // Add loaded event handler
        videoElement.addEventListener('loadedmetadata', () => {
            console.log('Video loaded:', videoElement.videoWidth, 'x', videoElement.videoHeight);
            
            // Try to play for non-iOS
            if (!isIOS && !isSafari) {
                videoElement.play().catch(e => {
                    console.log('Auto-play failed:', e);
                });
            }
        });
        
        // Add can play event
        videoElement.addEventListener('canplay', () => {
            console.log('Video can play');
        });
        
        videoContainer.appendChild(videoElement);
        
        // Add video controls
        addVideoControls();
        
    } catch (error) {
        console.error('Error loading video:', error);
        showNotification('Error loading video. Please try again.', 'error');
    }
}

// Add video control buttons with better iOS support
function addVideoControls() {
    const controls = document.createElement('div');
    controls.className = 'video-controls';
    controls.innerHTML = `
        <button onclick="togglePlayPause()" id="play-btn" type="button">▶️</button>
        <button onclick="restartVideo()" type="button">🔄</button>
        <button onclick="toggleMute()" id="mute-btn" type="button">🔇</button>
    `;
    
    videoContainer.appendChild(controls);
    
    // Add touch event handlers for iOS
    if (isIOS) {
        const buttons = controls.querySelectorAll('button');
        buttons.forEach(button => {
            button.addEventListener('touchstart', (e) => {
                e.preventDefault();
                button.style.transform = 'scale(0.95)';
            });
            
            button.addEventListener('touchend', (e) => {
                e.preventDefault();
                button.style.transform = 'scale(1)';
            });
        });
    }
}

// Video control functions with iOS improvements
function togglePlayPause() {
    if (!videoElement) return;
    
    const playBtn = document.getElementById('play-btn');
    
    if (videoElement.paused) {
        // Use user gesture to play on iOS
        const playPromise = videoElement.play();
        
        if (playPromise !== undefined) {
            playPromise.then(() => {
                playBtn.textContent = '⏸️';
            }).catch(error => {
                console.log('Play failed:', error);
                showNotification('Tap the video to play', 'info');
            });
        }
    } else {
        videoElement.pause();
        playBtn.textContent = '▶️';
    }
}

function restartVideo() {
    if (!videoElement) return;
    
    videoElement.currentTime = 0;
    
    const playPromise = videoElement.play();
    if (playPromise !== undefined) {
        playPromise.then(() => {
            document.getElementById('play-btn').textContent = '⏸️';
        }).catch(error => {
            console.log('Play failed:', error);
        });
    }
}

function toggleMute() {
    if (!videoElement) return;
    
    const muteBtn = document.getElementById('mute-btn');
    videoElement.muted = !videoElement.muted;
    muteBtn.textContent = videoElement.muted ? '🔇' : '🔊';
}

// Show export section
function showExportSection() {
    exportSection.style.display = 'block';
}

// Drag and drop handlers (desktop only)
function handleDragOver(e) {
    e.preventDefault();
    uploadArea.classList.add('dragover');
}

function handleDragLeave(e) {
    e.preventDefault();
    uploadArea.classList.remove('dragover');
}

function handleDrop(e) {
    e.preventDefault();
    uploadArea.classList.remove('dragover');
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
        const file = files[0];
        if (file.type.startsWith('video/') || isVideoFile(file)) {
            currentVideo = file;
            loadVideo(file);
            showExportSection();
            showNotification('Video uploaded successfully!', 'success');
        } else {
            showNotification('Please drop a valid video file.', 'error');
        }
    }
}

// Export video with phone frame
async function exportVideo() {
    if (!currentVideo || !videoElement) {
        showNotification('Please upload a video first.', 'error');
        return;
    }

    // Update button state
    exportBtn.textContent = 'Processing...';
    exportBtn.disabled = true;

    try {
        // Show progress modal
        showExportProgress();
        
        // Get video duration
        const videoDuration = videoElement.duration || 30;
        const recordingDuration = Math.min(videoDuration * 1000, 60000); // Max 60 seconds
        
        // Create canvas for recording with 4:3 aspect ratio
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        // Set canvas size to 4:3 aspect ratio with ultra high resolution
        const phoneRect = phoneDevice.getBoundingClientRect();
        const canvasWidth = 2400; // Ultra high resolution 4:3 format (doubled)
        const canvasHeight = 1800; // 4:3 aspect ratio (2400x1800)
        canvas.width = canvasWidth;
        canvas.height = canvasHeight;
        
        // Calculate phone position to center it on the canvas with good proportions (scaled up)
        const phoneWidth = 700; // Doubled size for higher resolution
        const phoneHeight = 1400; // 2:1 ratio for phone (doubled)
        const phoneX = (canvasWidth - phoneWidth) / 2;
        const phoneY = (canvasHeight - phoneHeight) / 2;
        
        // Create stream from canvas
        const stream = canvas.captureStream(30); // 30 FPS
        
        // Setup MediaRecorder with MP4 support
        recordedChunks = [];
        let mimeType = 'video/mp4';
        
        // Fallback to webm if mp4 not supported
        if (!MediaRecorder.isTypeSupported('video/mp4')) {
            if (MediaRecorder.isTypeSupported('video/webm;codecs=vp9')) {
                mimeType = 'video/webm;codecs=vp9';
            } else {
                mimeType = 'video/webm';
            }
        }
        
        mediaRecorder = new MediaRecorder(stream, {
            mimeType: mimeType,
            videoBitsPerSecond: 15000000 // 15 Mbps for ultra high quality
        });

        mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                recordedChunks.push(event.data);
            }
        };

        mediaRecorder.onstop = () => {
            const blob = new Blob(recordedChunks, { type: mimeType });
            const extension = mimeType.includes('mp4') ? 'mp4' : 'webm';
            downloadVideo(blob, `phone-frame-4x3.${extension}`);
            hideExportProgress();
            stream.getTracks().forEach(track => track.stop());
        };

        // Start recording
        mediaRecorder.start();
        
        // Restart video from beginning
        videoElement.currentTime = 0;
        videoElement.play();
        
        // Update progress
        updateExportProgress(recordingDuration);
        
        // Animation variables
        let animationStartTime = Date.now();
        
        // Function to draw frames
        const drawFrame = () => {
            if (mediaRecorder && mediaRecorder.state === 'recording') {
                // Clear canvas and fill with white background
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                
                // Draw subtle grid lines
                drawGridLines(ctx, canvas.width, canvas.height);
                
                // Calculate pulse animation
                const elapsedTime = (Date.now() - animationStartTime) / 1000;
                const pulseScale = 1 + Math.sin(elapsedTime * 2) * 0.02; // Gentle 2% pulse every ~3 seconds
                
                // Apply pulse scale to phone position and size
                const pulsedPhoneWidth = phoneWidth * pulseScale;
                const pulsedPhoneHeight = phoneHeight * pulseScale;
                const pulsedPhoneX = phoneX - (pulsedPhoneWidth - phoneWidth) / 2;
                const pulsedPhoneY = phoneY - (pulsedPhoneHeight - phoneHeight) / 2;
                
                // Add subtle shadow behind phone (scaled for higher resolution)
                ctx.shadowColor = 'rgba(0, 0, 0, 0.2)';
                ctx.shadowBlur = 40;
                ctx.shadowOffsetX = 0;
                ctx.shadowOffsetY = 20;
                
                // Draw phone frame background (black with rounded corners)
                ctx.fillStyle = '#1a1a1a';
                ctx.beginPath();
                ctx.roundRect(pulsedPhoneX, pulsedPhoneY, pulsedPhoneWidth, pulsedPhoneHeight, 70 * pulseScale);
                ctx.fill();
                
                // Reset shadow
                ctx.shadowColor = 'transparent';
                ctx.shadowBlur = 0;
                ctx.shadowOffsetX = 0;
                ctx.shadowOffsetY = 0;
                
                // Draw phone frame border (scaled for higher resolution)
                ctx.strokeStyle = '#000';
                ctx.lineWidth = 12 * pulseScale;
                ctx.beginPath();
                ctx.roundRect(pulsedPhoneX + 6 * pulseScale, pulsedPhoneY + 6 * pulseScale, pulsedPhoneWidth - 12 * pulseScale, pulsedPhoneHeight - 12 * pulseScale, 64 * pulseScale);
                ctx.stroke();
                
                // Draw phone screen area (black background) - matching outer radius
                ctx.fillStyle = '#000';
                ctx.beginPath();
                ctx.roundRect(pulsedPhoneX + 30 * pulseScale, pulsedPhoneY + 30 * pulseScale, pulsedPhoneWidth - 60 * pulseScale, pulsedPhoneHeight - 60 * pulseScale, 64 * pulseScale);
                ctx.fill();
                
                // Draw video frame if available
                if (videoElement && !videoElement.paused) {
                    const screenWidth = pulsedPhoneWidth - 60 * pulseScale;
                    const screenHeight = pulsedPhoneHeight - 60 * pulseScale;
                    const screenX = pulsedPhoneX + 30 * pulseScale;
                    const screenY = pulsedPhoneY + 30 * pulseScale;
                    
                    // Fit video to fill screen width (like object-fit: cover but width-priority)
                    const videoAspectRatio = videoElement.videoWidth / videoElement.videoHeight;
                    const screenAspectRatio = screenWidth / screenHeight;
                    
                    let drawWidth, drawHeight, drawX, drawY;
                    
                    // Always fit to width to eliminate side gaps
                    drawWidth = screenWidth;
                    drawHeight = screenWidth / videoAspectRatio;
                    drawX = screenX;
                    
                    if (drawHeight <= screenHeight) {
                        // Video fits height-wise, center it vertically
                        drawY = screenY + (screenHeight - drawHeight) / 2;
                    } else {
                        // Video is taller than screen, center it vertically (crop top/bottom)
                        drawY = screenY - (drawHeight - screenHeight) / 2;
                    }
                    
                    ctx.save();
                    ctx.beginPath();
                    ctx.roundRect(screenX, screenY, screenWidth, screenHeight, 64 * pulseScale);
                    ctx.clip();
                    
                    ctx.drawImage(videoElement, drawX, drawY, drawWidth, drawHeight);
                    ctx.restore();
                }
                
                // Add phone details (home indicator only)
                // Home indicator (scaled for higher resolution and pulse)
                ctx.fillStyle = '#333';
                ctx.beginPath();
                ctx.roundRect(pulsedPhoneX + pulsedPhoneWidth/2 - 60 * pulseScale, pulsedPhoneY + pulsedPhoneHeight - 30 * pulseScale, 120 * pulseScale, 12 * pulseScale, 6 * pulseScale);
                ctx.fill();
                
                // Add "Built on Vibe Code" text in bottom right corner
                ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
                ctx.font = '72px Nunito, -apple-system, BlinkMacSystemFont, sans-serif';
                ctx.textAlign = 'right';
                ctx.fillText('Built on Vibe Code', canvas.width - 50, canvas.height - 50);
                
                requestAnimationFrame(drawFrame);
            }
        };
        
        // Start drawing frames
        drawFrame();
        
        // Stop recording after duration
        setTimeout(() => {
            if (mediaRecorder && mediaRecorder.state === 'recording') {
                mediaRecorder.stop();
            }
        }, recordingDuration);

    } catch (error) {
        console.error('Error exporting video:', error);
        showNotification('Error exporting video. Please try again.', 'error');
        hideExportProgress();
    } finally {
        exportBtn.textContent = 'Export Video with Phone Frame';
        exportBtn.disabled = false;
    }
}

// Download video file
function downloadVideo(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    showNotification('Video exported successfully! Check your downloads.', 'success');
}

// Show export progress modal
function showExportProgress() {
    const modal = document.createElement('div');
    modal.id = 'export-progress-modal';
    modal.className = 'export-progress';
    modal.innerHTML = `
        <h3>🎬 Creating Animated Ultra High-Quality MP4</h3>
        <p>Adding phone frame with pulse animation and grid background...</p>
        <div class="progress-bar">
            <div class="progress-fill" id="progress-fill"></div>
        </div>
        <p><small>Exporting with animations in 2400x1800 resolution - this may take a moment</small></p>
    `;
    document.body.appendChild(modal);
}

// Update export progress
function updateExportProgress(duration) {
    const progressFill = document.getElementById('progress-fill');
    const startTime = Date.now();
    
    const updateProgress = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min((elapsed / duration) * 100, 100);
        
        if (progressFill) {
            progressFill.style.width = progress + '%';
        }
        
        if (progress < 100) {
            requestAnimationFrame(updateProgress);
        }
    };
    
    updateProgress();
}

// Hide export progress modal
function hideExportProgress() {
    const modal = document.getElementById('export-progress-modal');
    if (modal) {
        document.body.removeChild(modal);
    }
}

// Show notification
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    // Auto remove after 4 seconds
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 4000);
}

// Draw subtle grid lines on background
function drawGridLines(ctx, canvasWidth, canvasHeight) {
    ctx.save();
    
    // Grid settings
    const gridSize = 60; // Grid spacing
    const lineWidth = 1;
    const opacity = 0.08; // Very subtle
    
    ctx.strokeStyle = `rgba(0, 0, 0, ${opacity})`;
    ctx.lineWidth = lineWidth;
    
    // Draw vertical lines
    for (let x = 0; x <= canvasWidth; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvasHeight);
        ctx.stroke();
    }
    
    // Draw horizontal lines
    for (let y = 0; y <= canvasHeight; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvasWidth, y);
        ctx.stroke();
    }
    
    ctx.restore();
}

// Canvas roundRect polyfill for older browsers
if (!CanvasRenderingContext2D.prototype.roundRect) {
    CanvasRenderingContext2D.prototype.roundRect = function(x, y, width, height, radius) {
        this.beginPath();
        this.moveTo(x + radius, y);
        this.lineTo(x + width - radius, y);
        this.quadraticCurveTo(x + width, y, x + width, y + radius);
        this.lineTo(x + width, y + height - radius);
        this.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
        this.lineTo(x + radius, y + height);
        this.quadraticCurveTo(x, y + height, x, y + height - radius);
        this.lineTo(x, y + radius);
        this.quadraticCurveTo(x, y, x + radius, y);
        this.closePath();
    };
} 