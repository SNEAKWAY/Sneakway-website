const STORAGE_KEY = "sneakway_admin_token";
const AUTH_EVENT = "sneakway-auth";

export const getAuthToken = () => localStorage.getItem(STORAGE_KEY);

export const setAuthToken = (token) => {
  localStorage.setItem(STORAGE_KEY, token);
  window.dispatchEvent(new Event(AUTH_EVENT));
};

export const clearAuthToken = () => {
  localStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(new Event(AUTH_EVENT));
};

export const isAuthed = () => Boolean(getAuthToken());

export const getAuthHeader = () => {
  const token = getAuthToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export const subscribeToAuth = (callback) => {
  const handler = () => callback(isAuthed());
  window.addEventListener(AUTH_EVENT, handler);
  return () => window.removeEventListener(AUTH_EVENT, handler);
};
