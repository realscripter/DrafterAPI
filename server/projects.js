import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECTS_PATH = path.join(__dirname, 'projects.json');

async function readProjects() {
  try {
    const data = await fs.readFile(PROJECTS_PATH, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    return [];
  }
}

async function writeProjects(projects) {
  await fs.writeFile(PROJECTS_PATH, JSON.stringify(projects, null, 2));
}

export async function listProjects() {
  return await readProjects();
}

export async function getProject(id) {
  const projects = await readProjects();
  return projects.find(p => p.id === id);
}

export async function createProject(data) {
  const projects = await readProjects();
  const newProject = {
    id: uuidv4(),
    createdAt: new Date().toISOString(),
    status: 'stopped', // stopped, running, error
    ...data
  };
  projects.push(newProject);
  await writeProjects(projects);
  return newProject;
}

export async function updateProject(id, data) {
    const projects = await readProjects();
    const index = projects.findIndex(p => p.id === id);
    if (index === -1) throw new Error('Project not found');
    
    projects[index] = { ...projects[index], ...data };
    await writeProjects(projects);
    return projects[index];
}

export async function deleteProject(id) {
  const projects = await readProjects();
  const newProjects = projects.filter(p => p.id !== id);
  await writeProjects(newProjects);
}
