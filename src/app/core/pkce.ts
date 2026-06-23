function base64UrlEncode(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function dec2hex(dec: number): string {
  return dec.toString(16).padStart(2, '0');
}

export function generateCodeVerifier(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array).map(dec2hex).join('');
}

export async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return base64UrlEncode(digest);
}

const STORAGE_KEY = 'pkce_code_verifier';

export function storeCodeVerifier(verifier: string): void {
  sessionStorage.setItem(STORAGE_KEY, verifier);
}

export function getStoredCodeVerifier(): string | null {
  return sessionStorage.getItem(STORAGE_KEY);
}

export function clearCodeVerifier(): void {
  sessionStorage.removeItem(STORAGE_KEY);
}
