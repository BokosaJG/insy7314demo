// Used by the Docker HEALTHCHECK: exits 0 when GET /health answers 200.
// The certificate is self-signed and the check talks to localhost inside the
// container, so certificate verification is skipped here only.
const useHttps = process.env.USE_HTTPS === 'true';
const client = useHttps ? require('https') : require('http');

const req = client.get(
  { host: '127.0.0.1', port: process.env.PORT || 4000, path: '/health', rejectUnauthorized: false, timeout: 4000 },
  (res) => process.exit(res.statusCode === 200 ? 0 : 1)
);
req.on('error', () => process.exit(1));
req.on('timeout', () => { req.destroy(); process.exit(1); });
