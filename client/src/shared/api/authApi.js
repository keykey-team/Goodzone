const apiBase = "http://localhost:4000/api";

export const loginAdmin = async (login, password) => {
  const res = await fetch(`${apiBase}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ login, password }),
  });

  const data = await res.json();
  if (!res.ok || !data.ok) {
    throw new Error(data.message || "Помилка входу");
  }
  return data.token;
};
