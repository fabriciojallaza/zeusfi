import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api/v1",
});

let _getToken: (() => string | null) | null = null;
let _onSessionExpired: (() => void) | null = null;

export function configureApiAuth(
  getToken: () => string | null,
  onSessionExpired: () => void,
) {
  _getToken = getToken;
  _onSessionExpired = onSessionExpired;
}

api.interceptors.request.use((config) => {
  const token = _getToken?.();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      _onSessionExpired?.();
    }
    return Promise.reject(error);
  },
);

export default api;
