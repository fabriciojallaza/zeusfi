import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api/v1",
});

let _getToken: (() => string | null) | null = null;
let _logout: (() => void) | null = null;

export function configureApiAuth(
  getToken: () => string | null,
  logout: () => void,
) {
  _getToken = getToken;
  _logout = logout;
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
      _logout?.();
    }
    return Promise.reject(error);
  },
);

export default api;
