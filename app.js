// ============================================================
// ROTARACT CLUB ATTENDANCE MANAGEMENT SYSTEM
// Main Application Logic
// ============================================================

// ============================================================
// APPLICATION STATE
// ============================================================
const APP = {
  members: [],
  sessions: [],
  attendance: {},       // { memberId: { status, reason, remarks } }
  currentTab: 'dashboard',
  editingMemberId: null,
  currentReportSession: null,
  confirmCallback: null,
};

// ============================================================
// DOM HELPERS
// ============================================================
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

// ============================================================
// INITIALIZATION
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initNavigation();
  initAuthListener();
  setDefaultDate();
});

function setDefaultDate() {
  const dateInput = $('#attendance-date');
  if (dateInput) {
    dateInput.value = new Date().toISOString().split('T')[0];
  }
  const timeInput = $('#attendance-time');
  if (timeInput) {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    timeInput.value = `${hours}:${minutes}`;
  }
}

// ============================================================
// AUTHENTICATION
// ============================================================
function initAuthListener() {
  if (typeof auth === 'undefined' || !auth) {
    console.error('Firebase Auth service is not defined. Please check your firebase-config.js configuration.');
    const preloaderText = $('.preloader-text');
    if (preloaderText) {
      preloaderText.innerHTML = '<span style="color:var(--danger); font-weight:600;">Configuration Error: Firebase Auth is not defined.<br>Please set up your GitHub repository Secrets and push code to trigger the build.</span>';
      // Stop spinner animation to indicate error
      const spinner = $('.preloader-spinner');
      if (spinner) spinner.style.borderTopColor = 'var(--danger)';
    }
    return;
  }
  auth.onAuthStateChanged((user) => {
    const preloader = $('#preloader');
    if (user) {
      // User is signed in
      $('#login-screen').classList.add('hidden');
      $('#app').classList.remove('hidden');
      $('#admin-email-display').textContent = user.email.split('@')[0];
      $('#settings-admin-email').textContent = user.email;
      loadAppData();
    } else {
      // User is signed out
      $('#login-screen').classList.remove('hidden');
      $('#app').classList.add('hidden');
    }
    // Hide preloader
    setTimeout(() => {
      if (preloader) {
        preloader.classList.add('fade-out');
        setTimeout(() => preloader.remove(), 500);
      }
    }, 400);
  });

  // Login form
  $('#login-form').addEventListener('submit', handleLogin);
  // Logout button
  $('#logout-btn').addEventListener('click', handleLogout);
}

async function handleLogin(e) {
  e.preventDefault();
  const email = $('#login-email').value.trim();
  const password = $('#login-password').value;
  const errorEl = $('#login-error');
  const btn = $('#login-btn');

  if (!email || !password) {
    errorEl.textContent = 'Please enter email and password.';
    return;
  }

  btn.disabled = true;
  btn.querySelector('.login-btn-text').textContent = 'Signing in...';
  errorEl.textContent = '';

  try {
    await auth.signInWithEmailAndPassword(email, password);
  } catch (err) {
    let message = 'Login failed. Please try again.';
    if (err.code === 'auth/user-not-found') message = 'No account found with this email.';
    else if (err.code === 'auth/wrong-password') message = 'Incorrect password.';
    else if (err.code === 'auth/invalid-email') message = 'Invalid email address.';
    else if (err.code === 'auth/too-many-requests') message = 'Too many attempts. Try again later.';
    else if (err.code === 'auth/invalid-credential') message = 'Invalid credentials. Check email & password.';
    errorEl.textContent = message;
  } finally {
    btn.disabled = false;
    btn.querySelector('.login-btn-text').textContent = 'Sign In';
  }
}

async function handleLogout() {
  showConfirm('Sign Out', 'Are you sure you want to log out?', async () => {
    try {
      await auth.signOut();
      showToast('Signed out successfully', 'info');
    } catch (err) {
      showToast('Logout failed', 'error');
    }
  });
}

// ============================================================
// DATA LOADING
// ============================================================
async function loadAppData() {
  try {
    await Promise.all([fetchMembers(), fetchSessions()]);
    renderDashboard();
    renderAttendanceLists();
    renderMembersList();
    renderReportsList();
    updateSettingsCounts();
  } catch (err) {
    console.error('Error loading data:', err);
    showToast('Failed to load data. Check your connection.', 'error');
  }
}

async function fetchMembers() {
  try {
    const snapshot = await db.collection('members').orderBy('name').get();
    APP.members = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (err) {
    console.error('Error fetching members:', err);
    throw err;
  }
}

async function fetchSessions() {
  try {
    const snapshot = await db.collection('sessions').orderBy('date', 'desc').get();
    APP.sessions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (err) {
    console.error('Error fetching sessions:', err);
    throw err;
  }
}

// ============================================================
// THEME
// ============================================================
function initTheme() {
  const saved = localStorage.getItem('rotaract-theme') || 'light';
  applyTheme(saved);

  $('#theme-toggle-btn').addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    localStorage.setItem('rotaract-theme', next);
  });

  $('#theme-switch-input').addEventListener('change', (e) => {
    const next = e.target.checked ? 'dark' : 'light';
    applyTheme(next);
    localStorage.setItem('rotaract-theme', next);
  });
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  const icon = $('#theme-icon');
  if (icon) {
    icon.className = theme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
  }
  const switchInput = $('#theme-switch-input');
  if (switchInput) {
    switchInput.checked = theme === 'dark';
  }
}

// ============================================================
// NAVIGATION
// ============================================================
function initNavigation() {
  // Desktop tabs
  $$('.nav-tab').forEach(tab => {
    tab.addEventListener('click', () => switchTab(tab.dataset.tab));
  });
  // Mobile tabs
  $$('.mobile-nav-item').forEach(tab => {
    tab.addEventListener('click', () => switchTab(tab.dataset.tab));
  });
}

function switchTab(tabName) {
  APP.currentTab = tabName;

  // Update tab buttons
  $$('.nav-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tabName));
  $$('.mobile-nav-item').forEach(t => t.classList.toggle('active', t.dataset.tab === tabName));

  // Update tab content
  $$('.tab-content').forEach(section => {
    section.classList.toggle('active', section.id === `${tabName}-tab`);
  });

  // Refresh content for the active tab
  if (tabName === 'dashboard') renderDashboard();
  if (tabName === 'reports') renderReportsList();
  if (tabName === 'members') renderMembersList();
  if (tabName === 'attendance') renderAttendanceLists();
}

// ============================================================
// TOAST NOTIFICATIONS
// ============================================================
function showToast(message, type = 'info', title = '') {
  const container = $('#toast-container');
  const icons = {
    success: 'fa-check-circle',
    error: 'fa-exclamation-circle',
    warning: 'fa-exclamation-triangle',
    info: 'fa-info-circle'
  };
  const titles = {
    success: 'Success',
    error: 'Error',
    warning: 'Warning',
    info: 'Info'
  };

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <i class="fas ${icons[type]} toast-icon"></i>
    <div class="toast-content">
      <div class="toast-title">${title || titles[type]}</div>
      <div class="toast-message">${message}</div>
    </div>
    <button class="toast-close" onclick="this.parentElement.classList.add('toast-exit'); setTimeout(()=>this.parentElement.remove(),300);">&times;</button>
  `;

  container.appendChild(toast);

  // Auto remove after 4 seconds
  setTimeout(() => {
    if (toast.parentElement) {
      toast.classList.add('toast-exit');
      setTimeout(() => toast.remove(), 300);
    }
  }, 4000);
}

// ============================================================
// CONFIRM DIALOG
// ============================================================
function showConfirm(title, message, onConfirm, type = 'warning') {
  const modal = $('#confirm-modal');
  const iconEl = $('#confirm-icon');
  const msgEl = $('#confirm-message');
  const subMsgEl = $('#confirm-sub-message');
  const okBtn = $('#confirm-ok-btn');

  msgEl.textContent = title;
  subMsgEl.textContent = message;
  iconEl.className = `confirm-icon ${type}`;
  iconEl.innerHTML = type === 'danger'
    ? '<i class="fas fa-trash-alt"></i>'
    : '<i class="fas fa-exclamation-triangle"></i>';

  okBtn.className = type === 'danger' ? 'btn btn-danger' : 'btn btn-danger';
  okBtn.textContent = 'Confirm';

  APP.confirmCallback = onConfirm;
  okBtn.onclick = () => {
    hideModal('confirm-modal');
    if (APP.confirmCallback) APP.confirmCallback();
    APP.confirmCallback = null;
  };

  showModal('confirm-modal');
}

// ============================================================
// MODAL HELPERS
// ============================================================
function showModal(id) {
  const modal = $(`#${id}`);
  if (modal) modal.classList.add('active');
}

function hideModal(id) {
  const modal = $(`#${id}`);
  if (modal) modal.classList.remove('active');
}

// Close modals on overlay click
document.addEventListener('click', (e) => {
  if (e.target.classList.contains('modal-overlay')) {
    e.target.classList.remove('active');
  }
});

// Close modals on Escape
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    $$('.modal-overlay.active').forEach(m => m.classList.remove('active'));
  }
});

// ============================================================
// MEMBERS MODULE
// ============================================================

function getMembersByCategory(category) {
  return APP.members.filter(m => m.category === category);
}

function openAddMemberModal(presetCategory = '') {
  APP.editingMemberId = null;
  $('#member-modal-title').textContent = 'Add Member';
  $('#member-save-btn').innerHTML = '<i class="fas fa-save"></i> Save Member';
  $('#member-form').reset();
  $('#member-edit-id').value = '';
  if (presetCategory) {
    $('#member-category-input').value = presetCategory;
  }
  showModal('member-modal');
  setTimeout(() => $('#member-name-input').focus(), 200);
}

function openEditMemberModal(memberId) {
  const member = APP.members.find(m => m.id === memberId);
  if (!member) return;

  APP.editingMemberId = memberId;
  $('#member-modal-title').textContent = 'Edit Member';
  $('#member-save-btn').innerHTML = '<i class="fas fa-save"></i> Update Member';
  $('#member-edit-id').value = memberId;
  $('#member-name-input').value = member.name || '';
  $('#member-category-input').value = member.category || '';
  $('#member-role-input').value = member.role || '';
  $('#member-dept-input').value = member.department || '';
  $('#member-year-input').value = member.year || '';
  $('#member-phone-input').value = member.phone || '';
  $('#member-email-input').value = member.email || '';

  showModal('member-modal');
  setTimeout(() => $('#member-name-input').focus(), 200);
}

async function saveMember() {
  const name = $('#member-name-input').value.trim();
  const category = $('#member-category-input').value;
  const role = $('#member-role-input').value.trim();
  const department = $('#member-dept-input').value.trim();
  const year = $('#member-year-input').value.trim();
  const phone = $('#member-phone-input').value.trim();
  const email = $('#member-email-input').value.trim();

  // Validation
  if (!name) {
    showToast('Please enter a full name.', 'warning');
    $('#member-name-input').focus();
    return;
  }
  if (!category) {
    showToast('Please select a category.', 'warning');
    $('#member-category-input').focus();
    return;
  }

  // Normalize name for duplicate check
  const normalizedName = name.toLowerCase().trim();

  // Check for duplicates (same name + category, excluding current edit)
  const duplicate = APP.members.find(m =>
    m.name.toLowerCase().trim() === normalizedName &&
    m.category === category &&
    m.id !== APP.editingMemberId
  );

  if (duplicate) {
    showToast(`"${name}" already exists in ${category} category.`, 'warning');
    return;
  }

  const memberData = {
    name,
    category,
    role,
    department,
    year,
    phone,
    email,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  };

  try {
    if (APP.editingMemberId) {
      // Update existing member
      await db.collection('members').doc(APP.editingMemberId).update(memberData);
      showToast(`${name} updated successfully.`, 'success');
    } else {
      // Add new member
      memberData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
      await db.collection('members').add(memberData);
      showToast(`${name} added successfully.`, 'success');
    }

    hideModal('member-modal');
    await fetchMembers();
    renderMembersList();
    renderAttendanceLists();
    renderDashboard();
    updateSettingsCounts();

  } catch (err) {
    console.error('Error saving member:', err);
    showToast('Failed to save member. Please try again.', 'error');
  }
}

function deleteMember(memberId) {
  const member = APP.members.find(m => m.id === memberId);
  if (!member) return;

  showConfirm(
    `Delete "${member.name}"?`,
    'This will remove the member from the database. Past attendance records will be preserved.',
    async () => {
      try {
        await db.collection('members').doc(memberId).delete();
        showToast(`${member.name} deleted.`, 'success');
        await fetchMembers();
        renderMembersList();
        renderAttendanceLists();
        renderDashboard();
        updateSettingsCounts();
      } catch (err) {
        console.error('Error deleting member:', err);
        showToast('Failed to delete member.', 'error');
      }
    },
    'danger'
  );
}

// ---- Render Members List ----
function renderMembersList() {
  const container = $('#members-grid');
  const searchQuery = ($('#member-search')?.value || '').toLowerCase();
  const filterCategory = $('#member-category-filter')?.value || 'all';

  let filtered = APP.members;

  if (filterCategory !== 'all') {
    filtered = filtered.filter(m => m.category === filterCategory);
  }

  if (searchQuery) {
    filtered = filtered.filter(m =>
      (m.name || '').toLowerCase().includes(searchQuery) ||
      (m.role || '').toLowerCase().includes(searchQuery) ||
      (m.department || '').toLowerCase().includes(searchQuery) ||
      (m.email || '').toLowerCase().includes(searchQuery)
    );
  }

  // Render category chips
  renderMemberChips();

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="empty-state" style="grid-column:1/-1;">
        <div class="empty-state-icon"><i class="fas fa-users-slash"></i></div>
        <h3>No members found</h3>
        <p>${searchQuery ? 'Try a different search term' : 'Add your first member to get started'}</p>
      </div>`;
    return;
  }

  container.innerHTML = filtered.map(m => {
    const avatarClass = m.category === 'Board Official' ? 'board'
      : m.category === 'Rotaractor' ? 'rotaractor' : 'other';
    const badgeClass = m.category === 'Board Official' ? 'badge-board'
      : m.category === 'Rotaractor' ? 'badge-rotaractor' : 'badge-other';
    const initials = (m.name || 'U').split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();

    return `
      <div class="member-card">
        <div class="member-avatar ${avatarClass}">${initials}</div>
        <div class="member-info">
          <div class="member-name">${escapeHtml(m.name)}</div>
          <div class="member-role">${escapeHtml(m.role || 'Member')} <span class="badge ${badgeClass}">${m.category}</span></div>
          ${m.department || m.year ? `<div class="member-details">${escapeHtml(m.department || '')}${m.department && m.year ? ' · ' : ''}${escapeHtml(m.year || '')}</div>` : ''}
        </div>
        <div class="member-actions">
          <button class="btn-icon" onclick="openEditMemberModal('${m.id}')" title="Edit"><i class="fas fa-pen"></i></button>
          <button class="btn-icon danger" onclick="deleteMember('${m.id}')" title="Delete"><i class="fas fa-trash-alt"></i></button>
        </div>
      </div>`;
  }).join('');
}

function renderMemberChips() {
  const container = $('#member-category-chips');
  const boardCount = APP.members.filter(m => m.category === 'Board Official').length;
  const rotaractorCount = APP.members.filter(m => m.category === 'Rotaractor').length;
  const otherCount = APP.members.filter(m => m.category === 'Other Rotaractor').length;

  container.innerHTML = `
    <div class="chip"><i class="fas fa-users"></i> All Members <span class="chip-count">${APP.members.length}</span></div>
    <div class="chip"><i class="fas fa-user-tie"></i> Board Officials <span class="chip-count">${boardCount}</span></div>
    <div class="chip"><i class="fas fa-user"></i> Rotaractors <span class="chip-count">${rotaractorCount}</span></div>
    <div class="chip"><i class="fas fa-user-friends"></i> Others <span class="chip-count">${otherCount}</span></div>
  `;
}

// Members search & filter event listeners
document.addEventListener('DOMContentLoaded', () => {
  const searchEl = $('#member-search');
  const filterEl = $('#member-category-filter');
  if (searchEl) searchEl.addEventListener('input', debounce(renderMembersList, 250));
  if (filterEl) filterEl.addEventListener('change', renderMembersList);
});

// ============================================================
// ATTENDANCE MODULE
// ============================================================

function renderAttendanceLists() {
  renderCategoryAttendance('Board Official', '#board-officials-list', '#board-count-badge');
  renderCategoryAttendance('Rotaractor', '#rotaractors-list', '#rotaractor-count-badge');
  renderCategoryAttendance('Other Rotaractor', '#other-rotaractors-list', '#other-count-badge');
  updateAttendanceCounts();
}

function renderCategoryAttendance(category, containerSel, countSel) {
  const container = $(containerSel);
  const countEl = $(countSel);
  const members = getMembersByCategory(category);

  if (countEl) countEl.textContent = members.length;

  if (members.length === 0) {
    container.innerHTML = `
      <div class="empty-state" style="padding:24px;">
        <p style="color:var(--text-tertiary); font-size:0.85rem;">No ${category.toLowerCase()}s added yet</p>
      </div>`;
    return;
  }

  container.innerHTML = members.map(m => {
    const att = APP.attendance[m.id] || {};
    const presentActive = att.status === 'Present' ? 'present-active' : '';
    const absentActive = att.status === 'Absent' ? 'absent-active' : '';
    const lateActive = att.status === 'Late' ? 'late-active' : '';
    const markedClass = att.status ? `marked-${att.status.toLowerCase()}` : '';
    const showReason = att.status === 'Absent';

    return `
      <div class="attendance-item ${markedClass}" id="att-item-${m.id}">
        <div class="attendance-member-info">
          <div class="attendance-member-name">${escapeHtml(m.name)}</div>
          <div class="attendance-member-role">${escapeHtml(m.role || 'Member')}</div>
        </div>
        <div class="attendance-status-btns">
          <button class="status-btn ${presentActive}" onclick="markAttendance('${m.id}', 'Present')" title="Present">
            <i class="fas fa-check"></i> P
          </button>
          <button class="status-btn ${absentActive}" onclick="markAttendance('${m.id}', 'Absent')" title="Absent">
            <i class="fas fa-times"></i> A
          </button>
          <button class="status-btn ${lateActive}" onclick="markAttendance('${m.id}', 'Late')" title="Late">
            <i class="fas fa-clock"></i> L
          </button>
        </div>
      </div>
      ${showReason ? `
        <div class="attendance-reason" id="reason-${m.id}">
          <input type="text" placeholder="Reason for absence (optional)" value="${escapeHtml(att.reason || '')}" onchange="updateReason('${m.id}', this.value)" style="max-width:100%;">
        </div>` : ''}
    `;
  }).join('');
}

function markAttendance(memberId, status) {
  if (!APP.attendance[memberId]) {
    APP.attendance[memberId] = {};
  }

  // Toggle: if already set to same status, unmark
  if (APP.attendance[memberId].status === status) {
    delete APP.attendance[memberId].status;
    delete APP.attendance[memberId].reason;
  } else {
    APP.attendance[memberId].status = status;
    if (status !== 'Absent') {
      delete APP.attendance[memberId].reason;
    }
  }

  renderAttendanceLists();
}

function updateReason(memberId, reason) {
  if (APP.attendance[memberId]) {
    APP.attendance[memberId].reason = reason;
  }
}

function markAllStatus(category, status) {
  const members = getMembersByCategory(category);
  members.forEach(m => {
    if (!APP.attendance[m.id]) APP.attendance[m.id] = {};
    APP.attendance[m.id].status = status;
    if (status !== 'Absent') delete APP.attendance[m.id].reason;
  });
  renderAttendanceLists();
  showToast(`All ${category}s marked as ${status}.`, 'info');
}

function clearCategoryAttendance(category) {
  const members = getMembersByCategory(category);
  members.forEach(m => {
    delete APP.attendance[m.id];
  });
  renderAttendanceLists();
  showToast(`${category} attendance cleared.`, 'info');
}

function clearAllAttendance() {
  showConfirm('Clear All Attendance?', 'This will reset all attendance marks for this session.', () => {
    APP.attendance = {};
    renderAttendanceLists();
    showToast('All attendance cleared.', 'info');
  });
}

function updateAttendanceCounts() {
  let present = 0, absent = 0, late = 0, unmarked = 0;
  APP.members.forEach(m => {
    const att = APP.attendance[m.id];
    if (!att || !att.status) unmarked++;
    else if (att.status === 'Present') present++;
    else if (att.status === 'Absent') absent++;
    else if (att.status === 'Late') late++;
  });

  const pEl = $('#att-present-count');
  const aEl = $('#att-absent-count');
  const lEl = $('#att-late-count');
  const uEl = $('#att-unmarked-count');
  if (pEl) pEl.textContent = present;
  if (aEl) aEl.textContent = absent;
  if (lEl) lEl.textContent = late;
  if (uEl) uEl.textContent = unmarked;
}

// ---- Save Attendance Session ----
async function saveAttendance() {
  const date = $('#attendance-date').value;
  const eventTime = $('#attendance-time')?.value || '';
  const eventName = $('#event-name').value.trim();

  // Validation
  if (!date) {
    showToast('Please select a date.', 'warning');
    $('#attendance-date').focus();
    return;
  }

  if (!eventTime) {
    showToast('Please select a time.', 'warning');
    $('#attendance-time').focus();
    return;
  }

  if (!eventName) {
    showToast('Please enter an event name.', 'warning');
    $('#event-name').focus();
    return;
  }

  if (APP.members.length === 0) {
    showToast('No members to take attendance for. Add members first.', 'warning');
    return;
  }

  // Check if all members are marked
  const unmarkedMembers = APP.members.filter(m => !APP.attendance[m.id] || !APP.attendance[m.id].status);
  if (unmarkedMembers.length > 0) {
    showConfirm(
      `${unmarkedMembers.length} member(s) unmarked`,
      'Unmarked members will be recorded as Absent. Continue?',
      () => doSaveAttendance(date, eventTime, eventName)
    );
    return;
  }

  await doSaveAttendance(date, eventTime, eventName);
}

async function doSaveAttendance(date, eventTime, eventName) {
  const btn = $('#save-attendance-btn');
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';

  try {
    // Build records
    const records = APP.members.map(m => {
      const att = APP.attendance[m.id] || {};
      return {
        memberId: m.id,
        memberName: m.name,
        category: m.category,
        role: m.role || '',
        status: att.status || 'Absent',
        reason: att.reason || '',
        remarks: att.remarks || ''
      };
    });

    const totalMembers = records.length;
    const totalPresent = records.filter(r => r.status === 'Present').length;
    const totalAbsent = records.filter(r => r.status === 'Absent').length;
    const totalLate = records.filter(r => r.status === 'Late').length;
    const attendanceRate = totalMembers > 0 ? Math.round(((totalPresent + totalLate) / totalMembers) * 100) : 0;

    const sessionData = {
      eventName,
      date,
      eventTime,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      createdBy: auth.currentUser?.email || 'unknown',
      totalMembers,
      totalPresent,
      totalAbsent,
      totalLate,
      attendanceRate,
      records
    };

    await db.collection('sessions').add(sessionData);

    showToast(`Attendance saved for "${eventName}".`, 'success');

    // Reset
    APP.attendance = {};
    $('#event-name').value = '';
    setDefaultDate();

    // Refresh
    await fetchSessions();
    renderAttendanceLists();
    renderReportsList();
    renderDashboard();
    updateSettingsCounts();

    // Switch to reports
    switchTab('reports');

  } catch (err) {
    console.error('Error saving attendance:', err);
    showToast('Failed to save attendance. Please try again.', 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-save"></i> Save Attendance';
  }
}

// ============================================================
// REPORTS MODULE
// ============================================================

function renderReportsList() {
  const container = $('#reports-list');
  const searchQuery = ($('#report-search')?.value || '').toLowerCase();
  const dateFilter = $('#report-date-filter')?.value || '';
  const statusFilter = $('#report-status-filter')?.value || 'all';

  let filtered = [...APP.sessions];

  if (searchQuery) {
    filtered = filtered.filter(s => (s.eventName || '').toLowerCase().includes(searchQuery));
  }

  if (dateFilter) {
    filtered = filtered.filter(s => s.date === dateFilter);
  }

  // Status filter applies to which sessions to show (sessions containing that status)
  if (statusFilter !== 'all') {
    filtered = filtered.filter(s =>
      s.records && s.records.some(r => r.status === statusFilter)
    );
  }

  // Update count
  const countEl = $('#report-session-count');
  if (countEl) countEl.textContent = filtered.length;

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon"><i class="fas fa-clipboard-list"></i></div>
        <h3>No reports found</h3>
        <p>${searchQuery || dateFilter ? 'Try different filters' : 'Save an attendance session to see reports here'}</p>
      </div>`;
    return;
  }

  container.innerHTML = filtered.map(s => {
    const dateObj = s.date ? new Date(s.date + 'T00:00:00') : new Date();
    const day = dateObj.getDate();
    const month = dateObj.toLocaleString('en', { month: 'short' });
    const rate = s.attendanceRate || 0;
    const barClass = rate >= 75 ? 'high' : rate >= 50 ? 'medium' : 'low';

    return `
      <div class="report-card" onclick="showReportDetail('${s.id}')">
        <div class="report-date-badge">
          <span class="day">${day}</span>
          <span class="month">${month}</span>
        </div>
        <div class="report-info">
          <div class="report-event-name">${escapeHtml(s.eventName || 'Untitled Event')}</div>
          <div class="report-meta">
            <span><i class="fas fa-calendar"></i> ${s.date || 'N/A'}</span>
            <span><i class="fas fa-users"></i> ${s.totalMembers || 0} members</span>
            <span><i class="fas fa-check"></i> ${s.totalPresent || 0} present</span>
            <span><i class="fas fa-percentage"></i> ${rate}%</span>
          </div>
        </div>
        <div class="report-attendance-bar">
          <div class="bar-fill ${barClass}" style="width:${rate}%;"></div>
        </div>
        <div class="report-actions" onclick="event.stopPropagation();">
          <button class="btn-icon" onclick="exportSessionPDF('${s.id}')" title="Export PDF"><i class="fas fa-file-pdf"></i></button>
          <button class="btn-icon" onclick="exportSessionExcel('${s.id}')" title="Export Excel"><i class="fas fa-file-excel"></i></button>
          <button class="btn-icon danger" onclick="deleteSession('${s.id}')" title="Delete"><i class="fas fa-trash-alt"></i></button>
        </div>
      </div>`;
  }).join('');
}

function showReportDetail(sessionId) {
  const session = APP.sessions.find(s => s.id === sessionId);
  if (!session) return;

  APP.currentReportSession = session;

  $('#report-detail-title').textContent = session.eventName || 'Session Details';

  const records = session.records || [];
  const presentRecords = records
    .filter(r => r.status === 'Present')
    .sort((a, b) => (a.memberName || '').localeCompare(b.memberName || ''));

  const absentRecords = records
    .filter(r => r.status === 'Absent' || r.status === 'Late')
    .sort((a, b) => (a.memberName || '').localeCompare(b.memberName || ''));

  let html = `
    <div class="report-detail-header" style="text-align:left; padding-bottom:16px; border-bottom:1px solid var(--border); margin-bottom:16px;">
      <p style="margin:4px 0; font-size:1rem; color:var(--text-primary);"><strong>Event Name:</strong> ${escapeHtml(session.eventName)}</p>
      <p style="margin:4px 0; font-size:1rem; color:var(--text-primary);"><strong>Event Date:</strong> ${session.date || 'N/A'}</p>
      <p style="margin:4px 0; font-size:1rem; color:var(--text-primary);"><strong>Event Time:</strong> ${formatTime12Hour(session.eventTime)}</p>
    </div>

    <div class="report-summary-cards" style="display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-bottom: 20px;">
      <div class="report-summary-card" style="text-align:left; padding:16px; background:var(--bg-secondary); border-radius:var(--radius-md);">
        <span class="label" style="font-size:0.8rem; text-transform:uppercase; color:var(--text-secondary); font-weight:600; display:block;">Total Attendees</span>
        <span class="value" style="font-size:2rem; font-weight:800; color:var(--success);">${session.totalPresent || 0}</span>
      </div>
      <div class="report-summary-card" style="text-align:left; padding:16px; background:var(--bg-secondary); border-radius:var(--radius-md);">
        <span class="label" style="font-size:0.8rem; text-transform:uppercase; color:var(--text-secondary); font-weight:600; display:block;">Total Absentees</span>
        <span class="value" style="font-size:2rem; font-weight:800; color:var(--danger);">${session.totalAbsent || 0}</span>
      </div>
    </div>

    <!-- Inner modal tabs -->
    <div class="modal-tab-bar" style="display:flex; border-bottom:1px solid var(--border); margin-bottom:16px; gap:16px;">
      <button class="modal-tab-btn active" id="modal-tab-attendees" style="background:none; border:none; padding:10px 0; font-weight:600; color:var(--accent); border-bottom:2px solid var(--accent); cursor:pointer;">
        Attendees (${presentRecords.length})
      </button>
      <button class="modal-tab-btn" id="modal-tab-absentees" style="background:none; border:none; padding:10px 0; font-weight:600; color:var(--text-secondary); cursor:pointer;">
        Absentees/Late (${absentRecords.length})
      </button>
    </div>

    <!-- Attendees list section -->
    <div id="modal-sec-attendees" class="modal-section-content">
      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th style="width: 50px;">#</th>
              <th>Name</th>
              <th style="width: 100px;">Status</th>
            </tr>
          </thead>
          <tbody>
            ${presentRecords.length > 0 ? presentRecords.map((r, i) => `
              <tr>
                <td>${i + 1}</td>
                <td>${escapeHtml(r.memberName)}</td>
                <td><span class="badge badge-present">Present</span></td>
              </tr>`).join('') : '<tr><td colspan="3" class="text-center" style="padding:20px;">No attendees were present.</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>

    <!-- Absentees list section -->
    <div id="modal-sec-absentees" class="modal-section-content hidden">
      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th style="width: 50px;">#</th>
              <th>Name</th>
              <th style="width: 100px;">Status</th>
              <th>Reason for Absence</th>
            </tr>
          </thead>
          <tbody>
            ${absentRecords.length > 0 ? absentRecords.map((r, i) => {
              const badgeClass = r.status === 'Absent' ? 'badge-absent' : 'badge-late';
              return `
              <tr>
                <td>${i + 1}</td>
                <td>${escapeHtml(r.memberName)}</td>
                <td><span class="badge ${badgeClass}">${r.status}</span></td>
                <td style="color:var(--text-primary); font-style:italic;">${escapeHtml(r.reason || 'No reason provided')}</td>
              </tr>`;
            }).join('') : '<tr><td colspan="4" class="text-center" style="padding:20px;">No absentees or late members.</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>
  `;

  $('#report-detail-body').innerHTML = html;

  // Add click handlers for the modal tabs
  const tabAttendees = $('#modal-tab-attendees');
  const tabAbsentees = $('#modal-tab-absentees');
  const secAttendees = $('#modal-sec-attendees');
  const secAbsentees = $('#modal-sec-absentees');

  if (tabAttendees && tabAbsentees && secAttendees && secAbsentees) {
    tabAttendees.onclick = () => {
      tabAttendees.classList.add('active');
      tabAttendees.style.color = 'var(--accent)';
      tabAttendees.style.borderBottom = '2px solid var(--accent)';

      tabAbsentees.classList.remove('active');
      tabAbsentees.style.color = 'var(--text-secondary)';
      tabAbsentees.style.borderBottom = 'none';

      secAttendees.classList.remove('hidden');
      secAbsentees.classList.add('hidden');
    };

    tabAbsentees.onclick = () => {
      tabAbsentees.classList.add('active');
      tabAbsentees.style.color = 'var(--accent)';
      tabAbsentees.style.borderBottom = '2px solid var(--accent)';

      tabAttendees.classList.remove('active');
      tabAttendees.style.color = 'var(--text-secondary)';
      tabAttendees.style.borderBottom = 'none';

      secAbsentees.classList.remove('hidden');
      secAttendees.classList.add('hidden');
    };
  }

  // Wire export buttons
  $('#detail-export-pdf-btn').onclick = () => exportSessionPDF(sessionId);
  $('#detail-export-excel-btn').onclick = () => exportSessionExcel(sessionId);

  showModal('report-detail-modal');
}

function deleteSession(sessionId) {
  const session = APP.sessions.find(s => s.id === sessionId);
  if (!session) return;

  showConfirm(
    `Delete "${session.eventName}"?`,
    'This will permanently remove this attendance session and all its records.',
    async () => {
      try {
        await db.collection('sessions').doc(sessionId).delete();
        showToast(`Session "${session.eventName}" deleted.`, 'success');
        await fetchSessions();
        renderReportsList();
        renderDashboard();
        updateSettingsCounts();
      } catch (err) {
        console.error('Error deleting session:', err);
        showToast('Failed to delete session.', 'error');
      }
    },
    'danger'
  );
}

function clearReportFilters() {
  const search = $('#report-search');
  const dateFilter = $('#report-date-filter');
  const statusFilter = $('#report-status-filter');
  if (search) search.value = '';
  if (dateFilter) dateFilter.value = '';
  if (statusFilter) statusFilter.value = 'all';
  renderReportsList();
}

// Reports search & filter event listeners
document.addEventListener('DOMContentLoaded', () => {
  const searchEl = $('#report-search');
  const dateEl = $('#report-date-filter');
  const statusEl = $('#report-status-filter');
  if (searchEl) searchEl.addEventListener('input', debounce(renderReportsList, 250));
  if (dateEl) dateEl.addEventListener('change', renderReportsList);
  if (statusEl) statusEl.addEventListener('change', renderReportsList);
});

// ============================================================
// DASHBOARD MODULE
// ============================================================

function renderDashboard() {
  // Stats
  const totalMembers = APP.members.length;
  const totalSessions = APP.sessions.length;
  const avgAttendance = totalSessions > 0
    ? Math.round(APP.sessions.reduce((sum, s) => sum + (s.attendanceRate || 0), 0) / totalSessions)
    : 0;

  const lastSession = APP.sessions.length > 0 ? APP.sessions[0] : null;
  const presentToday = lastSession ? `${lastSession.totalPresent || 0}/${lastSession.totalMembers || 0}` : '—';

  animateCounter($('#dash-total-members'), totalMembers);
  animateCounter($('#dash-total-sessions'), totalSessions);
  $('#dash-avg-attendance').textContent = `${avgAttendance}%`;
  $('#dash-present-today').textContent = presentToday;

  // Recent Sessions
  renderRecentSessions();

  // Category Breakdown
  renderCategoryBreakdown();
}

function renderRecentSessions() {
  const container = $('#recent-sessions-list');
  const recent = APP.sessions.slice(0, 5);

  if (recent.length === 0) {
    container.innerHTML = `
      <div class="empty-state" style="padding:24px 0;">
        <div class="empty-state-icon"><i class="fas fa-calendar-times"></i></div>
        <h3>No sessions yet</h3>
        <p>Take your first attendance to see sessions here</p>
      </div>`;
    return;
  }

  container.innerHTML = recent.map(s => {
    const rate = s.attendanceRate || 0;
    const rateColor = rate >= 75 ? 'var(--success)' : rate >= 50 ? 'var(--warning)' : 'var(--danger)';
    return `
      <div class="recent-session-item" style="cursor:pointer;" onclick="switchTab('reports')">
        <div class="recent-session-dot" style="background:${rateColor};"></div>
        <div class="recent-session-info">
          <div class="recent-session-name">${escapeHtml(s.eventName || 'Untitled')}</div>
          <div class="recent-session-date">${s.date || 'N/A'} · ${s.totalPresent || 0}/${s.totalMembers || 0} present</div>
        </div>
        <div class="recent-session-rate" style="color:${rateColor};">${rate}%</div>
      </div>`;
  }).join('');
}

function renderCategoryBreakdown() {
  const container = $('#category-chart');
  const boardCount = APP.members.filter(m => m.category === 'Board Official').length;
  const rotaractorCount = APP.members.filter(m => m.category === 'Rotaractor').length;
  const otherCount = APP.members.filter(m => m.category === 'Other Rotaractor').length;
  const total = APP.members.length || 1;

  container.innerHTML = `
    <div class="category-bar-item">
      <span class="category-bar-label">Board Officials</span>
      <div class="category-bar-track">
        <div class="category-bar-fill blue" style="width:${(boardCount / total) * 100}%;"></div>
      </div>
      <span class="category-bar-count">${boardCount}</span>
    </div>
    <div class="category-bar-item">
      <span class="category-bar-label">Rotaractors</span>
      <div class="category-bar-track">
        <div class="category-bar-fill gold" style="width:${(rotaractorCount / total) * 100}%;"></div>
      </div>
      <span class="category-bar-count">${rotaractorCount}</span>
    </div>
    <div class="category-bar-item">
      <span class="category-bar-label">Other Rotaractors</span>
      <div class="category-bar-track">
        <div class="category-bar-fill purple" style="width:${(otherCount / total) * 100}%;"></div>
      </div>
      <span class="category-bar-count">${otherCount}</span>
    </div>
  `;
}

// ============================================================
// PDF EXPORT
// ============================================================

function exportSessionPDF(sessionId) {
  const session = APP.sessions.find(s => s.id === sessionId);
  if (!session) {
    showToast('Session not found.', 'error');
    return;
  }

  try {
    // jsPDF UMD exposes different globals depending on version/environment
    const jsPDFClass = (window.jspdf && window.jspdf.jsPDF) || window.jsPDF;
    if (!jsPDFClass) {
      showToast('PDF library not loaded. Check your internet connection and refresh.', 'error');
      return;
    }
    const doc = new jsPDFClass();
    const records = session.records || [];

    // Colors
    const primaryColor = [26, 58, 107];   // #1A3A6B
    const accentColor = [212, 168, 67];    // #D4A843
    const white = [255, 255, 255];

    // Header bar
    doc.setFillColor(...primaryColor);
    doc.rect(0, 0, 210, 35, 'F');

    doc.setTextColor(...white);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('ROTARACT CLUB OF PSVPEC', 14, 16);

    // Place logo in top right corner of the banner
    const logoImg = $('.nav-brand-icon img');
    if (logoImg) {
      try {
        doc.addImage(logoImg, 'PNG', 176, 7.5, 20, 20);
      } catch (e) {
        console.warn('Could not add logo to PDF:', e);
      }
    }

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('Attendance Report', 14, 24);

    // Gold accent bar
    doc.setFillColor(...accentColor);
    doc.rect(0, 35, 210, 2, 'F');

    // Event info
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(`Event Name: ${session.eventName || 'Untitled Event'}`, 14, 48);
    doc.text(`Event Date : ${session.date || 'N/A'}`, 14, 54);
    doc.text(`Event Time : ${formatTime12Hour(session.eventTime)}`, 14, 60);

    // Summary box
    const summaryY = 66;
    doc.setFillColor(240, 242, 245);
    doc.rect(14, summaryY, 182, 12, 'F');

    doc.setFontSize(9);
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'bold');
    doc.text(`Total Attendees: ${session.totalPresent || 0}`, 20, summaryY + 8);

    let currentY = summaryY + 20;

    // Filter and sort all present records alphabetically
    const presentRecords = records
      .filter(r => r.status === 'Present')
      .sort((a, b) => (a.memberName || '').localeCompare(b.memberName || ''));

    if (presentRecords.length > 0) {
      const tableData = presentRecords.map((r, i) => [
        i + 1,
        r.memberName || '',
        'Present'
      ]);

      doc.autoTable({
        startY: currentY,
        head: [['#', 'Name', 'Status']],
        body: tableData,
        theme: 'grid',
        styles: {
          fontSize: 8.5,
          cellPadding: 3,
          lineColor: [200, 200, 200],
          lineWidth: 0.3,
        },
        headStyles: {
          fillColor: primaryColor,
          textColor: white,
          fontStyle: 'bold',
          fontSize: 8.5,
        },
        alternateRowStyles: {
          fillColor: [248, 250, 252],
        },
        columnStyles: {
          0: { cellWidth: 15 },
          2: { cellWidth: 25 },
        },
        margin: { left: 14, right: 14 },
      });

      currentY = doc.lastAutoTable.finalY + 10;
    }

    // Footer
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text(`ROTARACT CLUB OF PSVPEC Attendance Report — Page ${i} of ${pageCount}`, 14, 290);
    }

    const filename = `ROTARACT_PSVPEC_Attendance_${session.eventName?.replace(/[^a-zA-Z0-9]/g, '_') || 'Report'}_${session.date || 'undated'}.pdf`;
    doc.save(filename);

    showToast('PDF exported successfully!', 'success');
  } catch (err) {
    console.error('PDF export error:', err);
    showToast('Failed to export PDF. Please try again.', 'error');
  }
}

// ============================================================
// EXCEL EXPORT
// ============================================================

function exportSessionExcel(sessionId) {
  const session = APP.sessions.find(s => s.id === sessionId);
  if (!session) {
    showToast('Session not found.', 'error');
    return;
  }

  try {
    const wb = XLSX.utils.book_new();
    const records = session.records || [];

    // Filter and sort all present records alphabetically
    const presentRecords = records
      .filter(r => r.status === 'Present')
      .sort((a, b) => (a.memberName || '').localeCompare(b.memberName || ''));

    // Construct unified sheet data structure matching PDF formatting
    const sheetData = [
      ['ROTARACT CLUB OF PSVPEC'],
      ['Official Attendance Report'],
      [],
      ['EVENT METADATA'],
      ['Event Name:', session.eventName || 'Untitled Event'],
      ['Event Date:', session.date || 'N/A'],
      ['Event Time:', formatTime12Hour(session.eventTime)],
      ['Total Attendees:', session.totalPresent || 0],
      [],
      ['ATTENDANCE SHEET'],
      ['#', 'Name', 'Status']
    ];

    presentRecords.forEach((r, i) => {
      sheetData.push([
        i + 1,
        r.memberName || '',
        'Present'
      ]);
    });

    const sheet = XLSX.utils.aoa_to_sheet(sheetData);

    // Apply column widths for organized layout and prevent truncation
    sheet['!cols'] = [
      { wch: 18 },  // Column A: 'Total Attendees:', 'Event Name:', '#'
      { wch: 35 },  // Column B: Name values, 'Name' header
      { wch: 15 }   // Column C: 'Status' value, 'Status' header
    ];

    // Merge titles for professional layout
    sheet['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 2 } }, // ROTARACT CLUB OF PSVPEC (A1:C1)
      { s: { r: 1, c: 0 }, e: { r: 1, c: 2 } }, // Official Attendance Report (A2:C2)
      { s: { r: 3, c: 0 }, e: { r: 3, c: 2 } }, // EVENT METADATA (A4:C4)
      { s: { r: 9, c: 0 }, e: { r: 9, c: 2 } }  // ATTENDANCE SHEET (A10:C10)
    ];

    XLSX.utils.book_append_sheet(wb, sheet, 'Attendance');

    const filename = `ROTARACT_PSVPEC_Attendance_${session.eventName?.replace(/[^a-zA-Z0-9]/g, '_') || 'Report'}_${session.date || 'undated'}.xlsx`;
    XLSX.writeFile(wb, filename);

    showToast('Excel exported successfully!', 'success');
  } catch (err) {
    console.error('Excel export error:', err);
    showToast('Failed to export Excel. Please try again.', 'error');
  }
}

// ============================================================
// SETTINGS HELPERS
// ============================================================
function updateSettingsCounts() {
  const memberCount = $('#settings-member-count');
  const sessionCount = $('#settings-session-count');
  if (memberCount) memberCount.textContent = `${APP.members.length} members`;
  if (sessionCount) sessionCount.textContent = `${APP.sessions.length} sessions`;
}

// ============================================================
// UTILITY FUNCTIONS
// ============================================================

function formatTime12Hour(timeStr) {
  if (!timeStr) return 'N/A';
  const [hourStr, minuteStr] = timeStr.split(':');
  let hour = parseInt(hourStr, 10);
  const minute = minuteStr || '00';
  const ampm = hour >= 12 ? 'PM' : 'AM';
  hour = hour % 12;
  hour = hour ? hour : 12; // the hour '0' should be '12'
  return `${hour}:${minute} ${ampm}`;
}

function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function debounce(fn, delay) {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => fn(...args), delay);
  };
}

function animateCounter(el, target) {
  if (!el) return;
  const current = parseInt(el.textContent) || 0;
  if (current === target) return;

  const duration = 600;
  const steps = 30;
  const increment = (target - current) / steps;
  let step = 0;

  const timer = setInterval(() => {
    step++;
    const value = Math.round(current + increment * step);
    el.textContent = value;
    if (step >= steps) {
      el.textContent = target;
      clearInterval(timer);
    }
  }, duration / steps);
}
