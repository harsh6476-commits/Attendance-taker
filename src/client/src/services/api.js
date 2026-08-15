const API_BASE = '/api';

async function request(endpoint, options = {}) {
  const defaultHeaders = {
    'Content-Type': 'application/json'
  };

  const token = localStorage.getItem('token');
  if (token) {
    defaultHeaders['Authorization'] = `Bearer ${token}`;
  }

  const config = {
    ...options,
    headers: {
      ...defaultHeaders,
      ...options.headers
    },
    credentials: 'omit'
  };

  if (options.body && typeof options.body !== 'string' && !(options.body instanceof FormData)) {
    config.body = JSON.stringify(options.body);
  }

  const response = await fetch(`${API_BASE}${endpoint}`, config);
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || 'API Request Failed');
  }

  return data;
}

export const api = {
  // Auth
  register: (body) => request('/auth/register', { method: 'POST', body }),
  login: (body) => request('/auth/login', { method: 'POST', body }),
  logout: () => request('/auth/logout', { method: 'POST' }),
  me: () => request('/auth/me'),

  // WebAuthn Passkeys
  getWebAuthnRegOpts: () => request('/auth/webauthn/register-options', { method: 'POST' }),
  verifyWebAuthnReg: (body) => request('/auth/webauthn/register-verify', { method: 'POST', body }),
  getWebAuthnAuthOpts: () => request('/auth/webauthn/auth-options', { method: 'POST' }),
  verifyWebAuthnAuth: (body) => request('/auth/webauthn/auth-verify', { method: 'POST', body }),

  // Classes
  createClass: (body) => request('/classes/create', { method: 'POST', body }),
  enrollStudents: (classId, body) => request(`/classes/${classId}/enroll`, { method: 'POST', body }),
  registerGeofence: (classId, body) => request(`/classes/${classId}/geofence`, { method: 'POST', body }),
  getTeacherClasses: () => request('/classes/teacher'),
  getStudentClasses: () => request('/classes/student'),
  getClassDetails: (classId) => request(`/classes/${classId}`),
  joinClass: (body) => request('/classes/join', { method: 'POST', body }),

  // Attendance
  startSession: (body) => request('/attendance/session/start', { method: 'POST', body }),
  endSession: (sessionId) => request(`/attendance/session/${sessionId}/end`, { method: 'POST' }),
  getProjectorToken: (sessionId) => request(`/attendance/session/${sessionId}/projector-token`),
  getLiveStatus: (sessionId) => request(`/attendance/session/${sessionId}/live-status`),
  verifyAttendance: (body) => request('/attendance/verify', { method: 'POST', body }),
  overrideAttendance: (recordId, body) => request(`/attendance/override/${recordId}`, { method: 'POST', body })
};
