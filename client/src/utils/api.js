import axios from "axios";
import { host } from "./APIRoutes";
import {
  getAccessToken,
  getRefreshToken,
  saveSession,
  clearSession,
  getUser,
} from "./authStorage";

const api = axios.create({
  baseURL: host,
});

api.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let refreshing = null;

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    const status = error.response?.status;

    if (status !== 401 || original._retry) {
      return Promise.reject(error);
    }

    // Don't try refresh loop on auth endpoints
    if (original.url?.includes("/api/auth/login") || original.url?.includes("/api/auth/register")) {
      return Promise.reject(error);
    }

    original._retry = true;

    const refreshToken = getRefreshToken();
    if (!refreshToken) {
      clearSession();
      window.location.href = "/login";
      return Promise.reject(error);
    }

    try {
      if (!refreshing) {
        refreshing = axios.post(`${host}/api/auth/refresh`, { refreshToken });
      }
      const { data } = await refreshing;
      refreshing = null;

      if (!data.status) {
        clearSession();
        window.location.href = "/login";
        return Promise.reject(error);
      }

      saveSession({
        user: data.user || getUser(),
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
      });

      original.headers.Authorization = `Bearer ${data.accessToken}`;
      return api(original);
    } catch (err) {
      refreshing = null;
      clearSession();
      window.location.href = "/login";
      return Promise.reject(err);
    }
  }
);

export default api;
