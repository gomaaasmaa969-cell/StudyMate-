var userSelection = { gradeKey: null, trackId: null, specializationId: null };
var activeSubjectId = null;
var timerSeconds = 25 * 60;
var timerInterval = null;

function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, function(char) {
        return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char];
    });
}

function readJSON(key, fallback) {
    try {
        var value = localStorage.getItem(key);
        return value ? JSON.parse(value) : fallback;
    } catch (error) {
        console.warn('تعذر قراءة البيانات المحفوظة:', key, error);
        return fallback;
    }
}

function showStep(stepId) {
    var sections = document.querySelectorAll('.view-section');
    for (var i = 0; i < sections.length; i++) sections[i].classList.add('hidden');

    var target = document.getElementById(stepId);
    if (target) target.classList.remove('hidden');

    if (stepId === 'step-timer') updateTimerDisplay();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function openPage(pageId) {
    if (pageId === 'step-subjects') openSubjectsPage();
    else if (pageId === 'step-tasks') openTasksPage();
    else if (pageId === 'step-timer') openTimerPage();
    else if (pageId === 'step-progress') openProgressPage();
}

function selectGrade(gradeKey) {
    var gradeData = STUDY_DATA[gradeKey];
    if (!gradeData) {
        alert('النظام الدراسي غير متاح حاليًا.');
        return;
    }

    userSelection.gradeKey = gradeKey;
    userSelection.trackId = null;
    userSelection.specializationId = null;

    if (!gradeData.needsTrack) {
        finishSetup();
        return;
    }

    document.getElementById('track-step-title').textContent = gradeData.trackLabel;
    document.getElementById('selected-grade-subtitle').textContent = gradeData.title;
    document.getElementById('specialization-box').classList.add('hidden');
    document.getElementById('confirm-setup-btn').classList.add('hidden');

    var container = document.getElementById('tracks-container');
    container.innerHTML = '';

    gradeData.tracks.forEach(function(track) {
        var card = document.createElement('div');
        card.className = 'track-card';
        card.innerHTML = '<div class="track-emoji" style="color:' + track.color + '">' +
            escapeHTML(track.icon) + '</div><h4>' + escapeHTML(track.name) + '</h4>';
        card.onclick = function() { selectTrack(track, card); };
        container.appendChild(card);
    });

    showStep('step-track');
}

function selectTrack(track, cardEl) {
    userSelection.trackId = track.id;
    userSelection.specializationId = null;

    document.querySelectorAll('.track-card').forEach(function(card) {
        card.classList.remove('selected');
    });
    cardEl.classList.add('selected');

    var specBox = document.getElementById('specialization-box');
    var btn = document.getElementById('confirm-setup-btn');

    if (track.specializations && track.specializations.length) {
        btn.classList.add('hidden');
        specBox.classList.remove('hidden');
        var specCont = document.getElementById('specializations-container');
        specCont.innerHTML = '';

        track.specializations.forEach(function(spec) {
            var sCard = document.createElement('div');
            sCard.className = 'spec-card';
            sCard.innerHTML = '<span>' + escapeHTML(spec.icon) + '</span><span>' +
                escapeHTML(spec.name) + '</span>';
            sCard.onclick = function() {
                userSelection.specializationId = spec.id;
                document.querySelectorAll('.spec-card').forEach(function(item) {
                    item.classList.remove('selected');
                });
                sCard.classList.add('selected');
                btn.classList.remove('hidden');
            };
            specCont.appendChild(sCard);
        });
    } else {
        specBox.classList.add('hidden');
        btn.classList.remove('hidden');
    }
}

function finishSetup() {
    var gradeData = STUDY_DATA[userSelection.gradeKey];
    if (!gradeData) {
        alert('اختاري نظامك الدراسي أولاً.');
        showStep('step-system');
        return;
    }

    var finalSubjects = [];
    var trackName = '';

    if (!gradeData.needsTrack) {
        finalSubjects = gradeData.subjects.slice();
    } else {
        var selectedTrack = gradeData.tracks.find(function(track) {
            return track.id === userSelection.trackId;
        });

        if (!selectedTrack) {
            alert('اختاري المسار الدراسي أولاً.');
            showStep('step-track');
            return;
        }

        trackName = selectedTrack.name;
        if (selectedTrack.specializations) {
            var selectedSpec = selectedTrack.specializations.find(function(spec) {
                return spec.id === userSelection.specializationId;
            });
            if (!selectedSpec) {
                alert('اختاري المادة التخصصية أولاً.');
                return;
            }
            finalSubjects = gradeData.commonSubjects.concat([selectedSpec]);
        } else {
            finalSubjects = selectedTrack.subjects.slice();
        }
    }

    localStorage.setItem('studymate_profile', JSON.stringify({
        gradeTitle: gradeData.title,
        trackName: trackName,
        subjects: finalSubjects
    }));
    openSubjectsPage();
}

function openSubjectsPage() {
    var profile = readJSON('studymate_profile', null);
    if (!profile || !Array.isArray(profile.subjects)) {
        alert('اختاري نظامك الدراسي وسنتك أولاً!');
        showStep('step-system');
        return;
    }

    var allLessons = readJSON('studymate_lessons', {});
    var box = document.getElementById('step-subjects');

    var cardsHtml = profile.subjects.map(function(subject) {
        var lessons = allLessons[subject.id] || [];
        var done = lessons.filter(function(lesson) { return lesson.status === 'done'; }).length;
        var pct = lessons.length ? Math.round((done / lessons.length) * 100) : 0;
        return '<div class="system-card" onclick="openSubjectDetail(\'' + subject.id + '\')">' +
            '<div class="system-icon" style="background:#EFF6FF;">' + escapeHTML(subject.icon) + '</div>' +
            '<h3>' + escapeHTML(subject.name) + '</h3>' +
            '<p>' + done + ' من ' + lessons.length + ' دروس (' + pct + '%)</p>' +
            '<button type="button" class="grade-btn" style="width:100%;">فتح دروس المادة ←</button></div>';
    }).join('');

    box.innerHTML = '<div class="wizard-container">' +
        '<button type="button" class="btn-back" onclick="showStep(\'step-welcome\')">→ الرئيسية</button> ' +
        '<button type="button" class="btn-back" onclick="showStep(\'step-system\')">⚙️ تغيير النظام</button>' +
        '<div class="wizard-header"><span class="step-badge">' + escapeHTML(profile.gradeTitle) + '</span>' +
        '<h2>📚 موادي الدراسية</h2><p>' +
        escapeHTML(profile.trackName || 'اضغطي على المادة لإضافة الدروس') + '</p></div>' +
        '<div class="systems-grid">' + cardsHtml + '</div></div>';

    showStep('step-subjects');
}

function openSubjectDetail(subId) {
    var profile = readJSON('studymate_profile', null);
    if (!profile || !Array.isArray(profile.subjects)) {
        alert('اختاري نظامك الدراسي أولاً.');
        showStep('step-system');
        return;
    }

    var subject = profile.subjects.find(function(item) { return item.id === subId; });
    if (!subject) {
        alert('المادة غير موجودة في نظامك الدراسي.');
        return;
    }

    activeSubjectId = subId;
    var allLessons = readJSON('studymate_lessons', {});
    var lessons = allLessons[subId] || [];
    var done = lessons.filter(function(lesson) { return lesson.status === 'done'; }).length;
    var pct = lessons.length ? Math.round((done / lessons.length) * 100) : 0;

    var listHtml = lessons.length === 0
        ? '<p style="text-align:center;">لا توجد دروس بعد</p>'
        : lessons.map(function(lesson, index) {
            return '<div class="lesson-row" style="background:#fff;padding:12px;border-radius:15px;border:2px solid #E2E8F0;display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:10px;flex-wrap:wrap;">' +
                '<strong>' + escapeHTML(lesson.name) + '</strong><div>' +
                '<select onchange="setLessonStatus(' + index + ', this.value)" style="padding:6px;border-radius:10px;">' +
                '<option value="not_started" ' + (lesson.status === 'not_started' ? 'selected' : '') + '>⚪ لم أبدأ</option>' +
                '<option value="in_progress" ' + (lesson.status === 'in_progress' ? 'selected' : '') + '>🔵 قيد الدراسة</option>' +
                '<option value="done" ' + (lesson.status === 'done' ? 'selected' : '') + '>🟢 اكتمل</option>' +
                '<option value="review" ' + (lesson.status === 'review' ? 'selected' : '') + '>🟡 مراجعة</option></select> ' +
                '<button type="button" onclick="delLesson(' + index + ')" style="background:#FEE2E2;color:#DC2626;border:none;padding:6px 10px;border-radius:10px;">حذف</button>' +
                '</div></div>';
        }).join('');

    document.getElementById('step-subject-detail').innerHTML =
        '<div class="wizard-container"><button type="button" class="btn-back" onclick="openSubjectsPage()">→ رجوع لموادي</button>' +
        '<div class="wizard-header"><h2>' + escapeHTML(subject.icon) + ' ' + escapeHTML(subject.name) +
        '</h2><p>الإنجاز: ' + pct + '% (' + done + '/' + lessons.length + ')</p></div>' +
        '<div style="display:flex;gap:10px;margin-bottom:20px;flex-wrap:wrap;">' +
        '<input id="inp-lesson" placeholder="اكتبي اسم الدرس..." style="flex:1;min-width:150px;padding:12px;border-radius:14px;border:2px solid #CBD5E1;">' +
        '<button type="button" class="btn-primary" style="padding:12px 20px;" onclick="addLesson()">+ إضافة</button></div>' +
        listHtml + '</div>';

    showStep('step-subject-detail');
}

function addLesson() {
    var input = document.getElementById('inp-lesson');
    var name = input ? input.value.trim() : '';
    if (!name) return;

    var all = readJSON('studymate_lessons', {});
    if (!all[activeSubjectId]) all[activeSubjectId] = [];
    all[activeSubjectId].push({ name: name, status: 'not_started' });
    localStorage.setItem('studymate_lessons', JSON.stringify(all));
    openSubjectDetail(activeSubjectId);
}

function setLessonStatus(index, status) {
    var all = readJSON('studymate_lessons', {});
    if (!all[activeSubjectId] || !all[activeSubjectId][index]) return;
    all[activeSubjectId][index].status = status;
    localStorage.setItem('studymate_lessons', JSON.stringify(all));
    openSubjectDetail(activeSubjectId);
}

function delLesson(index) {
    var all = readJSON('studymate_lessons', {});
    if (!all[activeSubjectId] || !all[activeSubjectId][index]) return;
    all[activeSubjectId].splice(index, 1);
    localStorage.setItem('studymate_lessons', JSON.stringify(all));
    openSubjectDetail(activeSubjectId);
}

function openTasksPage() {
    var tasks = readJSON('studymate_tasks', []);
    var listHtml = tasks.length === 0
        ? '<p style="text-align:center;">لا توجد مهام بعد</p>'
        : tasks.map(function(task, index) {
            return '<div style="background:#fff;padding:12px;border-radius:15px;border:2px solid #E2E8F0;display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:10px;flex-wrap:wrap;">' +
                '<label><input type="checkbox" ' + (task.done ? 'checked' : '') + ' onchange="toggleTask(' + index + ')"> ' +
                '<strong style="' + (task.done ? 'text-decoration:line-through;opacity:0.6' : '') + '">' +
                escapeHTML(task.title) + '</strong></label>' +
                '<button type="button" onclick="delTask(' + index + ')" style="background:#FEE2E2;color:#DC2626;border:none;padding:6px 10px;border-radius:10px;">حذف</button></div>';
        }).join('');

    document.getElementById('step-tasks').innerHTML =
        '<div class="wizard-container"><button type="button" class="btn-back" onclick="showStep(\'step-welcome\')">→ الرئيسية</button>' +
        '<div class="wizard-header"><h2>✅ إدارة المهام</h2></div>' +
        '<div style="display:flex;gap:10px;margin-bottom:20px;flex-wrap:wrap;">' +
        '<input id="inp-task" placeholder="اكتبي المهمة..." style="flex:1;min-width:150px;padding:12px;border-radius:14px;border:2px solid #CBD5E1;">' +
        '<button type="button" class="btn-primary" style="padding:12px 20px;" onclick="addTask()">+ إضافة</button></div>' +
        listHtml + '</div>';

    showStep('step-tasks');
}

function addTask() {
    var input = document.getElementById('inp-task');
    var title = input ? input.value.trim() : '';
    if (!title) return;

    var tasks = readJSON('studymate_tasks', []);
    tasks.unshift({ title: title, done: false });
    localStorage.setItem('studymate_tasks', JSON.stringify(tasks));
    openTasksPage();
}

function toggleTask(index) {
    var tasks = readJSON('studymate_tasks', []);
    if (!tasks[index]) return;
    tasks[index].done = !tasks[index].done;
    localStorage.setItem('studymate_tasks', JSON.stringify(tasks));
    openTasksPage();
}

function delTask(index) {
    var tasks = readJSON('studymate_tasks', []);
    if (!tasks[index]) return;
    tasks.splice(index, 1);
    localStorage.setItem('studymate_tasks', JSON.stringify(tasks));
    openTasksPage();
}

function updateTimerDisplay() {
    var display = document.getElementById('t-disp');
    if (!display) return;
    var minutes = String(Math.floor(timerSeconds / 60)).padStart(2, '0');
    var seconds = String(timerSeconds % 60).padStart(2, '0');
    display.textContent = minutes + ':' + seconds;
}

function openTimerPage() {
    document.getElementById('step-timer').innerHTML =
        '<div class="wizard-container" style="text-align:center;">' +
        '<div style="text-align:right;"><button type="button" class="btn-back" onclick="showStep(\'step-welcome\')">→ الرئيسية</button></div>' +
        '<div class="wizard-header"><h2>⏱️ مؤقت التركيز</h2></div>' +
        '<div id="t-disp" style="font-size:4rem;font-weight:900;color:var(--primary-blue);margin:20px 0;">25:00</div>' +
        '<button type="button" class="btn-primary" onclick="startT()">▶️ بدء</button> ' +
        '<button type="button" class="btn-back" onclick="pauseT()">⏸️ إيقاف</button> ' +
        '<button type="button" class="btn-back" onclick="saveT()">✅ إنهاء وحفظ</button></div>';

    showStep('step-timer');
    updateTimerDisplay();
}

function startT() {
    if (timerInterval || timerSeconds <= 0) return;

    timerInterval = setInterval(function() {
        if (timerSeconds > 0) {
            timerSeconds--;
            updateTimerDisplay();
        }
        if (timerSeconds <= 0) saveT(true);
    }, 1000);
}

function pauseT() {
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = null;
}

function saveT(completedNaturally) {
    pauseT();

    var elapsedSeconds = (25 * 60) - timerSeconds;
    var completedMinutes = Math.floor(elapsedSeconds / 60);

    if (completedMinutes < 1) {
        if (!completedNaturally) {
            alert('ابدئي المذاكرة لمدة دقيقة واحدة على الأقل قبل الحفظ.');
        }
        if (completedNaturally) timerSeconds = 25 * 60;
        updateTimerDisplay();
        return;
    }

    var total = Number(localStorage.getItem('studymate_minutes') || 0) + completedMinutes;
    localStorage.setItem('studymate_minutes', String(total));
    timerSeconds = 25 * 60;
    alert('تم حفظ ' + completedMinutes + ' دقيقة مذاكرة!');
    openTimerPage();
}

function openProgressPage() {
    var minutes = Number(localStorage.getItem('studymate_minutes') || 0);
    var tasks = readJSON('studymate_tasks', []);
    var doneTasks = tasks.filter(function(task) { return task.done; }).length;
    var profile = readJSON('studymate_profile', null);
    var lessonMap = readJSON('studymate_lessons', {});
    var lessonTotal = 0;
    var lessonDone = 0;

    if (profile && Array.isArray(profile.subjects)) {
        profile.subjects.forEach(function(subject) {
            var lessons = lessonMap[subject.id] || [];
            lessonTotal += lessons.length;
            lessonDone += lessons.filter(function(lesson) { return lesson.status === 'done'; }).length;
        });
    }

    document.getElementById('step-progress').innerHTML =
        '<div class="wizard-container"><button type="button" class="btn-back" onclick="showStep(\'step-welcome\')">→ الرئيسية</button>' +
        '<div class="wizard-header"><h2>📊 متابعة التقدم</h2></div>' +
        '<div class="systems-grid">' +
        '<div class="system-card"><h3>✅ المهام المنجزة</h3><p>' + doneTasks + ' من ' + tasks.length + '</p></div>' +
        '<div class="system-card"><h3>⏱️ وقت المذاكرة</h3><p>' + minutes + ' دقيقة</p></div>' +
        '<div class="system-card"><h3>📚 الدروس المكتملة</h3><p>' + lessonDone + ' من ' + lessonTotal + '</p></div>' +
        '</div></div>';

    showStep('step-progress');
}
