// CPU Monitor Implementation
document.addEventListener('DOMContentLoaded', function() {
    initializeCpuMonitor();
});

let cpuUpdateInterval = null;
let isCpuDetailsVisible = false;

function initializeCpuMonitor() {
    const cpuDisplay = document.getElementById('cpuDisplay');
    const cpuDetails = document.getElementById('cpuDetails');
    const cpuCloseBtn = document.getElementById('cpuCloseBtn');

    if (!cpuDisplay || !cpuDetails) {
        console.error('CPU monitor elements not found');
        return;
    }

    // CPU 표시 클릭 이벤트
    cpuDisplay.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        toggleCpuDetails();
    });

    // 닫기 버튼 클릭 이벤트
    if (cpuCloseBtn) {
        cpuCloseBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            hideCpuDetails();
        });
    }

    // 외부 클릭으로 닫기
    document.addEventListener('click', function(e) {
        if (!cpuDisplay.contains(e.target) && !cpuDetails.contains(e.target)) {
            hideCpuDetails();
        }
    });

    // ESC 키로 닫기
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && isCpuDetailsVisible) {
            hideCpuDetails();
        }
    });

    // CPU 모니터링 시작
    startCpuMonitoring();
}

function startCpuMonitoring() {
    // 즉시 첫 번째 업데이트 실행
    updateCpuUsage();
    
    // 1초마다 업데이트
    cpuUpdateInterval = setInterval(updateCpuUsage, 1000);
}

function stopCpuMonitoring() {
    if (cpuUpdateInterval) {
        clearInterval(cpuUpdateInterval);
        cpuUpdateInterval = null;
    }
}

async function updateCpuUsage() {
    try {
        const response = await fetch('/api/cpu-usage');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        if (data.success) {
            updateCpuDisplay(data.cpu_percent);
            if (isCpuDetailsVisible) {
                updateCpuDetails(data.cpu_percent_per_cpu, data.cpu_count);
            }
        }
    } catch (error) {
        console.error('CPU usage update failed:', error);
        // 에러 시 CPU 표시를 회색으로 변경
        updateCpuDisplay('--', true);
    }
}

function updateCpuDisplay(cpuPercent, isError = false) {
    const cpuPercentElement = document.getElementById('cpuPercent');
    const cpuDisplay = document.getElementById('cpuDisplay');
    
    if (!cpuPercentElement || !cpuDisplay) return;

    if (isError) {
        cpuPercentElement.textContent = '--';
        cpuDisplay.style.opacity = '0.5';
        return;
    }

    cpuPercentElement.textContent = `${Math.round(cpuPercent)}%`;
    cpuDisplay.style.opacity = '1';

    // CPU 사용량에 따른 색상 변화
    const icon = cpuDisplay.querySelector('i');
    if (icon) {
        if (cpuPercent < 30) {
            icon.style.color = '#00d4aa'; // 낮음 - 초록
        } else if (cpuPercent < 70) {
            icon.style.color = '#f39c12'; // 중간 - 주황
        } else {
            icon.style.color = '#e74c3c'; // 높음 - 빨강
        }
    }
}

function updateCpuDetails(cpuPercentPerCpu, cpuCount) {
    const cpuCoresElement = document.getElementById('cpuCores');
    if (!cpuCoresElement) return;

    // 기존 내용 제거
    cpuCoresElement.innerHTML = '';

    // 개별 CPU 코어 정보 생성
    cpuPercentPerCpu.forEach((usage, index) => {
        const coreElement = createCpuCoreElement(index, usage);
        cpuCoresElement.appendChild(coreElement);
    });
}

function createCpuCoreElement(coreIndex, usage) {
    const coreDiv = document.createElement('div');
    coreDiv.className = 'cpu-core';

    const label = document.createElement('div');
    label.className = 'cpu-core-label';
    label.textContent = `CPU ${coreIndex}`;

    const usageDiv = document.createElement('div');
    usageDiv.className = 'cpu-core-usage';

    const barDiv = document.createElement('div');
    barDiv.className = 'cpu-core-bar';

    const fillDiv = document.createElement('div');
    fillDiv.className = 'cpu-core-fill';
    fillDiv.style.width = `${usage}%`;

    // 사용량에 따른 색상 클래스 추가
    if (usage < 30) {
        fillDiv.classList.add('low');
    } else if (usage < 70) {
        fillDiv.classList.add('medium');
    } else {
        fillDiv.classList.add('high');
    }

    const percentDiv = document.createElement('div');
    percentDiv.className = 'cpu-core-percent';
    percentDiv.textContent = `${Math.round(usage)}%`;

    barDiv.appendChild(fillDiv);
    usageDiv.appendChild(barDiv);
    usageDiv.appendChild(percentDiv);

    coreDiv.appendChild(label);
    coreDiv.appendChild(usageDiv);

    return coreDiv;
}

function toggleCpuDetails() {
    if (isCpuDetailsVisible) {
        hideCpuDetails();
    } else {
        showCpuDetails();
    }
}

function showCpuDetails() {
    const cpuDetails = document.getElementById('cpuDetails');
    if (!cpuDetails) return;

    cpuDetails.classList.add('show');
    isCpuDetailsVisible = true;

    // 즉시 CPU 상세 정보 업데이트
    updateCpuUsage();
}

function hideCpuDetails() {
    const cpuDetails = document.getElementById('cpuDetails');
    if (!cpuDetails) return;

    cpuDetails.classList.remove('show');
    isCpuDetailsVisible = false;
}

// 페이지 언로드 시 정리
window.addEventListener('beforeunload', function() {
    stopCpuMonitoring();
});

// 전역 함수로 노출 (디버깅용)
window.cpuMonitor = {
    start: startCpuMonitoring,
    stop: stopCpuMonitoring,
    update: updateCpuUsage,
    showDetails: showCpuDetails,
    hideDetails: hideCpuDetails
};
