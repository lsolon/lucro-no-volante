import { auth } from '../firebase';

export async function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const user = auth.currentUser;
  let token: string | null = null;
  
  if (user) {
    try {
      token = await user.getIdToken();
    } catch (e) {
      console.warn("[authFetch] Erro ao obter idToken do usuário:", e);
    }
  }

  const headers = new Headers(options.headers || {});
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  return fetch(url, {
    ...options,
    headers
  });
}
