import api from './client';

export const authApi = {
  login: (data) => api.post('/auth/login', data),
  me: () => api.get('/auth/me'),
  changePassword: (data) => api.patch('/auth/change-password', data),
  resetPassword: (userId) => api.post(`/auth/reset-password/${userId}`),
  updateProfile: (data)   => api.patch('/auth/profile', data),
};

export const attendanceApi = {
  clockIn: () => api.post('/attendance/clock-in'),
  clockOut: () => api.post('/attendance/clock-out'),
  today: () => api.get('/attendance/today'),
  myHistory: (params) => api.get('/attendance/my-history', { params }),
  teamAttendance: (params) => api.get('/attendance/team', { params }),
  calendar: (params) => api.get('/attendance/calendar', { params }),
};

export const leaveApi = {
  apply:    (data)     => api.post('/leaves', data),
  myLeaves: (params)   => api.get('/leaves/my', { params }),
  cancel:   (id)       => api.patch(`/leaves/${id}/cancel`),
  pending:  (params)   => api.get('/leaves/pending', { params }),
  tlReview: (id, data) => api.patch(`/leaves/${id}/tl-review`, data),
  hrReview: (id, data) => api.patch(`/leaves/${id}/hr-review`, data),
};

export const userApi = {
  create: (data) => api.post('/users', data),
  list: (params) => api.get('/users', { params }),
  get: (id) => api.get(`/users/${id}`),
  update: (id, data) => api.patch(`/users/${id}`, data),
  terminate: (id) => api.delete(`/users/${id}`),
  reactivate: (id) => api.patch(`/users/${id}/reactivate`),
  departments: () => api.get('/users/departments'),
  leaveBalances: () => api.get('/users/leave-balances'),
};

export const idleApi = {
  heartbeat: (data) => api.post('/idle/heartbeat', data),
  mySummary: (params) => api.get('/idle/my', { params }),
  detail: (params) => api.get('/idle/detail', { params }),
  teamSummary: (params) => api.get('/idle/team', { params }),
  live: () => api.get('/idle/live'),
};

export const reportApi = {
  dashboard: () => api.get('/reports/dashboard'),
  attendance: (params) => api.get('/reports/attendance', { params }),
  leaves: (params) => api.get('/reports/leaves', { params }),
  idle: (params) => api.get('/reports/idle', { params }),
};

export const masterApi = {
  // Departments
  listDepartments:    ()          => api.get('/master/departments'),
  createDepartment:   (data)      => api.post('/master/departments', data),
  updateDepartment:   (id, data)  => api.patch(`/master/departments/${id}`, data),
  deleteDepartment:   (id)        => api.delete(`/master/departments/${id}`),
  // Designations
  listDesignations:   ()          => api.get('/master/designations'),
  createDesignation:  (data)      => api.post('/master/designations', data),
  updateDesignation:  (id, data)  => api.patch(`/master/designations/${id}`, data),
  deleteDesignation:  (id)        => api.delete(`/master/designations/${id}`),
  // Holidays
  listHolidays:       ()          => api.get('/master/holidays'),
  createHoliday:      (data)      => api.post('/master/holidays', data),
  updateHoliday:      (id, data)  => api.patch(`/master/holidays/${id}`, data),
  deleteHoliday:      (id)        => api.delete(`/master/holidays/${id}`),
  // Shift Templates
  listShifts:         ()          => api.get('/master/shifts'),
  createShift:        (data)      => api.post('/master/shifts', data),
  updateShift:        (id, data)  => api.patch(`/master/shifts/${id}`, data),
  deleteShift:        (id)        => api.delete(`/master/shifts/${id}`),
};

export const announcementApi = {
  list:   (params) => api.get('/announcements', { params }),
  create: (data)   => api.post('/announcements', data),
  update: (id, data) => api.patch(`/announcements/${id}`, data),
  remove: (id)     => api.delete(`/announcements/${id}`),
};
