// Convert a Buffer or ArrayBuffer to a base64url string
export function toBase64URL(buffer) {
  return Buffer.from(buffer)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

// Convert a base64url string back to a Buffer
export function fromBase64URL(base64url) {
  return Buffer.from(
    base64url.replace(/-/g, '+').replace(/_/g, '/'),
    'base64'
  );
}
