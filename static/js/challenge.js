// Challenge System Management
const challengeList = [
    // Editor Usage Challenges
    {
        id: 'editor-10-runs',
        title: '코드 실행 초보자',
        description: '에디터에서 코드를 10회 실행하세요',
        category: 'editor',
        target: 10,
        current: 0,
        unit: '회',
        points: 50,
        icon: 'fas fa-play-circle',
        completedAt: null
    },
    {
        id: 'editor-100-runs',
        title: '코드 실행 숙련자',
        description: '에디터에서 코드를 100회 실행하세요',
        category: 'editor',
        target: 100,
        current: 0,
        unit: '회',
        points: 200,
        icon: 'fas fa-rocket',
        completedAt: null
    },
    {
        id: 'editor-1000-runs',
        title: '코드 실행 마스터',
        description: '에디터에서 코드를 1000회 실행하세요',
        category: 'editor',
        target: 1000,
        current: 0,
        unit: '회',
        points: 1000,
        icon: 'fas fa-crown',
        completedAt: null
    },

    // Widget Creation Challenges
    {
        id: 'widget-5-created',
        title: '위젯 생성자',
        description: '5개의 위젯을 생성하세요',
        category: 'widget',
        target: 5,
        current: 0,
        unit: '개',
        points: 100,
        icon: 'fas fa-puzzle-piece',
        completedAt: null
    },
    {
        id: 'widget-20-created',
        title: '위젯 마스터',
        description: '20개의 위젯을 생성하세요',
        category: 'widget',
        target: 20,
        current: 0,
        unit: '개',
        points: 300,
        icon: 'fas fa-layer-group',
        completedAt: null
    },

    // Code Execution Time Challenges
    {
        id: 'code-1-hour',
        title: '1시간 코딩',
        description: '총 1시간 동안 코드를 실행하세요',
        category: 'time',
        target: 3600, // seconds
        current: 0,
        unit: '초',
        points: 150,
        icon: 'fas fa-clock',
        completedAt: null
    },
    {
        id: 'code-10-hours',
        title: '10시간 코딩',
        description: '총 10시간 동안 코드를 실행하세요',
        category: 'time',
        target: 36000, // seconds
        current: 0,
        unit: '초',
        points: 500,
        icon: 'fas fa-hourglass-half',
        completedAt: null
    },

    // File Management Challenges
    {
        id: 'save-5-files',
        title: '파일 저장자',
        description: '5개의 코드 파일을 저장하세요',
        category: 'file',
        target: 5,
        current: 0,
        unit: '개',
        points: 80,
        icon: 'fas fa-save',
        completedAt: null
    },
    {
        id: 'save-20-files',
        title: '파일 관리자',
        description: '20개의 코드 파일을 저장하세요',
        category: 'file',
        target: 20,
        current: 0,
        unit: '개',
        points: 250,
        icon: 'fas fa-folder-open',
        completedAt: null
    },

    // Tutorial Completion Challenges
    {
        id: 'complete-3-tutorials',
        title: '튜토리얼 학습자',
        description: '3개의 튜토리얼을 완료하세요',
        category: 'tutorial',
        target: 3,
        current: 0,
        unit: '개',
        points: 120,
        icon: 'fas fa-graduation-cap',
        completedAt: null
    },
    {
        id: 'complete-all-tutorials',
        title: '튜토리얼 마스터',
        description: '모든 튜토리얼을 완료하세요',
        category: 'tutorial',
        target: 10,
        current: 0,
        unit: '개',
        points: 500,
        icon: 'fas fa-trophy',
        completedAt: null
    },

    // Special Challenges
    {
        id: 'first-day',
        title: '첫 번째 날',
        description: '에디터를 처음 사용한 날',
        category: 'special',
        target: 1,
        current: 0,
        unit: '회',
        points: 100,
        icon: 'fas fa-star',
        completedAt: null
    },
    {
        id: 'week-streak',
        title: '일주일 연속',
        description: '7일 연속으로 에디터를 사용하세요',
        category: 'streak',
        target: 7,
        current: 0,
        unit: '일',
        points: 300,
        icon: 'fas fa-fire',
        completedAt: null
    },
    {
        id: 'month-streak',
        title: '한 달 연속',
        description: '30일 연속으로 에디터를 사용하세요',
        category: 'streak',
        target: 30,
        current: 0,
        unit: '일',
        points: 1000,
        icon: 'fas fa-calendar-check',
        completedAt: null
    }
];

// Challenge progress tracking
let challengeProgress = {};

// Initialize challenge system
document.addEventListener('DOMContentLoaded', function() {
    loadChallengeProgress();
    updateChallengeProgress();
});

function loadChallengeProgress() {
    const saved = localStorage.getItem('challengeProgress');
    if (saved) {
        challengeProgress = JSON.parse(saved);
    }

    // Initialize challenges that don't have progress
    challengeList.forEach(challenge => {
        if (!challengeProgress[challenge.id]) {
            challengeProgress[challenge.id] = {
                current: 0,
                completedAt: null
            };
        }
        challenge.current = challengeProgress[challenge.id].current;
        challenge.completedAt = challengeProgress[challenge.id].completedAt;
    });
}

function saveChallengeProgress() {
    localStorage.setItem('challengeProgress', JSON.stringify(challengeProgress));
}

function updateChallengeProgress() {
    // Update current values from localStorage
    challengeList.forEach(challenge => {
        if (challengeProgress[challenge.id]) {
            challenge.current = challengeProgress[challenge.id].current;
            challenge.completedAt = challengeProgress[challenge.id].completedAt;
        }
    });
}

function incrementChallenge(challengeId, amount = 1) {
    if (!challengeProgress[challengeId]) {
        challengeProgress[challengeId] = { current: 0, completedAt: null };
    }

    challengeProgress[challengeId].current += amount;

    // Check if challenge is completed
    const challenge = challengeList.find(c => c.id === challengeId);
    if (challenge && challengeProgress[challengeId].current >= challenge.target && !challengeProgress[challengeId].completedAt) {
        challengeProgress[challengeId].completedAt = new Date().toISOString();
        challenge.completedAt = challengeProgress[challengeId].completedAt;

        // Show completion notification
        showChallengeCompletion(challenge);
    }

    saveChallengeProgress();
    updateChallengeProgress();
}

function showChallengeCompletion(challenge) {
    showToast(`🏆 도전과제 달성! "${challenge.title}" (+${challenge.points}점)`, 'success');
}

function showChallenge() {
    // Remove existing challenge window
    const existingWindow = document.getElementById('challengeWindow');
    if (existingWindow) {
        existingWindow.remove();
    }

    // Create challenge window HTML
    const challengeHTML = `
        <div class="challenge-overlay" id="challengeOverlay">
            <div class="challenge-window" id="challengeWindow">
                <div class="challenge-header">
                    <h2><i class="fas fa-trophy"></i> 도전과제</h2>
                    <button class="challenge-close" id="challengeCloseBtn">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="challenge-content">
                    <div class="challenge-stats">
                        <div class="stat-item">
                            <span class="stat-label">총 점수</span>
                            <span class="stat-value" id="totalScore">0</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">완료된 과제</span>
                            <span class="stat-value" id="completedCount">0</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">진행률</span>
                            <span class="stat-value" id="progressRate">0%</span>
                        </div>
                    </div>
                    <div class="challenge-list" id="challengeList">
                        ${generateChallengeList()}
                    </div>
                </div>
            </div>
        </div>
    `;

    // Add to body
    document.body.insertAdjacentHTML('beforeend', challengeHTML);

    // Bind events
    document.getElementById('challengeCloseBtn').addEventListener('click', closeChallengeWindow);
    document.getElementById('challengeOverlay').addEventListener('click', function(e) {
        if (e.target === this) {
            closeChallengeWindow();
        }
    });

    // Update stats
    updateChallengeStats();
}

function generateChallengeList() {
    return challengeList.map(challenge => {
        const isCompleted = challenge.completedAt !== null;
        const progress = challenge.current;
        const target = challenge.target;
        const progressPercent = Math.min((progress / target) * 100, 100);

        return `
            <div class="challenge-item ${isCompleted ? 'completed' : ''}" data-challenge-id="${challenge.id}">
                <div class="challenge-icon">
                    <i class="${challenge.icon}"></i>
                </div>
                <div class="challenge-content">
                    <div class="challenge-header">
                        <h3>${challenge.title}</h3>
                        <div class="challenge-meta">
                            <span class="challenge-category ${challenge.category}">${getCategoryName(challenge.category)}</span>
                            <span class="challenge-points">+${challenge.points}점</span>
                        </div>
                    </div>
                    <p class="challenge-description">${challenge.description}</p>
                    <div class="challenge-progress">
                        <div class="progress-bar">
                            <div class="progress-fill" style="width: ${progressPercent}%"></div>
                        </div>
                        <span class="progress-text">${progress}/${target} ${challenge.unit}</span>
                    </div>
                    ${isCompleted ? `
                        <div class="completion-info">
                            <i class="fas fa-check-circle"></i>
                            <span>완료: ${formatDate(challenge.completedAt)}</span>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    }).join('');
}

function getCategoryName(category) {
    const categoryNames = {
        'editor': '에디터',
        'widget': '위젯',
        'time': '시간',
        'file': '파일',
        'tutorial': '튜토리얼',
        'special': '특별',
        'streak': '연속'
    };
    return categoryNames[category] || category;
}

function formatDate(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

function updateChallengeStats() {
    const totalScore = challengeList.reduce((sum, challenge) => {
        return sum + (challenge.completedAt ? challenge.points : 0);
    }, 0);

    const completedCount = challengeList.filter(challenge => challenge.completedAt).length;
    const progressRate = Math.round((completedCount / challengeList.length) * 100);

    document.getElementById('totalScore').textContent = totalScore;
    document.getElementById('completedCount').textContent = completedCount;
    document.getElementById('progressRate').textContent = `${progressRate}%`;
}

function closeChallengeWindow() {
    const challengeOverlay = document.getElementById('challengeOverlay');
    if (challengeOverlay) {
        challengeOverlay.remove();
    }
}

// Global functions for other modules to call
window.incrementChallenge = incrementChallenge;
window.showChallenge = showChallenge;
