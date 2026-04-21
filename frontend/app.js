const API_URL = '/api';

function togglePassword(inputId, toggleEl) {
  const input = document.getElementById(inputId);
  if (input.type === 'password') {
    input.type = 'text';
    toggleEl.textContent = '🔒'; // Closed lock or crossed eye
  } else {
    input.type = 'password';
    toggleEl.textContent = '👁️';
  }
}

// Utilities
function getToken() {
  return localStorage.getItem('token');
}

function getUser() {
  const user = localStorage.getItem('user');
  return user ? JSON.parse(user) : null;
}

function checkAuth(requiredRole = null) {
  const token = getToken();
  const user = getUser();
  
  if (!token || !user) {
    if (window.location.pathname !== '/' && window.location.pathname !== '/index.html') {
      window.location.href = '/';
    }
    return;
  }

  if (requiredRole && user.role !== requiredRole) {
    window.location.href = `/${user.role}.html`;
  }

  const nameEl = document.getElementById('userName');
  if (nameEl) nameEl.textContent = `${user.name} (${user.role})`;
}

function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  window.location.href = '/';
}

function openModal(id) {
  document.getElementById(id).classList.add('active');
}

function openAddBookModal() {
  document.getElementById('bookId').value = '';
  document.getElementById('bookModalTitle').textContent = 'Add Book';
  document.getElementById('bookForm').reset();
  document.getElementById('availableCopiesGroup').style.display = 'none';
  openModal('bookModal');
}

function openUserModal(role) {
  const roleSelect = document.getElementById('userRole');
  if (roleSelect) {
    roleSelect.value = role;
    // Optionally hide it
    roleSelect.parentElement.style.display = 'none';
  }
  const title = document.querySelector('#userModal h3');
  if (title) title.textContent = `Add ${role.charAt(0).toUpperCase() + role.slice(1)}`;
  openModal('userModal');
}

function closeModal(id) {
  document.getElementById(id).classList.remove('active');
}

// API Calls
async function apiCall(endpoint, method = 'GET', body = null) {
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${getToken()}`
  };
  
  const config = { method, headers };
  if (body) config.body = JSON.stringify(body);

  const res = await fetch(`${API_URL}${endpoint}`, config);
  
  // Check if response is JSON
  const contentType = res.headers.get("content-type");
  if (contentType && contentType.indexOf("application/json") !== -1) {
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'API Error');
    return data;
  } else {
    // If not JSON, it might be the HTML fallback due to a route error
    if (!res.ok) throw new Error(`Server Error: ${res.status} ${res.statusText}`);
    return null;
  }
}

// Login logic
const loginForm = document.getElementById('loginForm');
if (loginForm) {
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const errorMsg = document.getElementById('errorMsg');
    
    try {
      const res = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.message);
      
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      
      window.location.href = `/${data.user.role}.html`;
    } catch (err) {
      errorMsg.textContent = err.message;
      errorMsg.style.display = 'block';
    }
  });
}

// Admin Functions
async function loadAdminData() {
  loadSettings();
  loadBooks('admin');
  loadUsers();
}

async function loadSettings() {
  try {
    const settings = await apiCall('/settings');
    const fineInp = document.getElementById('finePerDay');
    const durInp = document.getElementById('maxDuration');
    if (fineInp) fineInp.value = settings.fine_per_day;
    if (durInp) durInp.value = settings.max_issue_duration;
  } catch (err) {
    console.error(err);
  }
}

const settingsForm = document.getElementById('settingsForm');
if (settingsForm) {
  settingsForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const body = {
      fine_per_day: document.getElementById('finePerDay').value,
      max_issue_duration: document.getElementById('maxDuration').value,
    };
    try {
      await apiCall('/settings', 'POST', body);
      alert('Settings updated successfully!');
    } catch (err) {
      alert(err.message);
    }
  });
}

async function loadUsers() {
  try {
    const users = await apiCall('/users');
    const staffBody = document.querySelector('#staffTable tbody');
    const studentBody = document.querySelector('#studentTable tbody');
    
    const staff = users.filter(u => u.role === 'staff');
    const students = users.filter(u => u.role === 'student');

    staffBody.innerHTML = staff.map(u => `
      <tr>
        <td>${u.id}</td>
        <td>${u.name}</td>
        <td>${u.email}</td>
        <td>
          <button class="btn btn-danger" style="padding: 0.25rem 0.5rem;" onclick="deleteUser(${u.id})">Delete</button>
        </td>
      </tr>
    `).join('');

    studentBody.innerHTML = students.map(u => `
      <tr>
        <td>${u.id}</td>
        <td>${u.name}</td>
        <td>${u.email}</td>
        <td>
          <button class="btn btn-danger" style="padding: 0.25rem 0.5rem;" onclick="deleteUser(${u.id})">Delete</button>
        </td>
      </tr>
    `).join('');
  } catch (err) {
    console.error(err);
  }
}

async function deleteUser(id) {
  if (!confirm('Are you sure?')) return;
  try {
    await apiCall(`/users/${id}`, 'DELETE');
    loadUsers();
  } catch (err) {
    alert(err.message);
  }
}

const userForm = document.getElementById('userForm');
if (userForm) {
  userForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const body = {
      name: document.getElementById('userNameInput').value,
      email: document.getElementById('userEmail').value,
      password: document.getElementById('userPassword').value,
      role: document.getElementById('userRole').value,
    };
    try {
      await apiCall('/users', 'POST', body);
      closeModal('userModal');
      userForm.reset();
      loadUsers();
    } catch (err) {
      alert(err.message);
    }
  });
}

// Book Management (Admin & Staff)
async function loadBooks(role) {
  try {
    const q = document.getElementById('searchInput')?.value || '';
    const books = await apiCall(`/books?q=${q}`);
    const tbody = document.querySelector('#booksTable tbody');
    
    tbody.innerHTML = books.map(b => {
      if (role === 'student') {
        return `
          <tr>
            <td>${b.title}</td>
            <td>${b.author}</td>
            <td>${b.available_copies > 0 ? 'Yes' : 'No'}</td>
            <td>
              <button class="btn" style="padding: 0.25rem 0.5rem;" ${b.available_copies <= 0 ? 'disabled' : ''} onclick="requestBook(${b.id})">Issue</button>
            </td>
          </tr>
        `;
      } else {
        return `
          <tr>
            <td>${b.id}</td>
            <td>${b.title}</td>
            <td>${b.author}</td>
            <td>${b.available_copies} / ${b.total_copies}</td>
            <td>
              <button class="btn" style="padding: 0.25rem 0.5rem;" onclick='openEditBook(${JSON.stringify(b).replace(/'/g, "&apos;")})'>Edit</button>
              <button class="btn btn-danger" style="padding: 0.25rem 0.5rem;" onclick="deleteBook(${b.id})">Delete</button>
            </td>
          </tr>
        `;
      }
    }).join('');
  } catch (err) {
    console.error(err);
  }
}

function openEditBook(book) {
  document.getElementById('bookId').value = book.id;
  document.getElementById('bookTitle').value = book.title;
  document.getElementById('bookAuthor').value = book.author;
  document.getElementById('bookCopies').value = book.total_copies;
  document.getElementById('bookAvailable').value = book.available_copies;
  document.getElementById('bookModalTitle').textContent = 'Edit Book';
  document.getElementById('availableCopiesGroup').style.display = 'block';
  openModal('bookModal');
}

const bookForm = document.getElementById('bookForm');
if (bookForm) {
  bookForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('bookId').value;
    const body = {
      title: document.getElementById('bookTitle').value,
      author: document.getElementById('bookAuthor').value,
      total_copies: document.getElementById('bookCopies').value,
    };
    
    if (id) {
      body.available_copies = document.getElementById('bookAvailable').value;
    }

    try {
      if (id) {
        await apiCall(`/books/${id}`, 'PUT', body);
      } else {
        await apiCall('/books', 'POST', body);
      }
      closeModal('bookModal');
      bookForm.reset();
      loadBooks(getUser().role);
    } catch (err) {
      alert(err.message);
    }
  });
}

async function deleteBook(id) {
  if (!confirm('Delete book?')) return;
  try {
    await apiCall(`/books/${id}`, 'DELETE');
    loadBooks(getUser().role);
  } catch (err) {
    alert(err.message);
  }
}

// Staff Functions
async function loadStaffData() {
  loadBooks('staff');
  loadIssues('staff');
}

async function loadIssues(role) {
  try {
    const issues = await apiCall('/issues');
    const tbody = document.querySelector('#issuesTable tbody');
    
    tbody.innerHTML = issues.map(i => {
      if (role === 'student') {
        let actionBtn = '-';
        if (i.status === 'issued') {
          actionBtn = `<button class="btn btn-success" style="padding: 0.25rem 0.5rem;" onclick="requestReturn(${i.id})">Mark as Return</button>`;
        } else if (i.status === 'pending') {
          actionBtn = '<span style="color: var(--text-muted);">Awaiting Approval</span>';
        } else if (i.status === 'return_pending') {
          actionBtn = '<span style="color: var(--text-muted);">Return Requested</span>';
        }

        return `
          <tr>
            <td>${i.book_title}</td>
            <td>${new Date(i.issued_date).toLocaleDateString()}</td>
            <td>${new Date(i.return_date).toLocaleDateString()}</td>
            <td>₹${i.fine}</td>
            <td>${i.status}</td>
            <td>${actionBtn}</td>
          </tr>
        `;
      } else {
        let actionBtns = '';
        if (i.status === 'pending') {
          actionBtns = `<button class="btn btn-success" style="padding: 0.25rem 0.5rem;" onclick="approveIssue(${i.id})">Approve</button>`;
        } else if (i.status === 'return_pending' || i.status === 'issued') {
          actionBtns = `<button class="btn btn-success" style="padding: 0.25rem 0.5rem;" onclick="confirmReturn(${i.id})">Confirm Return</button>`;
        }

        return `
          <tr>
            <td>${i.book_title} (ID: ${i.book_id})</td>
            <td>${i.student_name}</td>
            <td>${new Date(i.issued_date).toLocaleDateString()}</td>
            <td>${new Date(i.return_date).toLocaleDateString()}</td>
            <td>${i.status} (Fine: ₹${i.fine})</td>
            <td>${actionBtns}</td>
          </tr>
        `;
      }
    }).join('');
  } catch (err) {
    console.error(err);
  }
}

const issueForm = document.getElementById('issueForm');
if (issueForm) {
  issueForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const body = {
      book_id: document.getElementById('issueBookId').value,
      student_id: document.getElementById('issueStudentId').value,
    };
    try {
      await apiCall('/issues', 'POST', body);
      closeModal('issueModal');
      issueForm.reset();
      loadStaffData();
    } catch (err) {
      alert(err.message);
    }
  });
}

function openEditIssue(id, returnDate, fine) {
  document.getElementById('editIssueId').value = id;
  document.getElementById('editReturnDate').value = returnDate.split('T')[0];
  document.getElementById('editFine').value = fine;
  openModal('editIssueModal');
}

const editIssueForm = document.getElementById('editIssueForm');
if (editIssueForm) {
  editIssueForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('editIssueId').value;
    const body = {
      return_date: document.getElementById('editReturnDate').value,
      fine: document.getElementById('editFine').value,
    };
    try {
      await apiCall(`/issues/${id}`, 'PUT', body);
      closeModal('editIssueModal');
      loadStaffData();
    } catch (err) {
      alert(err.message);
    }
  });
}

async function approveIssue(id) {
  try {
    await apiCall(`/issues/${id}/approve`, 'PUT');
    alert('Issue approved!');
    loadStaffData();
  } catch (err) {
    alert(err.message);
  }
}

async function requestReturn(id) {
  try {
    const res = await apiCall(`/issues/${id}/request-return`, 'POST');
    alert(res.message);
    loadStudentData();
  } catch (err) {
    alert(err.message);
  }
}

async function confirmReturn(id) {
  if (!confirm('Confirm physical return?')) return;
  try {
    const res = await apiCall(`/issues/${id}/confirm-return`, 'POST');
    alert(res.message + (res.fine > 0 ? `. Fine: ₹${res.fine}` : ''));
    if (getUser().role === 'staff') loadStaffData();
    else loadStudentData();
  } catch (err) {
    alert(err.message);
  }
}

// Student Functions
async function loadStudentData() {
  loadBooks('student');
  loadIssues('student');
}

async function searchBooks() {
  loadBooks('student');
}

async function requestBook(id) {
  try {
    await apiCall('/issues', 'POST', { book_id: id });
    alert('Book issued successfully!');
    loadStudentData();
  } catch (err) {
    alert(err.message);
  }
}
