/*
 * CONTENTS
 * ========
 * GridStack Initialization
 * Widget Management
 * Individual Widget Creation Functions
 * Widget Factory Functions
 * Advanced Widgets
 * Real-time Updates
 * Interactive Features
 * Widget Utilities
 *
 * FUNCTION INDEX
 * =============
 *
 * INITIALIZATION FUNCTIONS (1)
 * ----------------------------
 * initializeGridStack()           - GridStack 라이브러리 초기화 및 설정
 *
 * INDIVIDUAL WIDGET CREATION FUNCTIONS (9)
 * ----------------------------------------
 * createCPUWidget()              - CPU 사용률 위젯 생성
 * createMemoryWidget()           - 메모리 사용률 위젯 생성
 * createNetworkWidget()          - 네트워크 활동 위젯 생성
 * createSystemInfoWidget()       - 시스템 정보 위젯 생성
 * createQuickActionsWidget()     - 빠른 실행 버튼 위젯 생성
 * createCodeStatsWidget()        - 코드 통계 위젯 생성
 * createWeatherWidget()          - 날씨 정보 위젯 생성
 * createClockWidget()            - 실시간 시계 위젯 생성
 * createProgressWidget()         - 프로젝트 진행률 위젯 생성
 *
 * WIDGET FACTORY FUNCTIONS (3)
 * ----------------------------
 * addSampleWidgets(grid)         - 기본 위젯들 생성 (CPU, Memory, Network, System Info, Quick Actions)
 * addAdvancedWidgets(grid)       - 고급 위젯들 생성 (Code Stats, Weather, Clock, Progress)
 * createCustomWidget(type, data) - 커스텀 위젯 생성 메인 함수
 *
 * REAL-TIME UPDATE FUNCTIONS (7)
 * ------------------------------
 * startRealTimeUpdates()          - 모든 실시간 업데이트 타이머 설정
 * updateClock()                   - 시계 위젯 업데이트 (1초마다)
 * updateCPUUsage()                - CPU 사용률 업데이트 (2초마다)
 * updateMemoryUsage()             - 메모리 사용률 업데이트 (3초마다)
 * updateNetworkStats()            - 네트워크 통계 업데이트 (4초마다)
 * updateWeather()                 - 날씨 정보 업데이트 (5분마다)
 * updateProgress()                - 진행률 업데이트 (10초마다)
 *
 * INTERACTIVE FEATURE FUNCTIONS (5)
 * ---------------------------------
 * toggleWidgetUpdate(widgetType)  - 위젯 업데이트 일시정지/재개
 * removeWidget(button)            - 위젯 제거
 * refreshSystemInfo()             - 시스템 정보 새로고침
 * refreshCodeStats()              - 코드 통계 새로고침
 * refreshWeather()                - 날씨 정보 새로고침
 *
 * ACTION FUNCTIONS (4)
 * -------------------
 * runCode()                       - 코드 실행 버튼 시뮬레이션
 * saveFile()                      - 파일 저장 기능
 * clearOutput()                   - 출력 지우기 기능
 * openFile()                      - 파일 열기 기능
 *
 * DYNAMIC WIDGET CREATION FUNCTIONS (5)
 * -------------------------------------
 * addChartWidget(grid, data)      - 차트 위젯 생성
 * addLogWidget(grid, data)        - 로그 위젯 생성
 * addMetricWidget(grid, data)     - 메트릭 위젯 생성
 * clearLog(button)                - 로그 내용 지우기
 *
 * TOTAL: 33 FUNCTIONS
 *
 * WIDGET TYPES
 * ============
 *
 * BASIC WIDGETS (5)
 * ----------------
 * 1. CPU Usage Widget     - 게이지 형태의 CPU 사용률 표시
 * 2. Memory Widget        - 프로그레스 바 형태의 메모리 사용률
 * 3. Network Widget       - 네트워크 활동 모니터링
 * 4. System Info Widget   - 시스템 정보 표시
 * 5. Quick Actions Widget - 빠른 실행 버튼들
 *
 * ADVANCED WIDGETS (4)
 * --------------------
 * 6. Code Statistics Widget - 코드 통계 정보
 * 7. Weather Widget        - 날씨 정보 표시
 * 8. Clock Widget          - 실시간 시계
 * 9. Progress Widget       - 프로젝트 진행률
 *
 * DYNAMIC WIDGETS (3)
 * -------------------
 * 10. Chart Widget         - 차트 위젯 (동적 생성)
 * 11. Log Widget          - 로그 위젯 (동적 생성)
 * 12. Metric Widget       - 메트릭 위젯 (동적 생성)
 *
 * UPDATE INTERVALS
 * ===============
 * - Clock: 1초마다
 * - CPU: 2초마다
 * - Memory: 3초마다
 * - Network: 4초마다
 * - Weather: 5분마다
 * - Progress: 10초마다
 */

// Initialize GridStack
function initializeGridStack() {
    try {
        if (typeof GridStack === 'undefined') {
            console.error('GridStack is not loaded');
            return null;
        }

    const grid = GridStack.init({
        float: true,
        cellHeight: 100,
        margin: '10px',
        disableOneColumnMode: true,
        animate: true,
        resizable: {
            handles: 'all'
        }
    });
    
    // Store grid instance globally
    window.gridStack = grid;
    
        console.log('GridStack initialized successfully');
    return grid;
    } catch (error) {
        console.error('Error initializing GridStack:', error);
        return null;
    }
}

// Individual Widget Creation Functions

function createCPUWidget() {
    const cpuWidget = document.createElement('div');
    cpuWidget.className = 'grid-stack-item';
    cpuWidget.setAttribute('gs-x', '0');
    cpuWidget.setAttribute('gs-y', '0');
    cpuWidget.setAttribute('gs-w', '6');
    cpuWidget.setAttribute('gs-h', '4');
    cpuWidget.innerHTML = `
            <div class="widget-content">
                <div class="widget-header">
                    <h4><i class="fas fa-microchip"></i> CPU Usage</h4>
                    <div class="widget-controls">
                        <button class="btn-icon" onclick="toggleWidgetUpdate('cpu')"><i class="fas fa-pause"></i></button>
                        <button class="btn-icon" onclick="removeWidget(this)"><i class="fas fa-times"></i></button>
                    </div>
                </div>
                <div class="widget-body">
                    <div class="gauge-widget">
                    <div class="gauge" id="cpu-gauge" style="--percentage: 75deg">
                            <div class="gauge-value" id="cpu-value">75%</div>
                            <div class="gauge-label">CPU Usage</div>
                        </div>
                        <div class="gauge-details">
                            <div class="detail-item">
                                <span class="detail-label">Cores:</span>
                                <span class="detail-value">8</span>
                            </div>
                            <div class="detail-item">
                                <span class="detail-label">Temp:</span>
                                <span class="detail-value">45°C</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
    `;
    return cpuWidget;
}

function createMemoryWidget() {
    const memoryWidget = document.createElement('div');
    memoryWidget.className = 'grid-stack-item';
    memoryWidget.setAttribute('gs-x', '6');
    memoryWidget.setAttribute('gs-y', '0');
    memoryWidget.setAttribute('gs-w', '6');
    memoryWidget.setAttribute('gs-h', '4');
    memoryWidget.innerHTML = `
            <div class="widget-content">
                <div class="widget-header">
                    <h4><i class="fas fa-memory"></i> Memory</h4>
                    <div class="widget-controls">
                        <button class="btn-icon" onclick="toggleWidgetUpdate('memory')"><i class="fas fa-pause"></i></button>
                        <button class="btn-icon" onclick="removeWidget(this)"><i class="fas fa-times"></i></button>
                    </div>
                </div>
                <div class="widget-body">
                    <div class="memory-widget">
                        <div class="memory-bar">
                            <div class="memory-used" style="width: 65%"></div>
                        </div>
                        <div class="memory-stats">
                            <div class="stat-item">
                                <span class="stat-label">Used:</span>
                                <span class="stat-value">10.4 GB</span>
                            </div>
                            <div class="stat-item">
                                <span class="stat-label">Total:</span>
                                <span class="stat-value">16 GB</span>
                            </div>
                            <div class="stat-item">
                                <span class="stat-label">Free:</span>
                                <span class="stat-value">5.6 GB</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
    `;
    return memoryWidget;
}

function createNetworkWidget() {
    const networkWidget = document.createElement('div');
    networkWidget.className = 'grid-stack-item';
    networkWidget.setAttribute('gs-x', '0');
    networkWidget.setAttribute('gs-y', '4');
    networkWidget.setAttribute('gs-w', '6');
    networkWidget.setAttribute('gs-h', '3');
    networkWidget.innerHTML = `
            <div class="widget-content">
                <div class="widget-header">
                    <h4><i class="fas fa-network-wired"></i> Network</h4>
                    <div class="widget-controls">
                        <button class="btn-icon" onclick="toggleWidgetUpdate('network')"><i class="fas fa-pause"></i></button>
                        <button class="btn-icon" onclick="removeWidget(this)"><i class="fas fa-times"></i></button>
                    </div>
                </div>
                <div class="widget-body">
                    <div class="network-widget">
                        <div class="network-item">
                            <i class="fas fa-download"></i>
                            <span class="network-label">Download:</span>
                            <span class="network-value">2.4 MB/s</span>
                        </div>
                        <div class="network-item">
                            <i class="fas fa-upload"></i>
                            <span class="network-label">Upload:</span>
                            <span class="network-value">1.2 MB/s</span>
                        </div>
                        <div class="network-item">
                            <i class="fas fa-wifi"></i>
                            <span class="network-label">Latency:</span>
                            <span class="network-value">12ms</span>
                        </div>
                    </div>
                </div>
            </div>
    `;
    return networkWidget;
}

function createSystemInfoWidget() {
    const systemWidget = document.createElement('div');
    systemWidget.className = 'grid-stack-item';
    systemWidget.setAttribute('gs-x', '6');
    systemWidget.setAttribute('gs-y', '4');
    systemWidget.setAttribute('gs-w', '6');
    systemWidget.setAttribute('gs-h', '3');
    systemWidget.innerHTML = `
            <div class="widget-content">
                <div class="widget-header">
                    <h4><i class="fas fa-info-circle"></i> System Info</h4>
                    <div class="widget-controls">
                        <button class="btn-icon" onclick="refreshSystemInfo()"><i class="fas fa-sync"></i></button>
                        <button class="btn-icon" onclick="removeWidget(this)"><i class="fas fa-times"></i></button>
                    </div>
                </div>
                <div class="widget-body">
                    <div class="system-info-widget">
                        <div class="info-item">
                            <span class="info-label">OS:</span>
                            <span class="info-value">Windows 11</span>
                        </div>
                        <div class="info-item">
                            <span class="info-label">Uptime:</span>
                            <span class="info-value">2d 14h 32m</span>
                        </div>
                        <div class="info-item">
                            <span class="info-label">Processes:</span>
                            <span class="info-value">156</span>
                        </div>
                    </div>
                </div>
            </div>
    `;
    return systemWidget;
}

function createQuickActionsWidget() {
    const actionsWidget = document.createElement('div');
    actionsWidget.className = 'grid-stack-item';
    actionsWidget.setAttribute('gs-x', '0');
    actionsWidget.setAttribute('gs-y', '7');
    actionsWidget.setAttribute('gs-w', '12');
    actionsWidget.setAttribute('gs-h', '2');
    actionsWidget.innerHTML = `
            <div class="widget-content">
                <div class="widget-header">
                    <h4><i class="fas fa-bolt"></i> Quick Actions</h4>
                    <div class="widget-controls">
                        <button class="btn-icon" onclick="removeWidget(this)"><i class="fas fa-times"></i></button>
                    </div>
                </div>
                <div class="widget-body">
                    <div class="quick-actions-widget">
                        <button class="action-btn" onclick="runCode()">
                            <i class="fas fa-play"></i>
                            <span>Run Code</span>
                        </button>
                        <button class="action-btn" onclick="saveFile()">
                            <i class="fas fa-save"></i>
                            <span>Save File</span>
                        </button>
                        <button class="action-btn" onclick="clearOutput()">
                            <i class="fas fa-trash"></i>
                            <span>Clear Output</span>
                        </button>
                        <button class="action-btn" onclick="openFile()">
                            <i class="fas fa-folder-open"></i>
                            <span>Open File</span>
                        </button>
                    </div>
                </div>
            </div>
    `;
    return actionsWidget;
}

function createCodeStatsWidget() {
    const codeStatsWidget = document.createElement('div');
    codeStatsWidget.className = 'grid-stack-item';
    codeStatsWidget.setAttribute('gs-x', '0');
    codeStatsWidget.setAttribute('gs-y', '9');
    codeStatsWidget.setAttribute('gs-w', '6');
    codeStatsWidget.setAttribute('gs-h', '4');
    codeStatsWidget.innerHTML = `
        <div class="widget-content">
            <div class="widget-header">
                <h4><i class="fas fa-code"></i> Code Statistics</h4>
                <div class="widget-controls">
                    <button class="btn-icon" onclick="refreshCodeStats()"><i class="fas fa-sync"></i></button>
                    <button class="btn-icon" onclick="removeWidget(this)"><i class="fas fa-times"></i></button>
                </div>
            </div>
            <div class="widget-body">
                <div class="code-stats-widget">
                    <div class="stat-card">
                        <div class="stat-icon">
                            <i class="fas fa-file-code"></i>
                        </div>
                        <div class="stat-info">
                            <div class="stat-title">Lines of Code</div>
                            <div class="stat-number" id="loc-count">1,247</div>
                        </div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-icon">
                            <i class="fas fa-bug"></i>
                        </div>
                        <div class="stat-info">
                            <div class="stat-title">Issues</div>
                            <div class="stat-number" id="issues-count">3</div>
                        </div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-icon">
                            <i class="fas fa-check-circle"></i>
                        </div>
                        <div class="stat-info">
                            <div class="stat-title">Coverage</div>
                            <div class="stat-number" id="coverage-count">87%</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
    return codeStatsWidget;
}

function createWeatherWidget() {
    const weatherWidget = document.createElement('div');
    weatherWidget.className = 'grid-stack-item';
    weatherWidget.setAttribute('gs-x', '6');
    weatherWidget.setAttribute('gs-y', '9');
    weatherWidget.setAttribute('gs-w', '6');
    weatherWidget.setAttribute('gs-h', '4');
    weatherWidget.innerHTML = `
        <div class="widget-content">
            <div class="widget-header">
                <h4><i class="fas fa-cloud-sun"></i> Weather</h4>
                <div class="widget-controls">
                    <button class="btn-icon" onclick="refreshWeather()"><i class="fas fa-sync"></i></button>
                    <button class="btn-icon" onclick="removeWidget(this)"><i class="fas fa-times"></i></button>
                </div>
            </div>
            <div class="widget-body">
                <div class="weather-widget">
                    <div class="weather-icon" id="weather-icon">
                        <i class="fas fa-sun"></i>
                    </div>
                    <div class="weather-temp" id="weather-temp">22°C</div>
                    <div class="weather-desc" id="weather-desc">Partly Cloudy</div>
                    <div class="weather-details">
                        <div class="weather-detail">
                            <div class="weather-detail-label">Humidity</div>
                            <div class="weather-detail-value">65%</div>
                        </div>
                        <div class="weather-detail">
                            <div class="weather-detail-label">Wind</div>
                            <div class="weather-detail-value">12 km/h</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
    return weatherWidget;
}

function createClockWidget() {
    const clockWidget = document.createElement('div');
    clockWidget.className = 'grid-stack-item';
    clockWidget.setAttribute('gs-x', '0');
    clockWidget.setAttribute('gs-y', '13');
    clockWidget.setAttribute('gs-w', '4');
    clockWidget.setAttribute('gs-h', '3');
    clockWidget.innerHTML = `
        <div class="widget-content">
            <div class="widget-header">
                <h4><i class="fas fa-clock"></i> Clock</h4>
                <div class="widget-controls">
                    <button class="btn-icon" onclick="removeWidget(this)"><i class="fas fa-times"></i></button>
                </div>
            </div>
            <div class="widget-body">
                <div class="clock-widget">
                    <div class="clock-time" id="clock-time">12:34:56</div>
                    <div class="clock-date" id="clock-date">Monday, January 15</div>
                    <div class="clock-timezone">UTC+9</div>
                </div>
            </div>
        </div>
    `;
    return clockWidget;
}

function createProgressWidget() {
    const progressWidget = document.createElement('div');
    progressWidget.className = 'grid-stack-item';
    progressWidget.setAttribute('gs-x', '4');
    progressWidget.setAttribute('gs-y', '13');
    progressWidget.setAttribute('gs-w', '8');
    progressWidget.setAttribute('gs-h', '3');
    progressWidget.innerHTML = `
        <div class="widget-content">
            <div class="widget-header">
                <h4><i class="fas fa-tasks"></i> Project Progress</h4>
                <div class="widget-controls">
                    <button class="btn-icon" onclick="removeWidget(this)"><i class="fas fa-times"></i></button>
                </div>
            </div>
            <div class="widget-body">
                <div class="progress-widget">
                    <div class="progress-header">
                        <div class="progress-title">Development Progress</div>
                        <div class="progress-percentage" id="progress-percentage">75%</div>
                    </div>
                    <div class="progress-bar">
                        <div class="progress-fill" id="progress-fill" style="width: 75%"></div>
                    </div>
                    <div class="progress-stats">
                        <span>Completed: 15/20 tasks</span>
                        <span>Remaining: 5 tasks</span>
                    </div>
                </div>
            </div>
        </div>
    `;
    return progressWidget;
}

// Widget Factory Functions

function addSampleWidgets(grid) {
    try {
        if (!grid) {
            console.error('Grid instance is null');
            return;
        }

        console.log('Adding sample widgets...');

        // Add individual widgets
        grid.addWidget(createCPUWidget());
        console.log('CPU widget added');

        grid.addWidget(createMemoryWidget());
        console.log('Memory widget added');

        grid.addWidget(createNetworkWidget());
        console.log('Network widget added');

        grid.addWidget(createSystemInfoWidget());
        console.log('System Info widget added');

        grid.addWidget(createQuickActionsWidget());
        console.log('Quick Actions widget added');

        // Add default camera image widget
        //grid.addWidget(createImageWidget());
        //console.log('Camera Image widget added');

        console.log('All sample widgets added successfully');

    } catch (error) {
        console.error('Error adding sample widgets:', error);
    }
}

function addAdvancedWidgets(grid) {
    try {
        if (!grid) {
            console.error('Grid instance is null');
            return;
        }

        console.log('Adding advanced widgets...');

        // Add individual advanced widgets
        grid.addWidget(createCodeStatsWidget());
        console.log('Code Stats widget added');

        grid.addWidget(createWeatherWidget());
        console.log('Weather widget added');

        grid.addWidget(createClockWidget());
        console.log('Clock widget added');

        grid.addWidget(createProgressWidget());
        console.log('Progress widget added');

        // Start real-time updates
        startRealTimeUpdates();

        console.log('All advanced widgets added successfully');

    } catch (error) {
        console.error('Error adding advanced widgets:', error);
    }
}

// Real-time update functions
function startRealTimeUpdates() {
    // Update clock every second
    setInterval(updateClock, 1000);

    // Update CPU usage every 2 seconds
    setInterval(updateCPUUsage, 2000);

    // Update memory usage every 3 seconds
    setInterval(updateMemoryUsage, 3000);

    // Update network stats every 4 seconds
    setInterval(updateNetworkStats, 4000);

    // Update weather every 5 minutes
    setInterval(updateWeather, 300000);

    // Update progress every 10 seconds
    setInterval(updateProgress, 10000);
}

function updateClock() {
    const now = new Date();
    const timeElement = document.getElementById('clock-time');
    const dateElement = document.getElementById('clock-date');

    if (timeElement) {
        timeElement.textContent = now.toLocaleTimeString();
    }

    if (dateElement) {
        dateElement.textContent = now.toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    }
}

function updateCPUUsage() {
    const cpuValue = document.getElementById('cpu-value');
    const cpuGauge = document.getElementById('cpu-gauge');

    if (cpuValue && cpuGauge) {
        const newValue = Math.floor(Math.random() * 30) + 40; // 40-70%
        cpuValue.textContent = `${newValue}%`;
        cpuGauge.style.setProperty('--percentage', `${newValue * 3.6}deg`);
    }
}

function updateMemoryUsage() {
    const memoryUsed = document.querySelector('.memory-used');
    const usedValue = document.querySelector('.memory-stats .stat-value');

    if (memoryUsed && usedValue) {
        const newUsage = Math.floor(Math.random() * 20) + 55; // 55-75%
        memoryUsed.style.width = `${newUsage}%`;

        const usedGB = (newUsage * 16 / 100).toFixed(1);
        usedValue.textContent = `${usedGB} GB`;
    }
}

function updateNetworkStats() {
    const downloadValue = document.querySelector('.network-item:nth-child(1) .network-value');
    const uploadValue = document.querySelector('.network-item:nth-child(2) .network-value');
    const latencyValue = document.querySelector('.network-item:nth-child(3) .network-value');

    if (downloadValue && uploadValue && latencyValue) {
        const download = (Math.random() * 5 + 1).toFixed(1);
        const upload = (Math.random() * 3 + 0.5).toFixed(1);
        const latency = Math.floor(Math.random() * 20) + 8;

        downloadValue.textContent = `${download} MB/s`;
        uploadValue.textContent = `${upload} MB/s`;
        latencyValue.textContent = `${latency}ms`;
    }
}

function updateWeather() {
    const weatherIcons = [
        'fas fa-sun',
        'fas fa-cloud-sun',
        'fas fa-cloud',
        'fas fa-cloud-rain',
        'fas fa-snowflake'
    ];

    const weatherIcon = document.getElementById('weather-icon');
    const weatherTemp = document.getElementById('weather-temp');
    const weatherDesc = document.getElementById('weather-desc');

    if (weatherIcon && weatherTemp && weatherDesc) {
        const temp = Math.floor(Math.random() * 20) + 15; // 15-35°C
        const iconIndex = Math.floor(Math.random() * weatherIcons.length);
        const descriptions = ['Sunny', 'Partly Cloudy', 'Cloudy', 'Light Rain', 'Snow'];

        weatherIcon.innerHTML = `<i class="${weatherIcons[iconIndex]}"></i>`;
        weatherTemp.textContent = `${temp}°C`;
        weatherDesc.textContent = descriptions[iconIndex];
    }
}

function updateProgress() {
    const progressFill = document.getElementById('progress-fill');
    const progressPercentage = document.getElementById('progress-percentage');

    if (progressFill && progressPercentage) {
        const currentProgress = parseInt(progressFill.style.width) || 75;
        const newProgress = Math.min(currentProgress + Math.floor(Math.random() * 5), 100);

        progressFill.style.width = `${newProgress}%`;
        progressPercentage.textContent = `${newProgress}%`;
    }
}

// Widget utility functions
function toggleWidgetUpdate(widgetType) {
    const button = event.target.closest('.btn-icon');
    const icon = button.querySelector('i');
    
    if (icon.classList.contains('fa-pause')) {
        icon.classList.remove('fa-pause');
        icon.classList.add('fa-play');
        console.log(`${widgetType} widget updates paused`);
    } else {
        icon.classList.remove('fa-play');
        icon.classList.add('fa-pause');
        console.log(`${widgetType} widget updates resumed`);
    }
}

function removeWidget(button) {
    const widget = button.closest('.widget-content').parentElement;
    if (widget && widget.gridstackNode) {
        window.gridStack.removeWidget(widget);
    }
}

function refreshSystemInfo() {
    const systemInfo = document.querySelector('.system-info-widget');
    if (systemInfo) {
        const uptimeElement = systemInfo.querySelector('.info-value');
        if (uptimeElement && uptimeElement.previousElementSibling.textContent.includes('Uptime')) {
            // Simulate uptime update
            const currentTime = new Date();
            uptimeElement.textContent = `${currentTime.getHours()}h ${currentTime.getMinutes()}m`;
        }
    }
}

function refreshCodeStats() {
    const locCount = document.getElementById('loc-count');
    const issuesCount = document.getElementById('issues-count');
    const coverageCount = document.getElementById('coverage-count');

    if (locCount && issuesCount && coverageCount) {
        const newLoc = Math.floor(Math.random() * 500) + 1000;
        const newIssues = Math.floor(Math.random() * 5) + 1;
        const newCoverage = Math.floor(Math.random() * 20) + 80;

        locCount.textContent = newLoc.toLocaleString();
        issuesCount.textContent = newIssues;
        coverageCount.textContent = `${newCoverage}%`;
    }
}

function refreshWeather() {
    updateWeather();
}

function runCode() {
    const runBtn = document.getElementById('runBtn');
    if (runBtn) {
        runBtn.click();
    }
}

function saveFile() {
    console.log('Save file action triggered');
    // Add save functionality here
}

function clearOutput() {
    const clearBtn = document.getElementById('clearOutputBtn');
    if (clearBtn) {
        clearBtn.click();
    }
}

function openFile() {
    console.log('Open file action triggered');
    // Add open file functionality here
}

// Add widget creation functions
function createCustomWidget(type, data) {
    const grid = window.gridStack;
    if (!grid) return;

    switch (type) {
        case 'chart':
            addChartWidget(grid, data);
            break;
        case 'log':
            addLogWidget(grid, data);
            break;
        case 'metric':
            addMetricWidget(grid, data);
            break;
        default:
            console.log('Unknown widget type:', type);
    }
}

function addChartWidget(grid, data) {
    const chartWidget = document.createElement('div');
    chartWidget.className = 'grid-stack-item';
    chartWidget.setAttribute('gs-x', '0');
    chartWidget.setAttribute('gs-y', '0');
    chartWidget.setAttribute('gs-w', '6');
    chartWidget.setAttribute('gs-h', '4');
    chartWidget.innerHTML = `
        <div class="widget-content">
            <div class="widget-header">
                <h4><i class="fas fa-chart-line"></i> ${data.title || 'Chart'}</h4>
                <div class="widget-controls">
                    <button class="btn-icon" onclick="removeWidget(this)"><i class="fas fa-times"></i></button>
                </div>
            </div>
            <div class="widget-body">
                <canvas id="chart-${Date.now()}" width="400" height="200"></canvas>
            </div>
        </div>
    `;
    grid.addWidget(chartWidget);
}

function addLogWidget(grid, data) {
    const logWidget = document.createElement('div');
    logWidget.className = 'grid-stack-item';
    logWidget.setAttribute('gs-x', '0');
    logWidget.setAttribute('gs-y', '0');
    logWidget.setAttribute('gs-w', '6');
    logWidget.setAttribute('gs-h', '4');
    logWidget.innerHTML = `
        <div class="widget-content">
            <div class="widget-header">
                <h4><i class="fas fa-list"></i> ${data.title || 'Log'}</h4>
                <div class="widget-controls">
                    <button class="btn-icon" onclick="clearLog(this)"><i class="fas fa-trash"></i></button>
                    <button class="btn-icon" onclick="removeWidget(this)"><i class="fas fa-times"></i></button>
                </div>
            </div>
            <div class="widget-body">
                <div class="log-content" style="height: 100%; overflow-y: auto; padding: 12px; background: rgba(0,0,0,0.2); border-radius: 4px;">
                    <div class="log-entry">System initialized</div>
                    <div class="log-entry">Widget loaded successfully</div>
                    <div class="log-entry">Real-time updates enabled</div>
                </div>
            </div>
        </div>
    `;
    grid.addWidget(logWidget);
}

function addMetricWidget(grid, data) {
    const metricWidget = document.createElement('div');
    metricWidget.className = 'grid-stack-item';
    metricWidget.setAttribute('gs-x', '0');
    metricWidget.setAttribute('gs-y', '0');
    metricWidget.setAttribute('gs-w', '4');
    metricWidget.setAttribute('gs-h', '3');
    metricWidget.innerHTML = `
        <div class="widget-content">
            <div class="widget-header">
                <h4><i class="fas fa-chart-bar"></i> ${data.title || 'Metric'}</h4>
                <div class="widget-controls">
                    <button class="btn-icon" onclick="removeWidget(this)"><i class="fas fa-times"></i></button>
                </div>
            </div>
            <div class="widget-body">
                <div style="text-align: center;">
                    <div style="font-size: 32px; font-weight: 700; color: #4ade80; margin-bottom: 8px;">
                        ${data.value || '0'}
                    </div>
                    <div style="font-size: 14px; color: rgba(255, 255, 255, 0.7);">
                        ${data.label || 'Metric'}
                    </div>
                </div>
            </div>
        </div>
    `;
    grid.addWidget(metricWidget);
}

function clearLog(button) {
    const logContent = button.closest('.widget-content').querySelector('.log-content');
    if (logContent) {
        logContent.innerHTML = '<div class="log-entry">Log cleared</div>';
    }
}

// 전역 변수로 이미지 위젯 카운터 추가
let imageWidgetCounter = 1;

// Socket.IO 이미지 수신 함수
function handleImageUpdate(widgetName, imageData) {
    console.log(`Received image update for widget: ${widgetName}`);
    
    const imageElement = document.getElementById(`display-image-${widgetName.toLowerCase()}`);
    const placeholder = document.getElementById(`image-placeholder-${widgetName.toLowerCase()}`);
    
    if (!imageElement || !placeholder) {
        console.error(`Image widget elements not found for: ${widgetName}`);
        return;
    }
    
    try {
        // 바이너리 데이터를 Blob으로 변환
        const blob = new Blob([imageData], { type: 'image/jpeg' });
        const imageUrl = URL.createObjectURL(blob);
        
        // 이미지 로드 완료 후 처리
        imageElement.onload = function() {
            imageElement.style.display = 'block';
            placeholder.style.display = 'none';
            
            // 메모리 정리
            setTimeout(() => {
                URL.revokeObjectURL(imageUrl);
            }, 1000);
        };
        
        imageElement.onerror = function() {
            console.error(`Failed to load image for widget: ${widgetName}`);
            imageElement.style.display = 'none';
            placeholder.style.display = 'block';
        };
        
        imageElement.src = imageUrl;
        
    } catch (error) {
        console.error(`Error processing image for widget ${widgetName}:`, error);
        imageElement.style.display = 'none';
        placeholder.style.display = 'block';
    }
}

// 카메라 피드 업데이트 함수
function handleCameraFeedUpdate(widgetName, imageData) {
    console.log(`Received camera feed update for widget: ${widgetName}`);
    
    const imageElement = document.getElementById(`display-image-${widgetName.toLowerCase()}`);
    const placeholder = document.getElementById(`image-placeholder-${widgetName.toLowerCase()}`);
    
    if (!imageElement || !placeholder) {
        console.error(`Camera widget elements not found for: ${widgetName}`);
        return;
    }
    
    try {
        // base64 이미지 데이터를 직접 설정
        imageElement.onload = function() {
            imageElement.style.display = 'block';
            placeholder.style.display = 'none';
        };
        
        imageElement.onerror = function() {
            console.error(`Failed to load camera feed for widget: ${widgetName}`);
            imageElement.style.display = 'none';
            placeholder.style.display = 'block';
        };
        
        // base64 데이터를 직접 src에 설정
        imageElement.src = imageData;
        
    } catch (error) {
        console.error(`Error processing camera feed for widget ${widgetName}:`, error);
        imageElement.style.display = 'none';
        placeholder.style.display = 'block';
    }
}

function createImageWidget() {
    const widgetName = `Image_Display_${imageWidgetCounter}`;
    imageWidgetCounter++;
    
    const imageWidget = document.createElement('div');
    imageWidget.className = 'grid-stack-item';
    imageWidget.setAttribute('gs-x', '0');
    imageWidget.setAttribute('gs-y', '0');
    imageWidget.setAttribute('gs-w', '6');
    imageWidget.setAttribute('gs-h', '4');
    imageWidget.innerHTML = `
        <div class="widget-content">
            <div class="widget-header">
                <h4>
                    <i class="fas fa-image"></i> 
                    <span class="widget-title" contenteditable="true" data-widget-name="${widgetName}">${widgetName}</span>
                </h4>
                <div class="widget-controls">
                    <button class="btn-icon" onclick="refreshImage(this)"><i class="fas fa-sync"></i></button>
                    <button class="btn-icon" onclick="removeWidget(this)"><i class="fas fa-times"></i></button>
                </div>
            </div>
            <div class="widget-body">
                <div class="image-widget">
                    <div class="image-container" id="image-container-${widgetName.toLowerCase()}">
                        <img id="display-image-${widgetName.toLowerCase()}" src="" alt="No image loaded" style="max-width: 100%; max-height: 100%; object-fit: contain; border-radius: 8px;">
                        <div class="image-placeholder" id="image-placeholder-${widgetName.toLowerCase()}">
                            <i class="fas fa-image" style="font-size: 48px; color: rgba(255, 255, 255, 0.3);"></i>
                            <p style="color: rgba(255, 255, 255, 0.5); margin-top: 8px;">No image loaded</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // 제목 편집 이벤트 리스너 추가
    setTimeout(() => {
        const titleElement = imageWidget.querySelector('.widget-title');
        if (titleElement) {
            titleElement.addEventListener('blur', function() {
                const newName = this.textContent.trim();
                console.log(`Widget name changed to: ${newName}`);
            });
            
            titleElement.addEventListener('keydown', function(e) {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    this.blur();
                }
            });
        }
    }, 100);
    
    return imageWidget;
}

function refreshImage(button) {
    const widgetContent = button.closest('.widget-content');
    const titleElement = widgetContent.querySelector('.widget-title');
    const widgetName = titleElement ? titleElement.textContent.trim() : 'Image_Display_1';
    
    const imageContainer = document.getElementById(`image-container-${widgetName.toLowerCase()}`);
    const imageElement = document.getElementById(`display-image-${widgetName.toLowerCase()}`);
    const placeholder = document.getElementById(`image-placeholder-${widgetName.toLowerCase()}`);
    
    if (!imageElement || !placeholder) {
        console.error('Image widget elements not found');
        return;
    }
    
    // 위젯 이름을 URL 파라미터로 전달
    const apiUrl = `/api/get-image?widget=${encodeURIComponent(widgetName)}`;
    
    // Flask에서 이미지를 가져오는 API 호출
    fetch(apiUrl)
        .then(response => {
            if (!response.ok) {
                throw new Error('Failed to fetch image');
            }
            return response.blob();
        })
        .then(blob => {
            const imageUrl = URL.createObjectURL(blob);
            
            // 이미지 로드 완료 후 처리
            imageElement.onload = function() {
                imageElement.style.display = 'block';
                placeholder.style.display = 'none';
                
                // 메모리 정리
                setTimeout(() => {
                    URL.revokeObjectURL(imageUrl);
                }, 1000);
            };
            
            imageElement.onerror = function() {
                imageElement.style.display = 'none';
                placeholder.style.display = 'block';
            };
            
            imageElement.src = imageUrl;
        })
        .catch(error => {
            console.error('Error fetching image:', error);
            imageElement.style.display = 'none';
            placeholder.style.display = 'block';
        });
}

// Widget Utility Functions for Individual Addition

/*
 * 사용 예시:
 *
 * // 개별 위젯 추가
 * addWidgetByName('cpu');           // CPU 위젯 추가
 * addWidgetByName('memory');        // 메모리 위젯 추가
 * addWidgetByName('weather');       // 날씨 위젯 추가
 *
 * // 여러 위젯 한번에 추가
 * addMultipleWidgets(['cpu', 'memory', 'clock']);
 *
 * // 위젯 제거
 * removeWidgetByName('cpu');        // CPU 위젯 제거
 *
 * // 현재 위젯 목록 확인
 * listCurrentWidgets();
 *
 * // 사용 가능한 위젯 목록 확인
 * getAvailableWidgets();
 *
 * // 모든 위젯 제거
 * clearAllWidgets();
 *
 * // 위젯 개수 확인
 * getWidgetCount();
 */

function addWidgetByName(widgetName, grid = null) {
    const targetGrid = grid || window.gridStack;
    if (!targetGrid) {
        console.error('Grid instance is null');
        return false;
    }

    const widgetMap = {
        'cpu': createCPUWidget,
        'memory': createMemoryWidget,
        'network': createNetworkWidget,
        'system': createSystemInfoWidget,
        'actions': createQuickActionsWidget,
        'code-stats': createCodeStatsWidget,
        'weather': createWeatherWidget,
        'clock': createClockWidget,
        'progress': createProgressWidget,
        'image': createImageWidget
    };

    const createFunction = widgetMap[widgetName.toLowerCase()];
    if (!createFunction) {
        console.error(`Unknown widget type: ${widgetName}`);
        return false;
    }

    try {
        const widget = createFunction();
        targetGrid.addWidget(widget);
        console.log(`${widgetName} widget added successfully`);
        return true;
    } catch (error) {
        console.error(`Error adding ${widgetName} widget:`, error);
        return false;
    }
}

function addMultipleWidgets(widgetNames, grid = null) {
    const targetGrid = grid || window.gridStack;
    if (!targetGrid) {
        console.error('Grid instance is null');
        return false;
    }

    const results = [];
    widgetNames.forEach(name => {
        const success = addWidgetByName(name, targetGrid);
        results.push({ name, success });
    });

    console.log('Widget addition results:', results);
    return results;
}

function removeWidgetByName(widgetName) {
    const grid = window.gridStack;
    if (!grid) {
        console.error('Grid instance is null');
        return false;
    }

    const widgets = grid.getGridItems();
    for (let widget of widgets) {
        const header = widget.querySelector('.widget-header h4');
        if (header && header.textContent.toLowerCase().includes(widgetName.toLowerCase())) {
            grid.removeWidget(widget);
            console.log(`${widgetName} widget removed successfully`);
            return true;
        }
    }

    console.log(`Widget ${widgetName} not found`);
    return false;
}

function getAvailableWidgets() {
    return [
        { name: 'CPU', key: 'cpu', description: 'CPU 사용률 게이지' },
        { name: 'Memory', key: 'memory', description: '메모리 사용률 바' },
        { name: 'Network', key: 'network', description: '네트워크 활동 모니터링' },
        { name: 'System Info', key: 'system', description: '시스템 정보 표시' },
        { name: 'Quick Actions', key: 'actions', description: '빠른 실행 버튼들' },
        { name: 'Code Statistics', key: 'code-stats', description: '코드 통계 정보' },
        { name: 'Weather', key: 'weather', description: '날씨 정보 표시' },
        { name: 'Clock', key: 'clock', description: '실시간 시계' },
        { name: 'Progress', key: 'progress', description: '프로젝트 진행률' },
        { name: 'Image Display', key: 'image', description: '이미지 표시' }
    ];
}

function clearAllWidgets() {
    const grid = window.gridStack;
    if (!grid) {
        console.error('Grid instance is null');
        return false;
    }

    const widgets = grid.getGridItems();
    widgets.forEach(widget => {
        grid.removeWidget(widget);
    });

    console.log('All widgets cleared');
    return true;
}

function getWidgetCount() {
    const grid = window.gridStack;
    if (!grid) {
        return 0;
    }

    return grid.getGridItems().length;
}

function listCurrentWidgets() {
    const grid = window.gridStack;
    if (!grid) {
        console.error('Grid instance is null');
        return [];
    }

    const widgets = grid.getGridItems();
    const widgetList = widgets.map(widget => {
        const header = widget.querySelector('.widget-header h4');
        return header ? header.textContent.trim() : 'Unknown Widget';
    });

    console.log('Current widgets:', widgetList);
    return widgetList;
}

// Widget Name Utility Functions

function getWidgetName(widgetElement) {
    const titleElement = widgetElement.querySelector('.widget-title');
    return titleElement ? titleElement.textContent.trim() : 'Unknown Widget';
}

function getAllImageWidgetNames() {
    const grid = window.gridStack;
    if (!grid) {
        return [];
    }
    
    const widgets = grid.getGridItems();
    const imageWidgetNames = [];
    
    widgets.forEach(widget => {
        const header = widget.querySelector('.widget-header h4');
        if (header && header.textContent.includes('Image_Display')) {
            const titleElement = widget.querySelector('.widget-title');
            if (titleElement) {
                imageWidgetNames.push(titleElement.textContent.trim());
            }
        }
    });
    
    return imageWidgetNames;
}

function refreshAllImageWidgets() {
    const imageWidgetNames = getAllImageWidgetNames();
    console.log('Refreshing all image widgets:', imageWidgetNames);
    
    imageWidgetNames.forEach(widgetName => {
        // 각 위젯의 새로고침 버튼을 찾아서 클릭
        const grid = window.gridStack;
        if (grid) {
            const widgets = grid.getGridItems();
            widgets.forEach(widget => {
                const titleElement = widget.querySelector('.widget-title');
                if (titleElement && titleElement.textContent.trim() === widgetName) {
                    const refreshButton = widget.querySelector('.btn-icon[onclick*="refreshImage"]');
                    if (refreshButton) {
                        refreshButton.click();
                    }
                }
            });
        }
    });
}