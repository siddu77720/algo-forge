let rawUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
if (!rawUrl.startsWith('http://') && !rawUrl.startsWith('https://')) {
  rawUrl = (rawUrl.includes('localhost') ? 'http://' : 'https://') + rawUrl;
}
export const API_URL = rawUrl.replace(/\/$/, '');
