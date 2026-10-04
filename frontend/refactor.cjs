const fs = require('fs');
const path = require('path');

const configCode = `let rawUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
if (!rawUrl.startsWith('http://') && !rawUrl.startsWith('https://')) {
  rawUrl = (rawUrl.includes('localhost') ? 'http://' : 'https://') + rawUrl;
}
export const API_URL = rawUrl.replace(/\\/$/, '');
`;
fs.writeFileSync(path.join(__dirname, 'src/config.ts'), configCode);

const filesToUpdate = [
  'src/components/Chart.tsx',
  'src/lib/socket.ts',
  'src/pages/Admin.tsx',
  'src/pages/Dashboard.tsx',
  'src/pages/History.tsx',
  'src/pages/Landing.tsx',
  'src/pages/Login.tsx'
];

for (const file of filesToUpdate) {
  const filePath = path.join(__dirname, file);
  let content = fs.readFileSync(filePath, 'utf8');
  
  if (file === 'src/lib/socket.ts') {
    content = `import { API_URL } from '../config';\n` + content.replace(/const API_URL = [^;\n]+;\n/g, '');
  } else if (file === 'src/pages/History.tsx') {
    content = content.replace(/const API_URL = [^;\n]+;\n\s*/g, '');
    content = `import { API_URL } from '../config';\n` + content;
  } else {
    content = `import { API_URL } from '../config';\n` + content;
    // Replace 'http://localhost:5000...' with `${API_URL}...`
    content = content.replace(/'http:\/\/localhost:5000([^']*)'/g, '`${API_URL}$1`');
    content = content.replace(/`http:\/\/localhost:5000([^`]*)`/g, '`${API_URL}$1`');
  }
  
  fs.writeFileSync(filePath, content);
}
console.log('Refactor complete');
