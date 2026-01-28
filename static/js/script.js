document.addEventListener('DOMContentLoaded', () => {
    // --- WebSocket Setup ---
    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const wsUrl = `${protocol}://${window.location.host}/ws`;
    const statusDiv = document.getElementById('connection-status');
    const reconnectBtn = document.getElementById('reconnect-btn');
    let socket = null;
    let wsConnected = false;
    let robotConnected = false;
    let pendingRobotReconnect = false;

    function renderConnectionStatus(stateText, isConnected, isReconnectEnabled) {
        statusDiv.textContent = stateText;
        statusDiv.classList.remove('connected');
        statusDiv.classList.remove('disconnected');
        statusDiv.classList.add(isConnected ? 'connected' : 'disconnected');
        reconnectBtn.disabled = !isReconnectEnabled;
    }

    function updateStatusDisplay(state) {
        if (state === 'connecting') {
            renderConnectionStatus('Connecting...', false, false);
            return;
        }
        if (!wsConnected) {
            renderConnectionStatus('Disconnected', false, true);
            return;
        }
        if (robotConnected) {
            renderConnectionStatus('Connected', true, false);
            return;
        }
        renderConnectionStatus('Robot Disconnected', false, true);
    }

    function connectSocket() {
        if (socket) {
            if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
                return;
            }
        }

        updateStatusDisplay('connecting');
        socket = new WebSocket(wsUrl);

        socket.onopen = () => {
            wsConnected = true;
            updateStatusDisplay('open');
            if (pendingRobotReconnect) {
                pendingRobotReconnect = false;
                sendAction('reconnect');
            }
        };

        socket.onclose = () => {
            wsConnected = false;
            robotConnected = false;
            updateStatusDisplay('closed');
        };

        socket.onerror = (error) => {
            console.error('WebSocket Error:', error);
        };

        socket.onmessage = (event) => {
            let message = null;
            try {
                message = JSON.parse(event.data);
            } catch (e) {
                return;
            }
            if (message.type === 'status' && message.data) {
                robotConnected = Boolean(message.data.robot_connected);
                updateStatusDisplay('status');
            }
        };
    }

    reconnectBtn.addEventListener('click', () => {
        if (socket && socket.readyState === WebSocket.OPEN) {
            sendAction('reconnect');
            return;
        }
        pendingRobotReconnect = true;
        connectSocket();
    });

    connectSocket();

    // --- Helper to send JSON ---
    function sendAction(type, data) {
        if (socket && socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ type, data }));
        }
    }

    // --- Control Pad Logic ---
    const touchPad = document.getElementById('touch-pad');
    const cursor = document.getElementById('cursor');
    const panVal = document.getElementById('pan-val');
    const tiltVal = document.getElementById('tilt-val');

    let isDragging = false;
    const MAX_PAN = 90;  // degrees
    const MAX_TILT = 30; // degrees

    function updateCursor(clientX, clientY) {
        const rect = touchPad.getBoundingClientRect();
        let x = clientX - rect.left;
        let y = clientY - rect.top;

        // Clamp values
        x = Math.max(0, Math.min(x, rect.width));
        y = Math.max(0, Math.min(y, rect.height));

        // Update visual cursor
        cursor.style.left = `${x}px`;
        cursor.style.top = `${y}px`;

        // Calculate normalized values (-1.0 to 1.0)
        // Center (width/2, height/2) is 0,0
        const normX = (x / rect.width) * 2 - 1;
        const normY = (y / rect.height) * 2 - 1;

        // Invert Y because usually screen Y is down, but pitch up is positive (depends on robot, assume up is negative tilt in screen coords?)
        // Let's assume standard math cartesian: Up (Y-) is positive pitch if we pull up? 
        // Or usually in Joystick: Up -> neg value?
        // Let's map: Up (Low Y pixel) -> Positive Tilt (Look up). 
        // Wait, standard UI:
        // Top-Left (0,0).
        // Let's map Center to (0,0) degrees.
        // Y: 0 (Top) -> +30 deg. Height (Bottom) -> -30 deg.
        // So: normY is -1 (Top) to +1 (Bottom).
        // Target Pitch: -normY * MAX_TILT.
        
        // Pan: normX is -1 (Left) to +1 (Right).
        // Target Yaw: -normX * MAX_PAN (If robot assumes Left is positive? Standard is Left=Positive/CCW)
        // Let's assume Left is Positive for Pan.
        const pan = -normX * MAX_PAN;
        const tilt = -normY * MAX_TILT;

        panVal.textContent = pan.toFixed(1);
        tiltVal.textContent = tilt.toFixed(1);

        // Throttle? For now send every move.
        sendAction('move', { pan: pan, tilt: tilt });
    }

    touchPad.addEventListener('mousedown', (e) => {
        isDragging = true;
        updateCursor(e.clientX, e.clientY);
    });

    window.addEventListener('mousemove', (e) => {
        if (isDragging) {
            updateCursor(e.clientX, e.clientY);
        }
    });

    window.addEventListener('mouseup', () => {
        if (isDragging) {
            isDragging = false;
            // Optional: Snap back to center? Or stay? keep position for now.
        }
    });
    
    // Touch support
    touchPad.addEventListener('touchstart', (e) => {
        isDragging = true;
        updateCursor(e.touches[0].clientX, e.touches[0].clientY);
        e.preventDefault(); 
    }, {passive: false});

    touchPad.addEventListener('touchmove', (e) => {
        if (isDragging) {
            updateCursor(e.touches[0].clientX, e.touches[0].clientY);
            e.preventDefault(); 
        }
    }, {passive: false});

    touchPad.addEventListener('touchend', () => {
        isDragging = false;
    });


    // --- Expression Logic ---
    const exprBtns = document.querySelectorAll('.expr-btn');
    exprBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const expr = btn.dataset.expr;
            sendAction('face', { val: expr });
        });
    });

    // --- Speech Logic ---
    const speechInput = document.getElementById('speech-input');
    const sendSpeechBtn = document.getElementById('send-speech-btn');

    function sendSpeech() {
        const text = speechInput.value.trim();
        if (text) {
            sendAction('say', { val: text });
            speechInput.value = '';
        }
    }

    sendSpeechBtn.addEventListener('click', sendSpeech);
    speechInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            sendSpeech();
        }
    });
});
