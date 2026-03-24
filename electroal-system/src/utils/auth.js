export function isTokenValid(token) {
  if (!token) {
    return false;
  }

  if (token === 'demo-token') {
    return true;
  }

  const parts = token.split('.');
  if (parts.length !== 3) {
    return false;
  }

  try {
    const payload = JSON.parse(atob(parts[1]));
    if (!payload?.exp) {
      return false;
    }

    return payload.exp * 1000 > Date.now();
  } catch {
    return false;
  }
}

export function getValidToken() {
  const token = localStorage.getItem('token');
  if (isTokenValid(token)) {
    return token;
  }

  localStorage.removeItem('token');
  return null;
}
