const TOKEN_KEY = "adminToken";

export const getAdminToken = () => localStorage.getItem(TOKEN_KEY);

export const setAdminToken = (token) =>
  localStorage.setItem(TOKEN_KEY, token);

export const clearAdminToken = () =>
  localStorage.removeItem(TOKEN_KEY);
