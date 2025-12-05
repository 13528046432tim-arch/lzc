// 游戏全局变量
let gameRunning = false;
let frogs = [];
let students = [];
let raceTime = 15000; // 默认赛跑时间5秒
let scoresPanelAccessed = false; // 记录是否首次访问成绩面板
let selectedSubjects = ['语文', '数学', '英语', '日语', '物理', '化学', '生物', '地理'];
let animationsEnabled = true; // 动画效果开关
let soundEnabled = true; // 声音效果开关
let audioContext = null; // Web Audio API上下文

// DOM元素缓存
const settingsPanel = document.getElementById('settingsPanel');
const importNotice = document.getElementById('importNotice');
const scoreWindow = document.getElementById('scoreWindow');
const scoreWindowTitle = document.getElementById('scoreWindowTitle');
const scoreContent = document.getElementById('scoreContent');
const leaderboard = document.getElementById('leaderboard');
const rankings = document.getElementById('rankings');
const animationToggle = document.getElementById('animationToggle');
const scoresPanel = document.getElementById('scoresPanel');
// 新增DOM元素缓存
const playBtn = document.getElementById('playBtn');
const settingsBtn = document.getElementById('settingsBtn');
const closeSettings = document.getElementById('closeSettings');
const importBtn = document.getElementById('importBtn');
const raceTimeInput = document.getElementById('raceTimeInput');
const soundToggle = document.getElementById('soundToggle');
const closeScoreWindow = document.getElementById('closeScoreWindow');
const leaderboardButton = document.getElementById('toggleToLeaderboard');
const toggleToScoresButton = document.getElementById('toggleToScores');
// const toggleToLeaderboardButton = document.getElementById('toggleToLeaderboard'); // 重复引用，已由leaderboardButton代替
const scoresPanelTitle = document.querySelector('.scores-panel h2');
// 点击事件处理函数缓存
let outsideClickHandler = null;

// 鼠标移动事件处理函数，使青蛙的眼睛追随鼠标
function handleMouseMove(e) {
    const mouseX = e.clientX;
    const mouseY = e.clientY;
    
    // 遍历所有青蛙，更新眼球位置
    frogs.forEach(frog => {
        const eyes = frog.querySelector('.eyes');
        if (!eyes) return;
        
        // 获取青蛙眼睛相对于文档的位置
        const eyesRect = eyes.getBoundingClientRect();
        const eyesCenterX = eyesRect.left + eyesRect.width / 2;
        const eyesCenterY = eyesRect.top + eyesRect.height / 2;
        
        // 计算鼠标相对于眼睛中心的角度
        const angle = Math.atan2(mouseY - eyesCenterY, mouseX - eyesCenterX);
        
        // 计算眼球偏移量（范围：-2px 到 2px）
        const offsetX = Math.cos(angle) * 2;
        const offsetY = Math.sin(angle) * 2;
        
        // 更新左右眼球位置
        const pupils = frog.querySelectorAll('.pupil');
        pupils.forEach(pupil => {
            pupil.style.transform = `translate(${offsetX}px, ${offsetY}px)`;
        });
    });
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    initGame();
    setupOutsideClick();
});

// 初始化游戏
function initGame() {
    // 设置初始按钮状态：仅显示设置按钮
    updateButtonVisibility('initial');
    
    // 默认加载CSV文件
    loadCSV('card.csv');
    
    // 绑定事件（添加存在性检查）
    if (playBtn) playBtn.addEventListener('click', startRace);
    if (settingsBtn) settingsBtn.addEventListener('click', showSettings);
    if (closeSettings) closeSettings.addEventListener('click', hideSettings);
    if (importBtn) importBtn.addEventListener('change', importCSV);
    if (raceTimeInput) raceTimeInput.addEventListener('change', updateRaceTime);
    if (animationToggle) {
        animationToggle.addEventListener('change', updateAnimationSetting);
        animationsEnabled = animationToggle.checked;
    }
    if (soundToggle) {
        soundToggle.addEventListener('change', updateSoundSetting);
        soundEnabled = soundToggle.checked;
    }
    if (closeScoreWindow) closeScoreWindow.addEventListener('click', hideScoreWindow);
    
    // 排行榜相关按钮事件
    if (leaderboardButton) leaderboardButton.addEventListener('click', () => {
        hideScoresPanel();
        showLeaderboard();
    });
    
    // 切换视图按钮事件
    if (toggleToScoresButton) toggleToScoresButton.addEventListener('click', () => {
        hideLeaderboard();
        setTimeout(showScoresPanel, 500);
        scoresPanelAccessed = true; // 设置标志为已访问成绩面板
    });
    
    // 注意：toggleToLeaderboardButton在HTML中不存在，它应该是在成绩面板中动态创建的
    
    // 科目切换事件
    const subjectTabs = document.querySelectorAll('.tab-btn');
    subjectTabs.forEach(tab => {
        tab.addEventListener('click', function() {
            const subject = this.getAttribute('data-subject');
            showScoresBySubject(subject);
        });
    });
    
    // 显示导入提示
    showImportNotice('请导入成绩表以开始游戏', false);
}

// 加载CSV文件
function loadCSV(filename) {
    fetch(filename)
        .then(response => {
            if (!response.ok) {
                throw new Error('文件加载失败');
            }
            return response.text();
        })
        .then(data => {
            parseCSV(data);
            console.log('CSV文件加载成功');
            // 导入成功，隐藏提示并更新按钮状态
            if (students.length > 0) {
                showImportNotice('成绩表导入成功', true);
                updateButtonVisibility('imported');
            }
        })
        .catch(error => {
            console.error('加载CSV文件失败:', error);
            showImportNotice('加载默认成绩表失败，请手动导入', false);
        });
}

// 加载Excel文件
function loadExcel(filename) {
    fetch(filename)
        .then(response => response.arrayBuffer())
        .then(data => {
            const workbook = XLSX.read(data, { type: 'array' });
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            const jsonData = XLSX.utils.sheet_to_json(worksheet);
            parseExcel(jsonData);
            console.log('Excel文件加载成功');
            // 导入成功，隐藏提示并更新按钮状态
            if (students.length > 0) {
                showImportNotice('成绩表导入成功', true);
                updateButtonVisibility('imported');
            }
        })
        .catch(error => {
            console.error('加载Excel文件失败:', error);
            showImportNotice('加载默认成绩表失败，请手动导入', false);
        });
}

// 解析Excel数据
function parseExcel(jsonData) {
    students = [];
    jsonData.forEach(row => {
        if (!row) return; // 跳过undefined或null的行
        const student = {
            姓名: row['姓名'] || '',
            班级: row['班级'] || '',
            语文: parseFloat(row['语文']) || 0,
            数学: parseFloat(row['数学']) || 0,
            英语: parseFloat(row['英语']) || 0,
            日语: parseFloat(row['日语']) || 0,
            物理: parseFloat(row['物理']) || 0,
            化学: parseFloat(row['化学']) || 0,
            生物: parseFloat(row['生物']) || 0,
            地理: parseFloat(row['地理']) || 0
        };
        // 计算总分
        student.总分 = calculateTotalScore(student);
        students.push(student);
    });
    
    // 更新青蛙
    updateFrogs();
}

// 解析CSV数据
function parseCSV(csvData) {
    const lines = csvData.trim().split('\n');
    if (lines.length < 2) {
        showImportNotice('CSV文件格式错误，缺少数据行', false);
        return;
    }
    
    const headers = lines[0].split(',');
    students = [];
    
    console.log('CSV数据总行数:', lines.length);
    console.log('表头:', headers);
    
    for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',');
        if (values.length < headers.length) {
            console.warn(`第${i+1}行数据不完整，已跳过`);
            continue;
        }
        
        const student = {
            name: values[0] || `学生${i}`,
            scores: {},
            totalScore: 0
        };
        
        // 解析各科成绩（包含所有科目，不排除任何列）
        for (let j = 1; j < headers.length; j++) {
            const subject = headers[j];
            if (subject !== '总分') { // 跳过总分列
                const score = parseFloat(values[j]) || 0;
                student.scores[subject] = score;
            }
        }
        
        // 计算总分数（所选科目）
        student.totalScore = calculateTotalScore(student);
        students.push(student);
    }
    
    console.log('成功加载的学生数量:', students.length);
    
    if (students.length === 0) {
        showImportNotice('未找到有效学生数据', false);
        return;
    }
    
    // 更新青蛙显示
    updateFrogs();
}

// 计算总分数（所选科目）
function calculateTotalScore(student) {
    let total = 0;
    selectedSubjects.forEach(subject => {
        // 支持两种数据格式：CSV的student.scores[subject]和Excel的student[subject]
        total += (student.scores ? student.scores[subject] : student[subject]) || 0;
    });
    return total;
}

// 更新青蛙显示
function updateFrogs() {
    const track = document.getElementById('track');
    if (!track) {
        console.error('赛道元素未找到');
        return;
    }
    
    track.innerHTML = '';
    frogs = [];
    
    // 恢复每行3个青蛙，使用智能赛道分配机制
    const screenHeight = window.innerHeight;
    const totalStudents = students.length;
    const headerHeight = 20; // 最小化顶部预留空间
    const targetHeight = screenHeight * 0.8; // 目标跑道高度为屏幕高度的80%
    const columns = 3; // 每行显示三个青蛙，恢复原设置
    
    // 计算行数和列数
    const rows = Math.ceil(totalStudents / columns);
    
    // 计算行高，确保跑道高度至少覆盖80%的页面高度
    const minRowHeight = Math.ceil(targetHeight / rows);
    const rowHeight = Math.max(20, minRowHeight);
    let fontSize = Math.max(7, Math.floor(rowHeight * 0.35)); // 再次缩小字体大小为行高的35%，保证青蛙不变形
    
    // 确保不显示滚动条
    track.style.overflowY = 'hidden';
    track.style.height = 'auto';
    
    // 智能赛道分配算法：将学生分为高分、中分、低分三组，然后从每组随机选择学生组成赛道
    const assignedStudents = assignStudentsToTracks();
    
    // 创建文档片段，用于批量DOM操作，减少重绘重排
    const fragment = document.createDocumentFragment();
    
    assignedStudents.forEach((student, index) => {
        const frog = document.createElement('div');
        frog.className = 'frog';
        
        // 创建眼睛容器
        const eyesContainer = document.createElement('div');
        eyesContainer.className = 'eyes';
        
        // 创建左眼
        const leftEye = document.createElement('div');
        leftEye.className = 'eye';
        const leftPupil = document.createElement('div');
        leftPupil.className = 'pupil';
        leftEye.appendChild(leftPupil);
        
        // 创建右眼
        const rightEye = document.createElement('div');
        rightEye.className = 'eye';
        const rightPupil = document.createElement('div');
        rightPupil.className = 'pupil';
        rightEye.appendChild(rightPupil);
        
        // 将眼睛添加到容器
        eyesContainer.appendChild(leftEye);
        eyesContainer.appendChild(rightEye);
        
        // 创建姓名元素
        const nameSpan = document.createElement('span');
        // 同时支持中文属性名'姓名'和英文属性名'name'
        const studentName = student.姓名 || student.name || '未知';
        nameSpan.textContent = studentName;
        
        // 创建嘴巴元素
        const mouthElement = document.createElement('div');
        mouthElement.className = 'mouth';
        
        // 将学生对象存储在青蛙元素上，以便后续引用
        // 同时支持两种属性名格式查找学生索引
        frog.dataset.studentIndex = students.findIndex(s => s.姓名 === studentName || s.name === studentName);
        
        // 设置位置：每行三个青蛙
        const row = Math.floor(index / columns);
        const col = index % columns;
        frog.style.top = `${row * rowHeight + 20}px`;
        frog.style.left = `${col * 150 + 10}px`; // 增加三列之间的间距
        frog.style.fontSize = `${fontSize}px`;
        
        // 添加点击事件
        frog.addEventListener('click', () => {
            showStudentScore(student);
        });
        
        // 创建王冠容器
        const crownContainer = document.createElement('div');
        crownContainer.className = 'crown';
        
        // 将元素添加到青蛙容器
        frog.appendChild(crownContainer);
        frog.appendChild(eyesContainer);
        frog.appendChild(mouthElement); // 添加嘴巴元素
        frog.appendChild(nameSpan);
        
        fragment.appendChild(frog);
        frogs.push(frog);
    });
    
    // 批量添加所有青蛙到赛道，减少DOM操作次数
    track.appendChild(fragment);
    
    // 移除之前的鼠标事件监听器，避免重复添加
    if (window.mouseMoveListener) {
        document.removeEventListener('mousemove', window.mouseMoveListener);
    }
    
    // 保存当前监听器引用并添加到document
    window.mouseMoveListener = handleMouseMove;
    document.addEventListener('mousemove', handleMouseMove);
}

// 导入文件（支持CSV和Excel）
function importCSV(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    
    if (file.name.endsWith('.csv')) {
        reader.onload = function(e) {
            const csvData = e.target.result;
            parseCSV(csvData);
            if (students.length > 0) {
                showImportNotice('成绩表导入成功', true);
                updateButtonVisibility('imported');
            } else {
                showImportNotice('导入的成绩表无效，请检查格式', false);
            }
        };
        reader.readAsText(file);
    } else if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
        reader.onload = function(e) {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            const jsonData = XLSX.utils.sheet_to_json(worksheet);
            parseExcel(jsonData);
            if (students.length > 0) {
                showImportNotice('成绩表导入成功', true);
                updateButtonVisibility('imported');
            } else {
                showImportNotice('导入的成绩表无效，请检查格式', false);
            }
        };
        reader.readAsArrayBuffer(file);
    } else {
        showImportNotice('不支持的文件格式', false);
    }
    
    reader.onerror = function() {
        showImportNotice('文件读取失败', false);
    };
}

// 更新赛跑时间
function updateRaceTime(event) {
    raceTime = parseInt(event.target.value) * 1000; // 转换为毫秒
    if (isNaN(raceTime) || raceTime < 1000) {
        raceTime = 1000;
        event.target.value = 1;
    } else if (raceTime > 30000) {
        raceTime = 30000;
        event.target.value = 30;
    }
}

// 更新动画设置
function updateAnimationSetting(event) {
    animationsEnabled = event.target.checked;
    if (!animationsEnabled) {
        // 如果关闭动画，移除所有元素的动画类
        document.querySelectorAll('.hop, .pulse, .leaderboard-pop').forEach(el => {
            el.classList.remove('hop', 'pulse', 'leaderboard-pop');
        });
    }
}

// 更新声音设置
function updateSoundSetting(event) {
    soundEnabled = event.target.checked;
}

// 初始化音频上下文
function initAudioContext() {
    if (!audioContext && soundEnabled) {
        try {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
        } catch (e) {
            console.error('Web Audio API not supported:', e);
        }
    }
}

// 播放青蛙跳跃音效
function playHopSound() {
    if (!soundEnabled || !audioContext) return;
    
    try {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        // 跳跃音效参数
        oscillator.frequency.setValueAtTime(400, audioContext.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(600, audioContext.currentTime + 0.1);
        oscillator.frequency.exponentialRampToValueAtTime(300, audioContext.currentTime + 0.2);
        
        gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
        
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.2);
    } catch (e) {
        console.error('Error playing hop sound:', e);
    }
}

// 播放比赛结束音效
function playFinishSound() {
    if (!soundEnabled || !audioContext) return;
    
    try {
        const notes = [440, 554.37, 659.25, 880]; // C4, E4, G4, C5
        
        notes.forEach((note, index) => {
            setTimeout(() => {
                const oscillator = audioContext.createOscillator();
                const gainNode = audioContext.createGain();
                
                oscillator.connect(gainNode);
                gainNode.connect(audioContext.destination);
                
                oscillator.frequency.setValueAtTime(note, audioContext.currentTime);
                
                gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
                
                oscillator.start(audioContext.currentTime);
                oscillator.stop(audioContext.currentTime + 0.2);
            }, index * 100);
        });
    } catch (e) {
        console.error('Error playing finish sound:', e);
    }
}

// 播放点击音效
function playClickSound() {
    if (!soundEnabled || !audioContext) return;
    
    try {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(400, audioContext.currentTime + 0.1);
        
        gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
        
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.1);
    } catch (e) {
        console.error('Error playing click sound:', e);
    }
}

// 显示设置面板
function showSettings() {
    if (settingsPanel && raceTimeInput) {
        settingsPanel.style.display = 'block';
        raceTimeInput.value = raceTime / 1000;
    }
}

// 隐藏设置面板
function hideSettings() {
    if (settingsPanel) {
        settingsPanel.style.display = 'none';
    }
}

// 显示成绩榜单面板
function showScoresPanel() {
    if (scoresPanel) {
        // 确保显示成绩榜单
        scoresPanel.style.display = 'block';
        
        // 重置动画状态
        if (animationsEnabled) {
            scoresPanel.style.opacity = '0';
            scoresPanel.style.transform = 'translateY(-30px) scale(0.95)';
            
            // 触发重排
            void scoresPanel.offsetWidth;
            
            // 应用动画
            scoresPanel.style.transition = 'opacity 0.5s ease-out, transform 0.5s ease-out';
            scoresPanel.style.opacity = '1';
            scoresPanel.style.transform = 'translateY(0) scale(1)';
        } else {
            // 没有动画时直接设置为正常状态
            scoresPanel.style.opacity = '1';
            scoresPanel.style.transform = 'translateY(0) scale(1)';
        }
    }
    
    // 显示切换到排行榜的按钮
    updateButtonVisibility('scores_panel_open');
    
    // 默认显示语文成绩
    showScoresBySubject('语文');
}

// 隐藏成绩榜单面板
function hideScoresPanel() {
    if (scoresPanel) {
        if (animationsEnabled) {
            scoresPanel.style.transition = 'opacity 0.5s ease-out, transform 0.5s ease-out';
            scoresPanel.style.opacity = '0';
            scoresPanel.style.transform = 'scale(0.95)';
            
            setTimeout(() => {
                scoresPanel.style.display = 'none';
            }, 500);
        } else {
            scoresPanel.style.display = 'none';
        }
    }
    
    // 关闭成绩表时，隐藏切换到排行榜的按钮
    updateButtonVisibility('leaderboard_open');
}



// 根据科目显示成绩榜单
function showScoresBySubject(subject) {
    // 更新标签页的激活状态
    const tabBtns = document.querySelectorAll('.tab-btn');
    tabBtns.forEach(btn => {
        btn.classList.remove('active');
        if (btn.getAttribute('data-subject') === subject) {
            btn.classList.add('active');
        }
    });
    
    // 更新成绩榜单标题
    if (scoresPanelTitle) {
        scoresPanelTitle.textContent = `${subject}成绩单`;
    }
    
    // 对学生按指定科目成绩排序，并过滤掉成绩为0或空的学生
    const sortedStudents = [...students]
        .filter(student => {
            const score = student[subject] || 0;
            return score > 0;
        })
        .sort((a, b) => b[subject] - a[subject]);
    
    // 生成成绩列表
    const scoresList = document.getElementById('scoresList');
    if (!scoresList) return;
    
    scoresList.innerHTML = '';
    
    sortedStudents.forEach((student, index) => {
        const li = document.createElement('li');
        
        // 为前三名添加特殊样式
        let rankClass = '';
        if (index === 0) rankClass = 'gold';
        else if (index === 1) rankClass = 'silver';
        else if (index === 2) rankClass = 'bronze';
        
        li.className = rankClass;
        li.innerHTML = `
            <span class="rank">${index + 1}</span>
            <span class="student-name">${student.姓名}</span>
            <span class="student-score">${student[subject]}</span>
        `;
        scoresList.appendChild(li);
    });
}

// 青蛙跳跃动画
function frogHop(frog) {
    if (frog && animationsEnabled) {
        frog.classList.add('hop');
        
        // 播放跳跃音效
        playHopSound();
        
        setTimeout(() => {
            frog.classList.remove('hop');
        }, 300);
    }
}

// 计算赛道宽度和青蛙位置
function calculateTrackData() {
    // 首先确保所有学生都有totalScore属性
    students.forEach(student => {
        if (!student.totalScore) {
            student.totalScore = calculateTotalScore(student);
        }
    });
    
    // 根据第一名总分加20的条件设立跑道宽度
    const sortedStudents = [...students].sort((a, b) => b.totalScore - a.totalScore);
    const firstPlaceScore = sortedStudents.length > 0 ? sortedStudents[0].totalScore : 0;
    const maxPossibleScore = Math.max(firstPlaceScore + 20, 100); // 第一名总分加20作为满分，至少100分

    // 获取赛道实际宽度
    const trackElement = document.querySelector('.track');
    if (!trackElement) {
        console.error('赛道元素未找到');
        return null;
    }
    
    const trackClientWidth = trackElement.clientWidth;

    // 确保赛道宽度有效
    if (trackClientWidth <= 0) {
        console.error('赛道宽度计算错误，请检查赛道元素');
        return null;
    }

    // 设置赛道的最大可用宽度（减去左右边距）
    const trackMaxWidth = trackClientWidth - 60; // 左右各留30px边距

    return { maxPossibleScore, trackMaxWidth, trackClientWidth };
}

// 开始/停止比赛
function startRace() {
    if (!playBtn) {
        console.error('播放按钮未找到');
        return;
    }
    
    // 初始化音频上下文（首次点击时）
    initAudioContext();
    
    // 播放点击音效
    playClickSound();
    
    // 如果没有学生数据，不执行任何操作并提示
    if (students.length === 0) {
        showImportNotice('请先导入成绩表', false);
        return;
    }
    
    // 如果游戏正在运行，点击停止按钮
    if (gameRunning) {
        // 停止比赛
        gameRunning = false;
        playBtn.textContent = '▶️'; // 更换为播放图标
        playBtn.title = '播放'; // 更新提示文本
        playBtn.classList.remove('pulse');
        
        // 显示排行榜
        showLeaderboard();
        return;
    }
    
    // 如果游戏未运行，开始比赛
    gameRunning = true;
    playBtn.textContent = '⏹️'; // 更换为停止图标
    playBtn.disabled = false; // 允许点击停止
    if (animationsEnabled) playBtn.classList.add('pulse');
    playBtn.title = '停止'; // 更新提示文本
    
    // 隐藏排行榜
    hideLeaderboard();
    
    // 1. 所有青蛙回到起点
    frogs.forEach((frog, index) => {
        if (frog) {
            frog.style.left = '10px';
            if (animationsEnabled) {
                frog.style.transition = 'left 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)';
            } else {
                frog.style.transition = 'none';
            }
            frog.classList.remove('first-place', 'second-place', 'third-place');
        }
    });
    
    // 2. 添加起跑线（如果不存在）
    let startLine = document.querySelector('.start-line');
    if (!startLine) {
        const track = document.getElementById('track');
        if (track) {
            startLine = document.createElement('div');
            startLine.className = 'start-line';
            track.appendChild(startLine);
        }
    }
    
    // 3. 实现321Ready GO!倒计时动画
    setTimeout(() => {
        if (!gameRunning) return;
        
        // 将倒计时文本改为'3', '2', '1', '开炮'
        const countdownText = ['3', '2', '1' ,'Ready', 'GO!'];
        let countdownIndex = 0;
        
        const countdownElement = document.createElement('div');
        countdownElement.className = 'countdown';
        document.body.appendChild(countdownElement);
        
        const showCountdown = () => {
            if (!gameRunning || countdownIndex >= countdownText.length) {
                if (countdownElement.parentNode) {
                    countdownElement.parentNode.removeChild(countdownElement);
                }
                
                // 倒计时结束，开始比赛
                if (gameRunning) {
                    startRaceAnimation();
                }
                return;
            }
            
            countdownElement.textContent = countdownText[countdownIndex];
            countdownElement.style.opacity = '0';
            
            // 强制重排
            void countdownElement.offsetWidth;
            
            countdownElement.style.opacity = '1';
            countdownElement.style.transform = 'translate(-50%, -50%) scale(1.2)';
            
            setTimeout(() => {
                countdownElement.style.opacity = '0';
                countdownElement.style.transform = 'translate(-50%, -50%) scale(0.8)';
                
                countdownIndex++;
                setTimeout(showCountdown, 500);
            }, 500);
        };
        
        showCountdown();
    }, 900); // 等待青蛙回到起点的动画完成
}

// 开始比赛动画
function startRaceAnimation() {
    // 播放开炮声音效果
    if (soundEnabled && audioContext) {
        try {
            // 创建振荡器
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            // 设置音效参数
            oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
            oscillator.frequency.exponentialRampToValueAtTime(400, audioContext.currentTime + 0.1);
            
            gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
            
            // 启动音效
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.2);
        } catch (e) {
            console.error('Error playing shoot sound:', e);
        }
    }
    
    // 计算赛道数据
    const trackData = calculateTrackData();
    if (!trackData) return;
    
    const { maxPossibleScore, trackMaxWidth, trackClientWidth } = trackData;
    
    // 一次性跑完整个赛道，不分段
    frogs.forEach((frog, index) => {
        if (!frog) return;
        
        // 从青蛙元素获取学生索引
        const studentIndex = parseInt(frog.dataset.studentIndex);
        if (!isNaN(studentIndex) && students[studentIndex]) {
            const student = students[studentIndex];
            
            // 确保学生有totalScore属性
            if (!student.totalScore) {
                student.totalScore = calculateTotalScore(student);
            }
            
            // 计算总距离 - 确保比例正确且不超出赛道宽度
            const distancePercentage = Math.min(1, student.totalScore / maxPossibleScore); // 确保不超过100%
            const totalDistance = distancePercentage * trackMaxWidth;
            const finalPosition = Math.max(10, Math.min(10 + totalDistance, trackClientWidth - 40)); // 确保在赛道可见区域内
            
            // 应用过渡动画
            setTimeout(() => {
                if (frog && gameRunning) {
                    frog.style.transition = `left ${raceTime}ms ease-in-out`;
                    frog.style.left = `${finalPosition}px`;
                }
            }, 100);
            
            // 添加持续的跳跃动画
            const hopInterval = setInterval(() => {
                if (gameRunning && frog) {
                    frogHop(frog);
                } else {
                    clearInterval(hopInterval);
                }
            }, 500);
        }
    });
    
    // 比赛结束
    setTimeout(() => {
        if (gameRunning) { // 只有在游戏仍在运行时才执行结束逻辑
            gameRunning = false;
            
            // 播放比赛结束音效
        playFinishSound();
        
        playBtn.textContent = '🔄'; // 更换为重播图标
        playBtn.disabled = false;
        playBtn.classList.remove('pulse');
        playBtn.title = '重播'; // 更新提示文本
            
            // 找到得分最高的学生
            const sortedStudents = [...students].sort((a, b) => b.totalScore - a.totalScore);
            const firstPlaceStudent = sortedStudents.length > 0 ? sortedStudents[0] : null;
            
            // 3. 为第一名的青蛙添加皇冠图标
            if (firstPlaceStudent) {
                // 找到第一名的青蛙
                let firstPlaceFrog = null;
                frogs.forEach(frog => {
                    if (frog) {
                        const crownContainer = frog.querySelector('.crown');
                        const studentIndex = parseInt(frog.dataset.studentIndex);
                        
                        if (crownContainer) {
                            // 清空所有皇冠
                            crownContainer.innerHTML = '';
                            crownContainer.style.display = 'none';
                        }
                        
                        // 找到第一名的青蛙 - 同时支持中英文属性名
                        if (!isNaN(studentIndex) && students[studentIndex]) {
                            const currentStudent = students[studentIndex];
                            const firstPlaceName = firstPlaceStudent.姓名 || firstPlaceStudent.name;
                            const currentStudentName = currentStudent.姓名 || currentStudent.name;
                            
                            if (currentStudentName === firstPlaceName) {
                                firstPlaceFrog = frog;
                            }
                        }
                    }
                });
                
                // 如果找到第一名的青蛙，添加皇冠动画
                if (firstPlaceFrog) {
                    // 创建一个临时的皇冠元素，用于中央放大动画
                    const tempCrown = document.createElement('div');
                    tempCrown.textContent = '👑';
                    tempCrown.style.position = 'fixed';
                    tempCrown.style.top = '50%';
                    tempCrown.style.left = '50%';
                    tempCrown.style.transform = 'translate(-50%, -50%)';
                    tempCrown.style.fontSize = '80px';
                    tempCrown.style.zIndex = '1000';
                    tempCrown.style.opacity = '0';
                    tempCrown.style.textShadow = '0 0 20px rgba(255, 215, 0, 1), 0 0 40px rgba(255, 215, 0, 0.8)';
                    document.body.appendChild(tempCrown);
                    
                    // 中央放大动画 - 使用requestAnimationFrame提高性能
                    requestAnimationFrame(() => {
                        tempCrown.style.transition = 'all 2s cubic-bezier(0.34, 1.56, 0.64, 1)'; // 延长到2秒
                        tempCrown.style.opacity = '1';
                        tempCrown.style.fontSize = '120px';
                        
                        // 动画完成后，移动到青蛙头顶
                        setTimeout(() => {
                            // 获取青蛙在页面中的位置
                            const frogRect = firstPlaceFrog.getBoundingClientRect();
                            const crownContainer = firstPlaceFrog.querySelector('.crown');
                            
                            if (crownContainer) {
                                // 计算皇冠最终位置
                                const finalLeft = frogRect.left + frogRect.width / 2;
                                const finalTop = frogRect.top;
                                
                                // 移动皇冠到青蛙头顶
                                tempCrown.style.transition = 'all 2s cubic-bezier(0.34, 1.56, 0.64, 1)'; // 延长到2秒
                                tempCrown.style.left = `${finalLeft}px`;
                                tempCrown.style.top = `${finalTop - 20}px`;
                                tempCrown.style.fontSize = '24px';
                                
                                // 移动完成后，将皇冠添加到青蛙的crown容器中
                                setTimeout(() => {
                                    if (crownContainer && tempCrown.parentNode) {
                                        crownContainer.innerHTML = '👑';
                                        crownContainer.style.display = 'block';
                                        tempCrown.parentNode.removeChild(tempCrown);
                                        
                                        // 皇冠动画结束后显示排行榜
                                        showLeaderboard();
                                    }
                                }, 2000); // 对应延长到2秒
                            } else {
                                // 如果没有找到crown容器，直接移除临时皇冠
                                if (tempCrown.parentNode) {
                                    tempCrown.parentNode.removeChild(tempCrown);
                                }
                            }
                        }, 2000); // 对应延长到2秒
                    });
                }
            }
            
            // 4. 延迟显示烟花效果，避免与皇冠动画同时运行
            // setTimeout(() => {
            //     showFireworks();
            // }, 600);
            
            // 5. 排行榜显示已在皇冠动画完成后处理（见第983行）
        }
    }, raceTime + 200);
}



// 智能随机洗牌算法
// 智能赛道分配函数：将学生分为高分、中分、低分三组，然后从每组随机选择学生组成赛道
function assignStudentsToTracks() {
    if (students.length <= 3) {
        return [...students].sort(() => Math.random() - 0.5);
    }
    
    // 按成绩从高到低排序
    const sortedStudents = [...students].sort((a, b) => b.totalScore - a.totalScore);
    
    // 将学生分为三组：高分、中分、低分
    const groupSize = Math.ceil(sortedStudents.length / 3);
    const topGroup = sortedStudents.slice(0, groupSize);
    const midGroup = sortedStudents.slice(groupSize, groupSize * 2);
    const lowGroup = sortedStudents.slice(groupSize * 2);
    
    // 创建结果数组
    const result = [];
    
    // 创建临时数组来跟踪已经选择的学生
    const topTemp = [...topGroup];
    const midTemp = [...midGroup];
    const lowTemp = [...lowGroup];
    
    // 随机打乱每个组
    shuffleArray(topTemp);
    shuffleArray(midTemp);
    shuffleArray(lowTemp);
    
    // 为每个赛道分配学生
    while (topTemp.length > 0 || midTemp.length > 0 || lowTemp.length > 0) {
        // 从每个组中随机选择一个学生（如果组中还有学生）
        if (topTemp.length > 0) {
            result.push(topTemp.pop());
        }
        if (midTemp.length > 0) {
            result.push(midTemp.pop());
        }
        if (lowTemp.length > 0) {
            result.push(lowTemp.pop());
        }
    }
    
    return result;
}

// 辅助函数：随机打乱数组
function shuffleArray(array) {
    if (!Array.isArray(array)) return;
    
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

// 显示成绩窗口
function showStudentScore(student) {
    if (!student) return;
    // 检查学生是否有成绩或成绩是否为0
    const hasValidScore = student.totalScore > 0;
    if (!hasValidScore) {
        return; // 不显示成绩为0的学生
    }
    
    if (!scoreWindow || !scoreWindowTitle || !scoreContent) {
        console.error('成绩窗口元素未找到');
        return;
    }
    
    // 确定学生排名
    const sortedStudents = [...students].sort((a, b) => b.totalScore - a.totalScore);
    const studentName = student.姓名 || student.name || '未知';
    const rank = sortedStudents.findIndex(s => s.姓名 === studentName || s.name === studentName) + 1;
    
    // 添加排名标识（只显示前三名图标）
    let rankIcon = '';
    if (rank === 1) rankIcon = '🏆';
    else if (rank === 2) rankIcon = '🥈';
    else if (rank === 3) rankIcon = '🥉';
    
    // 计算各科目的最高分
    const subjectMaxScores = {};
    // 首先获取所有科目列表
    const allSubjects = new Set(selectedSubjects); // 使用预定义的科目列表
    
    // 然后计算每个科目的最高分
    allSubjects.forEach(subject => {
        subjectMaxScores[subject] = Math.max(...students.map(s => {
            return s.scores ? (s.scores[subject] || 0) : (s[subject] || 0);
        }));
    });
    // 计算总分的最高分
    const totalMaxScore = Math.max(...students.map(s => s.totalScore || 0));
    
    let scoreHTML = '<table>';
    scoreHTML += '<tr><th>科目</th><th>分数</th></tr>';
    
    // 过滤掉成绩为0或空的科目，同时跳过总分相关的科目
    allSubjects.forEach(subject => {
        const score = student.scores ? (student.scores[subject] || 0) : (student[subject] || 0);
        if (score > 0) { // 跳过分数为0的科目
            // 检查是否是该科目的第一名
            const isTop = score === subjectMaxScores[subject];
            const topText = isTop ? '<span class="subject-top">Top</span>' : '';
            scoreHTML += `<tr><td>${subject}</td><td>${score}${topText}</td></tr>`;
        }
    });
    
    // 单独添加总分，并检查是否是总分第一名
    const isTotalTop = student.totalScore === totalMaxScore;
            const totalTopText = isTotalTop ? '<span class="subject-top">Top</span>' : '';
            scoreHTML += `<tr style="font-weight: bold;"><td>总分</td><td>${student.totalScore.toFixed(1)}${totalTopText}</td></tr>`;
    // 添加排名信息
    scoreHTML += `<tr style="font-weight: bold; background-color: #f0f0f0;"><td>排名</td><td>${rank} / ${students.length}</td></tr>`;
    scoreHTML += '</table>';

    // 检查当前成绩窗口是否已经显示
    const isCurrentlyVisible = scoreWindow.style.display === 'block' && scoreWindow.style.opacity === '1';
    
    if (isCurrentlyVisible) {
        // 如果已经显示，先隐藏，然后再显示新的成绩
        scoreWindow.style.opacity = '0';
        scoreWindow.style.transform = 'translate(-50%, 0) scale(0.5)';
        
        setTimeout(() => {
            // 设置窗口标题
            scoreWindowTitle.innerHTML = `${rankIcon} ${studentName}的成绩`;

            // 更新成绩内容
            scoreContent.innerHTML = scoreHTML;

            // 应用前三名样式
            scoreWindow.classList.remove('gold', 'silver', 'bronze');
            if (rank === 1) {
                scoreWindow.classList.add('gold');
            } else if (rank === 2) {
                scoreWindow.classList.add('silver');
            } else if (rank === 3) {
                scoreWindow.classList.add('bronze');
            }

            // 显示新的成绩
            scoreWindow.style.opacity = '1';
            scoreWindow.style.transform = 'translate(-50%, 0) scale(0.7)';
        }, 300); // 等待隐藏动画完成，与CSS过渡时间匹配
    } else {
        // 如果没有显示，直接设置内容并显示
        // 设置窗口标题
        scoreWindowTitle.innerHTML = `${rankIcon} ${studentName}的成绩`;

        // 更新成绩内容
        scoreContent.innerHTML = scoreHTML;

        // 应用前三名样式
        scoreWindow.classList.remove('gold', 'silver', 'bronze');
        if (rank === 1) {
            scoreWindow.classList.add('gold');
        } else if (rank === 2) {
            scoreWindow.classList.add('silver');
        } else if (rank === 3) {
            scoreWindow.classList.add('bronze');
        }

        // 添加过渡动画
        scoreWindow.style.opacity = '0';
        scoreWindow.style.transform = 'translate(-50%, 0) scale(0.5)';
        scoreWindow.style.display = 'block';
        
        // 使用setTimeout触发动画
        setTimeout(() => {
            if (scoreWindow) {
                scoreWindow.style.opacity = '1';
                scoreWindow.style.transform = 'translate(-50%, 0) scale(0.7)';
            }
        }, 50);
    }
}

// 隐藏成绩窗口
function hideScoreWindow() {
    if (!scoreWindow) return;
    
    if (scoreWindow.style.display === 'block') {
        // 添加淡出动画
        scoreWindow.style.opacity = '0';
        scoreWindow.style.transform = 'translate(-50%, 0) scale(0.5)';
        
        // 动画完成后隐藏
        const hideTimeout = setTimeout(() => {
            if (scoreWindow && scoreWindow.parentNode) {
                scoreWindow.style.display = 'none';
            }
            clearTimeout(hideTimeout); // 清理定时器
        }, 300);
    }
}

// 显示导入提示
function showImportNotice(message, isSuccess) {
    if (!importNotice) return;
    
    importNotice.textContent = message;
    importNotice.className = 'import-notice';
    
    if (isSuccess) {
        importNotice.style.backgroundColor = '#4CAF50';
        // 3秒后隐藏
        const hideTimeout = setTimeout(() => {
            if (importNotice && importNotice.parentNode) {
                importNotice.classList.add('hidden');
            }
            clearTimeout(hideTimeout); // 清理定时器
        }, 3000);
    } else {
        importNotice.style.backgroundColor = '#ff9800';
        // 不自动隐藏
        importNotice.classList.remove('hidden');
    }
}

// 更新按钮显示状态
function updateButtonVisibility(state) {
    // 确保所有按钮都存在
    if (!settingsBtn || !playBtn) return;
    
    // 始终显示设置和播放按钮
    settingsBtn.style.display = 'inline-block';
    
    switch(state) {
        case 'initial':
            // 初始状态：仅显示设置按钮
            playBtn.style.display = 'none';
            if (leaderboardButton) leaderboardButton.style.display = 'none';
            break;
        case 'imported':
            // 导入后：显示播放按钮，隐藏切换按钮
            playBtn.style.display = 'inline-block';
            if (leaderboardButton) leaderboardButton.style.display = 'none';
            break;
        case 'leaderboard_open':
            // 打开排行榜时：显示播放按钮，隐藏切换按钮
            playBtn.style.display = 'inline-block';
            if (leaderboardButton) leaderboardButton.style.display = 'none';
            break;
        case 'leaderboard_closed':
            // 关闭排行榜时：显示播放按钮，隐藏切换按钮
            playBtn.style.display = 'inline-block';
            if (leaderboardButton) leaderboardButton.style.display = 'none';
            break;
        case 'scores_panel_open':
            // 打开成绩榜单时：显示播放按钮和切换到排行榜的按钮
            playBtn.style.display = 'inline-block';
            if (leaderboardButton) leaderboardButton.style.display = 'inline-block';
            break;
    }
}

// 显示排行榜
function showLeaderboard() {
    if (!leaderboard || !rankings) {
        console.error('排行榜元素未找到');
        return;
    }
    
    // 检查排行榜是否已经显示，避免重复触发
    if (leaderboard.style.display === 'block') {
        return;
    }
    
    // 排行榜打开时：隐藏切换到排行榜的按钮
    updateButtonVisibility('leaderboard_open');
    
    // 先移除所有现有事件监听器
    while (rankings.firstChild) {
        rankings.removeChild(rankings.firstChild);
    }
    
    // 根据成绩排序
    const sortedStudents = [...students].sort((a, b) => b.totalScore - a.totalScore);
    
    // 创建排行榜，显示所有学生
    sortedStudents.forEach((student, index) => {
        const li = document.createElement('li');
        
        // 前三名用金银铜牌代替序号
        let rankDisplay;
        if (index === 0) {
            rankDisplay = '🏆'; // 金牌
            li.classList.add('gold');
        } else if (index === 1) {
            rankDisplay = '🥈'; // 银牌
            li.classList.add('silver');
        } else if (index === 2) {
            rankDisplay = '🥉'; // 铜牌
            li.classList.add('bronze');
        } else {
            rankDisplay = `${index + 1}.`;
        }
        
        // 使用CSS样式分隔姓名和成绩，不使用横杠，添加排名显示
        const studentName = student.姓名 || student.name || '未知';
        li.innerHTML = `<span class="rank">${rankDisplay}</span><span class="student-name">${studentName}</span><span class="student-score">${student.totalScore.toFixed(1)}</span>`;
        
        // 添加点击事件
        const clickHandler = () => {
            showStudentScore(student);
        };
        li.addEventListener('click', clickHandler);
        
        // 设置初始样式，准备动画（如果启用）
        if (animationsEnabled) {
            li.style.opacity = '0';
            li.style.transform = 'translateY(20px)';
        } else {
            li.style.opacity = '1';
            li.style.transform = 'translateY(0)';
        }
        
        rankings.appendChild(li);
        
        // 添加依次出现的动画（如果启用）
        if (animationsEnabled) {
            setTimeout(() => {
                if (li.parentNode) { // 检查元素是否仍然存在
                    li.style.transition = `opacity 0.5s ease-out, transform 0.5s ease-out`;
                    li.style.opacity = '1';
                    li.style.transform = 'translateY(0)';
                }
            }, index * 100);
        }
    });
    
    // 显示排行榜，添加淡入和缩放动画（如果启用）
    leaderboard.style.display = 'block';
    
    if (animationsEnabled) {
        leaderboard.style.opacity = '0';
        leaderboard.style.transform = 'translateY(-30px) scale(0.95)';
        
        // 触发重排
        void leaderboard.offsetWidth;
        
        // 应用优化后的动画
        leaderboard.style.transition = 'opacity 0.5s ease-out, transform 0.5s ease-out';
        leaderboard.style.opacity = '1';
        leaderboard.style.transform = 'translateY(0) scale(1)';
    } else {
        leaderboard.style.opacity = '1';
        leaderboard.style.transform = 'scale(1)';
        leaderboard.style.transition = 'none';
    }
}

// 隐藏排行榜
function hideLeaderboard() {
    // 排行榜关闭时：显示排行榜按钮，隐藏成绩榜单按钮
    updateButtonVisibility('leaderboard_closed');
    
    if (animationsEnabled) {
        // 添加淡出和缩放动画
        leaderboard.style.transition = 'opacity 0.5s ease-out, transform 0.5s ease-out';
        leaderboard.style.opacity = '0';
        leaderboard.style.transform = 'scale(0.8)';
        
        // 动画结束后隐藏元素
        setTimeout(() => {
            leaderboard.style.display = 'none';
        }, 500);
    } else {
        // 无动画，直接隐藏
        leaderboard.style.display = 'none';
    }
}

// 点击外部区域关闭弹窗
function setupOutsideClick() {
    // 点击外部关闭成绩窗口
    outsideClickHandler = (e) => {
        if (scoreWindow && scoreWindow.style.display === 'block' && 
            !scoreWindow.contains(e.target)) {
            // 检查点击的元素是否是青蛙或排行榜项，如果是则不关闭成绩窗口
            if (!e.target.closest('.frog') && !e.target.closest('#leaderboard')) {
                hideScoreWindow();
            }
        }
    };
    
    document.addEventListener('click', outsideClickHandler);
}

// 清理点击外部区域关闭弹窗的事件监听器
function cleanupOutsideClick() {
    if (outsideClickHandler) {
        document.removeEventListener('click', outsideClickHandler);
        outsideClickHandler = null;
    }
}
