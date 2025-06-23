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

// Simple browser detection
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
const isSafari = /Safari/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent);

// Initialize the app
document.addEventListener('DOMContentLoaded', function() {
    setupEventListeners();
});

// Setup all event listeners
function setupEventListeners() {
    // File input change
    videoInput.addEventListener('change', handleVideoUpload);
    
    // Upload area click
    uploadArea.addEventListener('click', () => {
        videoInput.click();
    });
    
    // Drag and drop functionality (desktop only)
    if (!isIOS) {
        uploadArea.addEventListener('dragover', handleDragOver);
        uploadArea.addEventListener('dragleave', handleDragLeave);
        uploadArea.addEventListener('drop', handleDrop);
        
        document.addEventListener('dragover', e => e.preventDefault());
        document.addEventListener('drop', e => e.preventDefault());
    }
}

// Handle video file upload
function handleVideoUpload(event) {
    const files = event.target.files;
    
    if (!files || files.length === 0) {
        console.log('No files selected');
        return;
    }
    
    const file = files[0];
    console.log('File selected:', file.name, file.type, file.size);
    
    // Check if it's a video file
    if (!file.type.startsWith('video/')) {
        showNotification('Please select a valid video file', 'error');
        return;
    }
    
    // Check file size (1GB limit)
    if (file.size > 1024 * 1024 * 1024) {
        showNotification('File too large. Please select a video smaller than 1GB.', 'error');
        return;
    }
    
    currentVideo = file;
    loadVideo(file);
    showExportSection();
    showNotification('Video uploaded successfully!', 'success');
}

// Load and display video
function loadVideo(file) {
    try {
        const videoURL = URL.createObjectURL(file);
        
        // Clear container
        videoContainer.innerHTML = '';
        
        // Create video element
        videoElement = document.createElement('video');
        videoElement.src = videoURL;
        videoElement.controls = false;
        videoElement.muted = true;
        videoElement.loop = true;
        videoElement.playsInline = true;
        videoElement.setAttribute('webkit-playsinline', 'true');
        videoElement.preload = 'metadata';
        
        // Don't autoplay on mobile
        if (!isIOS && !isSafari) {
            videoElement.autoplay = true;
        }
        
        // Add error handling
        videoElement.addEventListener('error', (e) => {
            console.error('Video error:', e);
            showNotification('Error loading video. Please try a different format.', 'error');
        });
        
        // Add loaded event handler
        videoElement.addEventListener('loadeddata', () => {
            console.log('Video loaded:', videoElement.videoWidth, 'x', videoElement.videoHeight);
            
            // Try to play
            if (!isIOS && !isSafari) {
                videoElement.play().catch(e => {
                    console.log('Auto-play failed:', e);
                });
            }
        });
        
        videoContainer.appendChild(videoElement);
        
        // Add video controls
        addVideoControls();
        
    } catch (error) {
        console.error('Error loading video:', error);
        showNotification('Error loading video. Please try again.', 'error');
    }
}

// Add video control buttons
function addVideoControls() {
    const controls = document.createElement('div');
    controls.className = 'video-controls';
    controls.innerHTML = `
        <button onclick="togglePlayPause()" id="play-btn" type="button">▶️</button>
        <button onclick="restartVideo()" type="button">🔄</button>
        <button onclick="toggleMute()" id="mute-btn" type="button">🔇</button>
    `;
    
    videoContainer.appendChild(controls);
}

// Video control functions
function togglePlayPause() {
    if (!videoElement) return;
    
    const playBtn = document.getElementById('play-btn');
    
    if (videoElement.paused) {
        videoElement.play().then(() => {
            playBtn.textContent = '⏸️';
        }).catch(error => {
            console.log('Play failed:', error);
        });
    } else {
        videoElement.pause();
        playBtn.textContent = '▶️';
    }
}

function restartVideo() {
    if (!videoElement) return;
    
    videoElement.currentTime = 0;
    videoElement.play().then(() => {
        document.getElementById('play-btn').textContent = '⏸️';
    }).catch(error => {
        console.log('Play failed:', error);
    });
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

// Drag and drop handlers
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
        if (file.type.startsWith('video/')) {
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

    // Check MediaRecorder support
    if (!window.MediaRecorder) {
        showNotification('Video export not supported in this browser. Try Chrome or Firefox.', 'error');
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
        
        // Create canvas for recording
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        // Set canvas size to 4:3 aspect ratio
        const canvasWidth = 2400;
        const canvasHeight = 1800;
        canvas.width = canvasWidth;
        canvas.height = canvasHeight;
        
        // Calculate phone position
        const phoneWidth = 700;
        const phoneHeight = 1400;
        const phoneX = (canvasWidth - phoneWidth) / 2;
        const phoneY = (canvasHeight - phoneHeight) / 2;
        
        // Create stream from canvas
        const stream = canvas.captureStream(30); // 30 FPS
        
        // Setup MediaRecorder
        recordedChunks = [];
        let mimeType = 'video/webm';
        
        if (MediaRecorder.isTypeSupported('video/webm;codecs=vp9')) {
            mimeType = 'video/webm;codecs=vp9';
        } else if (MediaRecorder.isTypeSupported('video/webm;codecs=vp8')) {
            mimeType = 'video/webm;codecs=vp8';
        } else if (MediaRecorder.isTypeSupported('video/webm')) {
            mimeType = 'video/webm';
        } else if (MediaRecorder.isTypeSupported('video/mp4')) {
            mimeType = 'video/mp4';
        } else {
            throw new Error('No supported video format available');
        }
        
        console.log('Using mime type:', mimeType);
        
        mediaRecorder = new MediaRecorder(stream, {
            mimeType: mimeType,
            videoBitsPerSecond: 12000000 // 12 Mbps
        });

        mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                recordedChunks.push(event.data);
            }
        };

        mediaRecorder.onstop = () => {
            const blob = new Blob(recordedChunks, { type: mimeType });
            const extension = mimeType.includes('mp4') ? 'mp4' : 'webm';
            downloadVideo(blob, `screenvid-export.${extension}`);
            hideExportProgress();
            stream.getTracks().forEach(track => track.stop());
        };

        // IMPORTANT: Start recording first
        mediaRecorder.start();
        console.log('Recording started');
        
        // THEN start the video playback
        videoElement.currentTime = 0;
        await videoElement.play();
        console.log('Video started playing');
        
        // Wait a moment for video to start
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Update progress
        updateExportProgress(recordingDuration);
        
        // Animation variables
        let animationStartTime = Date.now();
        
        // Function to draw frames
        const drawFrame = () => {
            if (mediaRecorder && mediaRecorder.state === 'recording') {
                // Clear canvas with white background
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                
                // Draw grid lines
                drawGridLines(ctx, canvas.width, canvas.height);
                
                // Calculate pulse animation
                const elapsedTime = (Date.now() - animationStartTime) / 1000;
                const pulseScale = 1 + Math.sin(elapsedTime * 2) * 0.02;
                
                // Phone dimensions with pulse
                const pulsedPhoneWidth = phoneWidth * pulseScale;
                const pulsedPhoneHeight = phoneHeight * pulseScale;
                const pulsedPhoneX = phoneX - (pulsedPhoneWidth - phoneWidth) / 2;
                const pulsedPhoneY = phoneY - (pulsedPhoneHeight - phoneHeight) / 2;
                
                // Draw phone shadow
                ctx.shadowColor = 'rgba(0, 0, 0, 0.2)';
                ctx.shadowBlur = 40;
                ctx.shadowOffsetX = 0;
                ctx.shadowOffsetY = 20;
                
                // Draw phone background
                ctx.fillStyle = '#1a1a1a';
                ctx.beginPath();
                ctx.roundRect(pulsedPhoneX, pulsedPhoneY, pulsedPhoneWidth, pulsedPhoneHeight, 70 * pulseScale);
                ctx.fill();
                
                // Reset shadow
                ctx.shadowColor = 'transparent';
                ctx.shadowBlur = 0;
                ctx.shadowOffsetX = 0;
                ctx.shadowOffsetY = 0;
                
                // Draw phone border
                ctx.strokeStyle = '#000';
                ctx.lineWidth = 12 * pulseScale;
                ctx.beginPath();
                ctx.roundRect(pulsedPhoneX + 6 * pulseScale, pulsedPhoneY + 6 * pulseScale, pulsedPhoneWidth - 12 * pulseScale, pulsedPhoneHeight - 12 * pulseScale, 64 * pulseScale);
                ctx.stroke();
                
                // Draw screen background
                ctx.fillStyle = '#000';
                ctx.beginPath();
                ctx.roundRect(pulsedPhoneX + 30 * pulseScale, pulsedPhoneY + 30 * pulseScale, pulsedPhoneWidth - 60 * pulseScale, pulsedPhoneHeight - 60 * pulseScale, 64 * pulseScale);
                ctx.fill();
                
                // Draw video if playing
                if (videoElement && !videoElement.paused && !videoElement.ended && videoElement.readyState >= 2) {
                    const screenWidth = pulsedPhoneWidth - 60 * pulseScale;
                    const screenHeight = pulsedPhoneHeight - 60 * pulseScale;
                    const screenX = pulsedPhoneX + 30 * pulseScale;
                    const screenY = pulsedPhoneY + 30 * pulseScale;
                    
                    // Calculate video dimensions to fit screen
                    const videoAspectRatio = videoElement.videoWidth / videoElement.videoHeight;
                    const screenAspectRatio = screenWidth / screenHeight;
                    
                    let drawWidth, drawHeight, drawX, drawY;
                    
                    if (videoAspectRatio > screenAspectRatio) {
                        // Video is wider - fit to screen width
                        drawWidth = screenWidth;
                        drawHeight = screenWidth / videoAspectRatio;
                        drawX = screenX;
                        drawY = screenY + (screenHeight - drawHeight) / 2;
                    } else {
                        // Video is taller - fit to screen height
                        drawHeight = screenHeight;
                        drawWidth = screenHeight * videoAspectRatio;
                        drawY = screenY;
                        drawX = screenX + (screenWidth - drawWidth) / 2;
                    }
                    
                    // Clip to screen area
                    ctx.save();
                    ctx.beginPath();
                    ctx.roundRect(screenX, screenY, screenWidth, screenHeight, 64 * pulseScale);
                    ctx.clip();
                    
                    // Draw the video frame
                    try {
                        ctx.drawImage(videoElement, drawX, drawY, drawWidth, drawHeight);
                    } catch (e) {
                        console.error('Error drawing video frame:', e);
                    }
                    
                    ctx.restore();
                } else {
                    // Debug: Show video state
                    console.log('Video state:', {
                        paused: videoElement?.paused,
                        ended: videoElement?.ended,
                        readyState: videoElement?.readyState,
                        currentTime: videoElement?.currentTime
                    });
                }
                
                // Draw home indicator
                ctx.fillStyle = '#333';
                ctx.beginPath();
                ctx.roundRect(pulsedPhoneX + pulsedPhoneWidth/2 - 60 * pulseScale, pulsedPhoneY + pulsedPhoneHeight - 30 * pulseScale, 120 * pulseScale, 12 * pulseScale, 6 * pulseScale);
                ctx.fill();
                
                // Draw branding
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
        showNotification('Error exporting video: ' + error.message, 'error');
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
        <h3>🎬 Creating Video with Phone Frame</h3>
        <p>Recording your video with phone frame animation...</p>
        <div class="progress-bar">
            <div class="progress-fill" id="progress-fill"></div>
        </div>
        <p><small>This may take a moment depending on video length</small></p>
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

// Draw grid lines
function drawGridLines(ctx, canvasWidth, canvasHeight) {
    ctx.save();
    
    const gridSize = 60;
    const lineWidth = 1;
    const opacity = 0.08;
    
    ctx.strokeStyle = `rgba(0, 0, 0, ${opacity})`;
    ctx.lineWidth = lineWidth;
    
    // Vertical lines
    for (let x = 0; x <= canvasWidth; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvasHeight);
        ctx.stroke();
    }
    
    // Horizontal lines
    for (let y = 0; y <= canvasHeight; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvasWidth, y);
        ctx.stroke();
    }
    
    ctx.restore();
}

// Canvas roundRect polyfill
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