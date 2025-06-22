class MusicVisualizer {
    constructor() {
        this.canvas = document.getElementById('visualizer');
        this.ctx = this.canvas.getContext('2d');
        this.audio = document.getElementById('audio');
        this.audioContext = null;
        this.analyser = null;
        this.dataArray = null;
        this.source = null;
        this.isPlaying = false;
        this.visualStyle = 'bars';

        this.setupCanvas();
        this.setupEventListeners();

        // Start animation loop
        this.animate();
    }

    setupCanvas() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;

        window.addEventListener('resize', () => {
            this.canvas.width = window.innerWidth;
            this.canvas.height = window.innerHeight;
        });
    }

    setupEventListeners() {
        const audioFile = document.getElementById('audioFile');
        const playBtn = document.getElementById('playBtn');
        const pauseBtn = document.getElementById('pauseBtn');
        const micBtn = document.getElementById('micBtn');
        const stopMicBtn = document.getElementById('stopMicBtn');
        const visualStyle = document.getElementById('visualStyle');
        const status = document.getElementById('status');
        const seekBar = document.getElementById('seekBar');
        const currentTimeDisplay = document.getElementById('currentTime');
        const durationDisplay = document.getElementById('duration');
        const minimizeBtn = document.getElementById('minimizeBtn');

        audioFile.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const url = URL.createObjectURL(file);
                this.audio.src = url;
                this.setupAudioContext();
                playBtn.disabled = false;
                pauseBtn.disabled = false;
                status.textContent = `Loaded: ${file.name}`;
                document.getElementById('instructions').style.display = 'none';
            }
        });

        playBtn.addEventListener('click', async () => {
            try {
                // Resume audio context if suspended
                if (this.audioContext && this.audioContext.state === 'suspended') {
                    await this.audioContext.resume();
                }

                await this.audio.play();
                this.isPlaying = true;
                status.textContent = 'Playing...';
                console.log('Audio started playing');
            } catch (error) {
                console.error('Error playing audio:', error);
                status.textContent = 'Error playing audio';
            }
        });

        pauseBtn.addEventListener('click', () => {
            this.audio.pause();
            this.isPlaying = false;
            status.textContent = 'Paused';
        });

        micBtn.addEventListener('click', () => {
            this.setupMicrophone();
            micBtn.disabled = true;
            stopMicBtn.disabled = false;
        });

        stopMicBtn.addEventListener('click', () => {
            this.stopMicrophone();
            micBtn.disabled = false;
            stopMicBtn.disabled = true;
        });

        visualStyle.addEventListener('change', (e) => {
            this.visualStyle = e.target.value;
        });

        // Update seek bar as audio plays
        this.audio.addEventListener('timeupdate', () => {
            if (!isNaN(this.audio.duration)) {
                seekBar.max = this.audio.duration;
                seekBar.value = this.audio.currentTime;
                currentTimeDisplay.textContent = formatTime(this.audio.currentTime);
                durationDisplay.textContent = formatTime(this.audio.duration);
            }
        });

        // Seek when user interacts with the bar
        seekBar.addEventListener('input', (e) => {
            this.audio.currentTime = parseFloat(e.target.value);
        });

        // Helper to format time as M:SS
        function formatTime(seconds) {
            const m = Math.floor(seconds / 60);
            const s = Math.floor(seconds % 60);
            return `${m}:${s.toString().padStart(2, '0')}`;
        }

        minimizeBtn.addEventListener('click', () => {
            const controls = document.querySelector('.controls');
            if (controls.classList.contains('minimized')) {
                controls.classList.remove('minimized');
                minimizeBtn.textContent = '–';
            } else {
                controls.classList.add('minimized');
                minimizeBtn.textContent = '+';
            }
        });
    }

    setupAudioContext() {
        if (this.audioContext) return;

        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            this.analyser = this.audioContext.createAnalyser();
            this.analyser.fftSize = 512; // Increased for better resolution
            this.analyser.smoothingTimeConstant = 0.8;

            this.source = this.audioContext.createMediaElementSource(this.audio);
            this.source.connect(this.analyser);
            this.analyser.connect(this.audioContext.destination);

            this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);

            console.log('Audio context setup successful');
        } catch (error) {
            console.error('Error setting up audio context:', error);
        }
    }

    async setupMicrophone() {
        try {
            this.microphoneStream = await navigator.mediaDevices.getUserMedia({ audio: true });

            if (!this.audioContext) {
                this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            }

            this.analyser = this.audioContext.createAnalyser();
            this.analyser.fftSize = 256;

            this.source = this.audioContext.createMediaStreamSource(this.microphoneStream);
            this.source.connect(this.analyser);

            this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);
            this.isPlaying = true;

            document.getElementById('status').textContent = 'Microphone active';
            document.getElementById('instructions').style.display = 'none';
        } catch (error) {
            console.error('Error accessing microphone:', error);
            document.getElementById('status').textContent = 'Microphone access denied';
        }
    }

    stopMicrophone() {
        if (this.microphoneStream) {
            const tracks = this.microphoneStream.getTracks();
            tracks.forEach(track => track.stop());
            this.microphoneStream = null;
            this.isPlaying = false;
            document.getElementById('status').textContent = 'Microphone stopped';
        }
    }

    animate() {
        if (this.analyser && this.isPlaying) {
            // Clear canvas with darker background for better visibility
            this.ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

            this.analyser.getByteFrequencyData(this.dataArray);
            // Debug: Check if we're getting audio data
            const sum = this.dataArray.reduce((a, b) => a + b, 0);
            if (sum > 0) {
                console.log('Audio data detected:', sum);
            }

            switch (this.visualStyle) {
                case 'bars':
                    this.drawFrequencyBars();
                    break;
                case 'circle':
                    this.drawCircularSpectrum();
                    break;
                case 'wave':
                    this.drawWaveform();
                    break;
            }
        } else {
            // Clear canvas with solid black for test pattern
            this.ctx.fillStyle = 'rgb(0, 0, 0)';
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
            this.drawTestPattern();
        }

        requestAnimationFrame(() => this.animate());
    }

    drawFrequencyBars() {
        const barWidth = this.canvas.width / this.dataArray.length * 2; // Make bars wider
        const barSpacing = 2;

        for (let i = 0; i < this.dataArray.length; i++) {
            const barHeight = Math.max((this.dataArray[i] / 255) * this.canvas.height * 0.8, 5); // Minimum height

            // Use hue based on index, like the circular spectrum
            const hue = (i / this.dataArray.length) * 360;
            const brightness = 50 + (this.dataArray[i] / 255) * 50; // Brighter colors
            this.ctx.fillStyle = `hsl(${hue}, 100%, ${brightness}%)`;

            const x = i * (barWidth + barSpacing);
            if (x < this.canvas.width) {
                this.ctx.fillRect(
                    x,
                    this.canvas.height - barHeight,
                    barWidth,
                    barHeight
                );
            }
        }
    }

    drawTestPattern() {
        // Rotating and color-changing square on a clean black background
        const time = Date.now() * 0.001;
        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;
        const size = 50;
        const angle = time * 2 * Math.PI; // 1 rotation per second

        this.ctx.save();
        this.ctx.translate(centerX, centerY);
        this.ctx.rotate(angle);
        this.ctx.fillStyle = `hsl(${(time * 50) % 360}, 70%, 50%)`;
        this.ctx.fillRect(-size / 2, -size / 2, size, size);
        this.ctx.restore();
    }

    drawCircularSpectrum() {
        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;
        const radius = 100;
        // Add rotation based on time
        const time = Date.now() * 0.001;
        const rotation = time * 0.7; // Adjust speed as desired

        for (let i = 0; i < this.dataArray.length; i++) {
            // Add rotation to angle
            const angle = i * (Math.PI * 2 / this.dataArray.length) + rotation;
            const barHeight = 15 + ((this.dataArray[i] / 255) * 200);

            const x1 = centerX + Math.cos(angle) * radius;
            const y1 = centerY + Math.sin(angle) * radius;
            const x2 = centerX + Math.cos(angle) * (radius + barHeight);
            const y2 = centerY + Math.sin(angle) * (radius + barHeight);

            const hue = (i / this.dataArray.length) * 360;
            this.ctx.strokeStyle = `hsl(${hue}, 70%, 50%)`;
            this.ctx.lineWidth = 3;

            this.ctx.beginPath();
            this.ctx.moveTo(x1, y1);
            this.ctx.lineTo(x2, y2);
            this.ctx.stroke();
        }
    }

    drawWaveform() {
        this.analyser.getByteTimeDomainData(this.dataArray);

        this.ctx.lineWidth = 2;
        this.ctx.strokeStyle = '#00ff88';
        this.ctx.beginPath();

        const sliceWidth = this.canvas.width / this.dataArray.length;
        let x = 0;

        for (let i = 0; i < this.dataArray.length; i++) {
            const v = this.dataArray[i] / 128.0;
            const y = v * this.canvas.height / 2;

            if (i === 0) {
                this.ctx.moveTo(x, y);
            } else {
                this.ctx.lineTo(x, y);
            }

            x += sliceWidth;
        }

        this.ctx.stroke();
    }
}

// Initialize the visualizer when the page loads
window.addEventListener('DOMContentLoaded', () => {
    new MusicVisualizer();
});
