import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = path.join(__dirname, 'config.json');

export async function readConfig() {
  try {
    const data = await fs.readFile(CONFIG_PATH, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    return {};
  }
}

export async function writeConfig(config) {
  await fs.writeFile(CONFIG_PATH, JSON.stringify(config, null, 2));
}

export async function saveGithubToken(token) {
  const config = await readConfig();
  config.githubToken = token;
  await writeConfig(config);
}

export async function getGithubToken() {
  const config = await readConfig();
  return config.githubToken;
}

export async function listRepos() {
  const token = await getGithubToken();
  if (!token) throw new Error('GitHub token not found');

  try {
    const response = await axios.get('https://api.github.com/user/repos', {
      headers: {
        Authorization: `token ${token}`,
        Accept: 'application/vnd.github.v3+json',
      },
      params: {
        sort: 'updated',
        per_page: 100,
        visibility: 'all', // private and public
      }
    });
    return response.data;
  } catch (error) {
    console.error('Error fetching repos:', error.response?.data || error.message);
    throw new Error('Failed to fetch repositories');
  }
}

export async function getUser() {
    const token = await getGithubToken();
    if (!token) return null;
    try {
        const response = await axios.get('https://api.github.com/user', {
            headers: { Authorization: `token ${token}` }
        });
        return response.data;
    } catch (e) {
        return null;
    }
}
