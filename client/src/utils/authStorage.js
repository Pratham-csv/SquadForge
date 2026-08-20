const USER_KEY = process.env.REACT_APP_LOCALHOST_KEY || "squadforge-user";
const ACCESS_KEY = "squadforge-access-token";
const REFRESH_KEY = "squadforge-refresh-token";

export function saveSession({ user, accessToken, refreshToken }) {
  if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
  if (accessToken) localStorage.setItem(ACCESS_KEY, accessToken);
  if (refreshToken) localStorage.setItem(REFRESH_KEY, refreshToken);
}

export function getUser() {
  const raw = localStorage.getItem(USER_KEY);
  return raw ? JSON.parse(raw) : null;
}

export function getAccessToken() {
  return localStorage.getItem(ACCESS_KEY);
}

export function getRefreshToken() {
  return localStorage.getItem(REFRESH_KEY);
}

export function clearSession() {
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
}

export function updateStoredUser(user) {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}
