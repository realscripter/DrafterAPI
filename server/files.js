import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECTS_DIR = path.join(__dirname, 'projects_data');

function getProjectPath(projectId, subpath = '') {
    // Prevent directory traversal
    const safeSubpath = path.normalize(subpath).replace(/^(\.\.[\/\\])+/, '');
    return path.join(PROJECTS_DIR, projectId, safeSubpath);
}

export async function listFiles(projectId, subpath = '') {
    const fullPath = getProjectPath(projectId, subpath);
    try {
        const entries = await fs.readdir(fullPath, { withFileTypes: true });
        return entries.map(entry => ({
            name: entry.name,
            isDirectory: entry.isDirectory(),
            path: path.join(subpath, entry.name).replace(/\\/g, '/')
        }));
    } catch (e) {
        return [];
    }
}

export async function readFile(projectId, subpath) {
    const fullPath = getProjectPath(projectId, subpath);
    return await fs.readFile(fullPath, 'utf-8');
}

export async function saveFile(projectId, subpath, content) {
    const fullPath = getProjectPath(projectId, subpath);
    await fs.writeFile(fullPath, content);
}
