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

// Enhanced browser detection
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent) || 
                 /Safari/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent);
const isDesktopSafari = isSafari && !isIOS;

// Check MediaRecorder support
const hasMediaRecorderSupport = () => {
    if (!window.MediaRecorder) return false;
    
    // Test specific codec support
    const types = [
        'video/webm;codecs=vp8',
        'video/webm;codecs=vp9', 
        'video/webm',
        'video/mp4'
    ];
    
    return types.some(type => MediaRecorder.isTypeSupported(type));
};

const mediaRecorderSupported = hasMediaRecorderSupport();

// Initialize the app
document.addEventListener('DOMContentLoaded', function() {
    setupEventListeners();
    setupBrowserWorkarounds();
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

// Setup browser-specific workarounds
function setupBrowserWorkarounds() {
    if (isIOS || isSafari) {
        // Update upload area text for mobile/Safari
        const uploadText = uploadArea.querySelector('h3');
        const uploadSubtext = uploadArea.querySelector('p');
        
        if (isIOS) {
            if (uploadText) {
                uploadText.textContent = 'Tap to select your video';
            }
            if (uploadSubtext) {
                uploadSubtext.textContent = 'Choose from Photos or Files';
            }
        } else if (isSafari) {
            if (uploadText) {
                uploadText.textContent = 'Click to select your video (Safari)';
            }
            if (uploadSubtext) {
                uploadSubtext.textContent = 'MP4 and MOV formats work best';
            }
        }
        
        // Add more specific file type acceptance for Safari/iOS
        videoInput.setAttribute('accept', 'video/mp4,video/mov,video/quicktime,video/m4v,video/*');
        
        // Add capture attribute for direct camera access on iOS
        if (isIOS) {
            videoInput.setAttribute('capture', 'environment');
        }
    }
    
    // Show warning for Safari users about export limitations
    if (isSafari && !mediaRecorderSupported) {
        console.log('Safari detected with limited MediaRecorder support');
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

// Handle video file upload with better Safari/iOS support
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
    
    // Safari-specific format warnings
    if (isSafari && !file.type.includes('mp4') && !file.type.includes('mov') && !file.type.includes('quicktime')) {
        showNotification('For best Safari compatibility, use MP4 or MOV format', 'info');
    }
    
    // Check file size (more conservative limits for Safari/iOS)
    const maxSize = isIOS ? 500 * 1024 * 1024 : (isSafari ? 800 * 1024 * 1024 : 1024 * 1024 * 1024);
    if (file.size > maxSize) {
        const maxSizeText = isIOS ? '500MB' : (isSafari ? '800MB' : '1GB');
        showNotification(`File too large. Please select a video smaller than ${maxSizeText}.`, 'error');
        return;
    }
    
    currentVideo = file;
    loadVideo(file);
    showExportSection();
    showNotification('Video uploaded successfully!', 'success');
}

// Check if file is a video based on extension (Safari/iOS backup)
function isVideoFile(file) {
    const videoExtensions = ['.mp4', '.mov', '.m4v', '.quicktime', '.avi', '.webm', '.mkv'];
    const fileName = file.name.toLowerCase();
    return videoExtensions.some(ext => fileName.endsWith(ext));
}

// Load and display video with Safari/iOS optimizations
function loadVideo(file) {
    try {
        const videoURL = URL.createObjectURL(file);
        
        // Clear container
        videoContainer.innerHTML = '';
        
        // Create video element with Safari/iOS-specific attributes
        videoElement = document.createElement('video');
        videoElement.src = videoURL;
        videoElement.controls = false;
        videoElement.muted = true;
        videoElement.loop = true;
        videoElement.playsInline = true; // Crucial for iOS
        videoElement.setAttribute('webkit-playsinline', 'true'); // Safari specific
        videoElement.preload = 'metadata';
        
        // Safari/iOS-specific: Don't autoplay, wait for user interaction
        if (isIOS || isSafari) {
            videoElement.autoplay = false;
        } else {
            videoElement.autoplay = true;
        }
        
        // Add error handling with Safari-specific messages
        videoElement.addEventListener('error', (e) => {
            console.error('Video error:', e);
            if (isSafari) {
                showNotification('Error loading video in Safari. Try MP4 or MOV format.', 'error');
            } else {
                showNotification('Error loading video. Please try a different format.', 'error');
            }
        });
        
        // Add loaded event handler
        videoElement.addEventListener('loadedmetadata', () => {
            console.log('Video loaded:', videoElement.videoWidth, 'x', videoElement.videoHeight);
            
            // Try to play for non-Safari or give Safari users instructions
            if (!isIOS && !isSafari) {
                videoElement.play().catch(e => {
                    console.log('Auto-play failed:', e);
                });
            } else if (isSafari) {
                showNotification('Video loaded! Click the play button to preview.', 'info');
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

// Add video control buttons with better Safari/iOS support
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

// Video control functions with Safari/iOS improvements
function togglePlayPause() {
    if (!videoElement) return;
    
    const playBtn = document.getElementById('play-btn');
    
    if (videoElement.paused) {
        // Use user gesture to play on Safari/iOS
        const playPromise = videoElement.play();
        
        if (playPromise !== undefined) {
            playPromise.then(() => {
                playBtn.textContent = '⏸️';
            }).catch(error => {
                console.log('Play failed:', error);
                if (isSafari || isIOS) {
                    showNotification('Tap the video directly to play', 'info');
                } else {
                    showNotification('Click to play video', 'info');
                }
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

// Show export section with Safari warning
function showExportSection() {
    exportSection.style.display = 'block';
    
    // Update export button text for Safari users
    if (isSafari && !mediaRecorderSupported) {
        exportBtn.innerHTML = 'Export Video <small>(Safari Limited)</small>';
        exportBtn.title = 'Safari has limited export capabilities. Best results in Chrome/Firefox.';
    }
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

// Export video with phone frame - Safari compatibility improvements
async function exportVideo() {
    if (!currentVideo || !videoElement) {
        showNotification('Please upload a video first.', 'error');
        return;
    }

    // Check for Safari limitations upfront
    if (isSafari && !mediaRecorderSupported) {
        showSafariExportMessage();
        return;
    }

    // Update button state
    exportBtn.textContent = 'Processing...';
    exportBtn.disabled = true;

    try {
        // Check if canvas.captureStream is supported
        const testCanvas = document.createElement('canvas');
        if (typeof testCanvas.captureStream !== 'function') {
            throw new Error('Canvas recording not supported in this browser');
        }

        // Show progress modal
        showExportProgress();
        
        // Get video duration
        const videoDuration = videoElement.duration || 30;
        const recordingDuration = Math.min(videoDuration * 1000, 60000); // Max 60 seconds
        
        // Create canvas for recording with 4:3 aspect ratio
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        // Set canvas size to 4:3 aspect ratio with high resolution
        const canvasWidth = 2400; 
        const canvasHeight = 1800; 
        canvas.width = canvasWidth;
        canvas.height = canvasHeight;
        
        // Calculate phone position to center it on the canvas
        const phoneWidth = 700; 
        const phoneHeight = 1400; 
        const phoneX = (canvasWidth - phoneWidth) / 2;
        const phoneY = (canvasHeight - phoneHeight) / 2;
        
        // Create stream from canvas
        const stream = canvas.captureStream(30); // 30 FPS
        
        // Setup MediaRecorder with better Safari support
        recordedChunks = [];
        let mimeType = 'video/webm';
        
        // Try different codecs in order of preference
        if (MediaRecorder.isTypeSupported('video/webm;codecs=vp9')) {
            mimeType = 'video/webm;codecs=vp9';
        } else if (MediaRecorder.isTypeSupported('video/webm;codecs=vp8')) {
            mimeType = 'video/webm;codecs=vp8';
        } else if (MediaRecorder.isTypeSupported('video/webm')) {
            mimeType = 'video/webm';
        } else {
            throw new Error('No supported video format available');
        }
        
        console.log('Using MIME type:', mimeType);
        
        mediaRecorder = new MediaRecorder(stream, {
            mimeType: mimeType,
            videoBitsPerSecond: isSafari ? 8000000 : 15000000 // Lower bitrate for Safari
        });

        mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                recordedChunks.push(event.data);
                console.log('Data chunk received:', event.data.size);
            }
        };

        mediaRecorder.onstop = () => {
            console.log('Recording stopped, creating blob...');
            const blob = new Blob(recordedChunks, { type: mimeType });
            const extension = 'webm'; // Always webm for Safari compatibility
            downloadVideo(blob, `screenvid-export.${extension}`);
            hideExportProgress();
            stream.getTracks().forEach(track => track.stop());
        };

        mediaRecorder.onerror = (event) => {
            console.error('MediaRecorder error:', event);
            throw new Error('Recording failed');
        };

        // Start recording
        mediaRecorder.start(1000); // Collect data every second
        console.log('Recording started...');
        
        // Restart video from beginning
        videoElement.currentTime = 0;
        await videoElement.play();
        
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
                const pulseScale = 1 + Math.sin(elapsedTime * 2) * 0.02; 
                
                // Apply pulse scale to phone position and size
                const pulsedPhoneWidth = phoneWidth * pulseScale;
                const pulsedPhoneHeight = phoneHeight * pulseScale;
                const pulsedPhoneX = phoneX - (pulsedPhoneWidth - phoneWidth) / 2;
                const pulsedPhoneY = phoneY - (pulsedPhoneHeight - phoneHeight) / 2;
                
                // Add subtle shadow behind phone
                ctx.shadowColor = 'rgba(0, 0, 0, 0.2)';
                ctx.shadowBlur = 40;
                ctx.shadowOffsetX = 0;
                ctx.shadowOffsetY = 20;
                
                // Draw phone frame background
                ctx.fillStyle = '#1a1a1a';
                ctx.beginPath();
                ctx.roundRect(pulsedPhoneX, pulsedPhoneY, pulsedPhoneWidth, pulsedPhoneHeight, 70 * pulseScale);
                ctx.fill();
                
                // Reset shadow
                ctx.shadowColor = 'transparent';
                ctx.shadowBlur = 0;
                ctx.shadowOffsetX = 0;
                ctx.shadowOffsetY = 0;
                
                // Draw phone frame border
                ctx.strokeStyle = '#000';
                ctx.lineWidth = 12 * pulseScale;
                ctx.beginPath();
                ctx.roundRect(pulsedPhoneX + 6 * pulseScale, pulsedPhoneY + 6 * pulseScale, pulsedPhoneWidth - 12 * pulseScale, pulsedPhoneHeight - 12 * pulseScale, 64 * pulseScale);
                ctx.stroke();
                
                // Draw phone screen area
                ctx.fillStyle = '#000';
                ctx.beginPath();
                ctx.roundRect(pulsedPhoneX + 30 * pulseScale, pulsedPhoneY + 30 * pulseScale, pulsedPhoneWidth - 60 * pulseScale, pulsedPhoneHeight - 60 * pulseScale, 64 * pulseScale);
                ctx.fill();
                
                // Draw video frame if available
                if (videoElement && !videoElement.paused && videoElement.readyState >= 2) {
                    const screenWidth = pulsedPhoneWidth - 60 * pulseScale;
                    const screenHeight = pulsedPhoneHeight - 60 * pulseScale;
                    const screenX = pulsedPhoneX + 30 * pulseScale;
                    const screenY = pulsedPhoneY + 30 * pulseScale;
                    
                    // Fit video to screen
                    const videoAspectRatio = videoElement.videoWidth / videoElement.videoHeight;
                    const screenAspectRatio = screenWidth / screenHeight;
                    
                    let drawWidth, drawHeight, drawX, drawY;
                    
                    drawWidth = screenWidth;
                    drawHeight = screenWidth / videoAspectRatio;
                    drawX = screenX;
                    
                    if (drawHeight <= screenHeight) {
                        drawY = screenY + (screenHeight - drawHeight) / 2;
                    } else {
                        drawY = screenY - (drawHeight - screenHeight) / 2;
                    }
                    
                    ctx.save();
                    ctx.beginPath();
                    ctx.roundRect(screenX, screenY, screenWidth, screenHeight, 64 * pulseScale);
                    ctx.clip();
                    
                    try {
                        ctx.drawImage(videoElement, drawX, drawY, drawWidth, drawHeight);
                    } catch (e) {
                        console.error('Error drawing video frame:', e);
                    }
                    
                    ctx.restore();
                }
                
                // Add home indicator
                ctx.fillStyle = '#333';
                ctx.beginPath();
                ctx.roundRect(pulsedPhoneX + pulsedPhoneWidth/2 - 60 * pulseScale, pulsedPhoneY + pulsedPhoneHeight - 30 * pulseScale, 120 * pulseScale, 12 * pulseScale, 6 * pulseScale);
                ctx.fill();
                
                // Add branding
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
                console.log('Stopping recording...');
                mediaRecorder.stop();
            }
        }, recordingDuration);

    } catch (error) {
        console.error('Error exporting video:', error);
        
        if (isSafari) {
            showNotification('Safari export failed. Try Chrome or Firefox for best results.', 'error');
        } else {
            showNotification('Error exporting video. Please try again.', 'error');
        }
        
        hideExportProgress();
    } finally {
        exportBtn.textContent = 'Export Video with Phone Frame';
        exportBtn.disabled = false;
    }
}

// Show Safari-specific export message
function showSafariExportMessage() {
    const modal = document.createElement('div');
    modal.className = 'export-progress';
    modal.style.position = 'fixed';
    modal.style.top = '50%';
    modal.style.left = '50%';
    modal.style.transform = 'translate(-50%, -50%)';
    modal.style.zIndex = '10001';
    
    modal.innerHTML = `
        <h3>🦾 Safari Limitations</h3>
        <p>Sorry! Safari doesn't support video recording features needed for export.</p>
        <div style="margin: 20px 0;">
            <strong>For best results, please use:</strong><br>
            • Chrome<br>
            • Firefox<br>
            • Edge
        </div>
        <p><small>You can still preview your video in Safari, but export requires a different browser.</small></p>
        <button onclick="this.parentElement.remove()" style="margin-top: 15px; padding: 10px 20px; background: black; color: white; border: none; border-radius: 8px; cursor: pointer;">Got it</button>
    `;
    
    document.body.appendChild(modal);
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
    
    const formatText = isSafari ? 'WebM' : 'Ultra High-Quality MP4';
    
    modal.innerHTML = `
        <h3>🎬 Creating Animated ${formatText}</h3>
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