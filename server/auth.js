import fs from 'fs/promises';
import path from 'path';
import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = path.join(__dirname, 'config.json');

async function readConfig() {
  try {
    const data = await fs.readFile(CONFIG_PATH, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    return {};
  }
}

async function writeConfig(config) {
  await fs.writeFile(CONFIG_PATH, JSON.stringify(config, null, 2));
}

export async function hasKey() {
  const config = await readConfig();
  return !!config.authKeyHash;
}

export async function generateKey() {
  const existing = await hasKey();
  if (existing) {
    throw new Error('Key already exists. Use "drafterapi keyreset" to reset it.');
  }
  
  const key = uuidv4();
  const hash = await bcrypt.hash(key, 10);
  
  const config = await readConfig();
  config.authKeyHash = hash;
  await writeConfig(config);
  
  return key;
}

export async function validateKey(key) {
  const config = await readConfig();
  if (!config.authKeyHash) return false;
  return await bcrypt.compare(key, config.authKeyHash);
}

export async function resetKey() {
  const config = await readConfig();
  delete config.authKeyHash;
  await writeConfig(config);
}
