import fs from 'fs/promises';
import path from 'path';
import { exec } from 'child_process';
import util from 'util';

const execPromise = util.promisify(exec);

const NGINX_SITES_AVAILABLE = '/etc/nginx/sites-available';
const NGINX_SITES_ENABLED = '/etc/nginx/sites-enabled';

export async function setupDomain(projectId, domain, port) {
    if (process.platform === 'win32') {
        throw new Error('Domain management is only supported on Linux with Nginx.');
    }

    const config = `
server {
    listen 80;
    server_name ${domain};

    location / {
        proxy_pass http://127.0.0.1:${port};
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
`;

    const fileName = `drafterapi-${projectId}`;
    const availablePath = path.join(NGINX_SITES_AVAILABLE, fileName);
    const enabledPath = path.join(NGINX_SITES_ENABLED, fileName);

    try {
        await fs.writeFile(availablePath, config);
        await execPromise(`ln -sf ${availablePath} ${enabledPath}`);
        await execPromise('nginx -t && systemctl reload nginx');
        return { success: true };
    } catch (error) {
        console.error('Nginx error:', error);
        throw new Error(`Failed to configure Nginx: ${error.message}`);
    }
}

export async function removeDomain(projectId) {
    if (process.platform === 'win32') return;

    const fileName = `drafterapi-${projectId}`;
    const availablePath = path.join(NGINX_SITES_AVAILABLE, fileName);
    const enabledPath = path.join(NGINX_SITES_ENABLED, fileName);

    try {
        await fs.unlink(enabledPath).catch(() => {});
        await fs.unlink(availablePath).catch(() => {});
        await execPromise('systemctl reload nginx').catch(() => {});
    } catch (error) {
        console.error('Failed to remove Nginx config:', error);
    }
}
