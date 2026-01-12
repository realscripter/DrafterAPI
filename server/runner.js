import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import simpleGit from 'simple-git';
import pidusage from 'pidusage';
import { getProject, updateProject } from './projects.js';
import { getGithubToken } from './github.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECTS_DIR = path.join(__dirname, 'projects_data');

// Ensure projects dir exists
fs.mkdir(PROJECTS_DIR, { recursive: true }).catch(() => {});

const processes = new Map(); // projectId -> { process, monitorInterval }
const inMemoryLogs = new Map(); // projectId -> []

async function getLogPath(projectId) {
    const dir = path.join(PROJECTS_DIR, projectId);
    await fs.mkdir(dir, { recursive: true }).catch(() => {});
    return path.join(dir, 'logs.json');
}

async function getEventPath(projectId) {
    const dir = path.join(PROJECTS_DIR, projectId);
    await fs.mkdir(dir, { recursive: true }).catch(() => {});
    return path.join(dir, 'events.json');
}

export async function getEvents(projectId) {
    try {
        const eventPath = await getEventPath(projectId);
        const data = await fs.readFile(eventPath, 'utf-8');
        return JSON.parse(data);
    } catch {
        return [];
    }
}

async function addEvent(projectId, type, message) {
    const events = await getEvents(projectId);
    const event = {
        id: Date.now() + Math.random(),
        timestamp: new Date().toISOString(),
        type, // 'info', 'error', 'success', 'warning'
        message
    };
    events.unshift(event);
    if (events.length > 100) events.pop(); // Keep last 100 events
    
    const eventPath = await getEventPath(projectId);
    await fs.writeFile(eventPath, JSON.stringify(events, null, 2)).catch(() => {});
    return event;
}

export async function getLogs(projectId) {
  try {
    const logPath = await getLogPath(projectId);
    const data = await fs.readFile(logPath, 'utf-8');
    return JSON.parse(data);
  } catch (e) {
    return inMemoryLogs.get(projectId) || [];
  }
}

export async function clearLogs(projectId) {
    const logPath = await getLogPath(projectId);
    await fs.writeFile(logPath, JSON.stringify([]));
    inMemoryLogs.set(projectId, []);
}

async function addLog(projectId, message, type = 'stdout') {
    if (!inMemoryLogs.has(projectId)) {
        inMemoryLogs.set(projectId, await getLogs(projectId));
    }
    const projectLogs = inMemoryLogs.get(projectId);
    const logEntry = {
        id: Date.now() + Math.random(),
        timestamp: new Date().toISOString(),
        message,
        type
    };
    projectLogs.push(logEntry);
    
    // Keep last 2000 lines in memory and disk
    if (projectLogs.length > 2000) projectLogs.shift();
    
    // Persist to disk (debounce this in real app, but for now simple)
    const logPath = await getLogPath(projectId);
    await fs.writeFile(logPath, JSON.stringify(projectLogs, null, 2)).catch(() => {});
    
    return logEntry;
}

export async function setupProject(projectId, io) {
    const project = await getProject(projectId);
    if (!project) throw new Error('Project not found');
    
    addEvent(projectId, 'info', 'Starting project setup (Clone/Install/Build)...');

    const projectPath = path.join(PROJECTS_DIR, projectId);
    const token = await getGithubToken();
    
    // Clone if not exists
    try {
        await fs.access(projectPath);
        // Exists, maybe pull?
        addLog(projectId, 'Project directory exists. pulling...', 'info');
        const git = simpleGit(projectPath);
        await git.pull();
    } catch {
        // Clone
        addLog(projectId, 'Cloning repository...', 'info');
        const repoUrlWithAuth = project.repoUrl.replace('https://', `https://${token}@`);
        await simpleGit().clone(repoUrlWithAuth, projectPath);
    }
    
    // Install
    if (project.installCmd) {
        addLog(projectId, `Running install: ${project.installCmd}`, 'info');
        // We run this synchronously-ish (awaiting promise) but utilizing spawn to stream logs
        await runCommand(projectId, project.installCmd, projectPath, io);
    }

    // Build
    if (project.buildCmd) {
        addLog(projectId, `Running build: ${project.buildCmd}`, 'info');
        await runCommand(projectId, project.buildCmd, projectPath, io);
    }
}

function runCommand(projectId, command, cwd, io) {
    return new Promise((resolve, reject) => {
        const [cmd, ...args] = command.split(' ');
        const child = spawn(cmd, args, { cwd, shell: true });
        
        child.stdout.on('data', (data) => {
            const msg = data.toString();
            const log = addLog(projectId, msg, 'stdout');
            io.to(`project:${projectId}`).emit('log', log);
        });
        
        child.stderr.on('data', (data) => {
            const msg = data.toString();
            const log = addLog(projectId, msg, 'stderr');
            io.to(`project:${projectId}`).emit('log', log);
        });
        
        child.on('close', (code) => {
            if (code === 0) resolve();
            else reject(new Error(`Command failed with code ${code}`));
        });
    });
}

export async function startProject(projectId, io) {
    if (processes.has(projectId)) throw new Error('Project already running');
    
    const project = await getProject(projectId);
    const projectPath = path.join(PROJECTS_DIR, projectId);
    
    addLog(projectId, `Starting project: ${project.startCmd}`, 'info');
    addEvent(projectId, 'info', `Starting project: ${project.startCmd}`);
    
    // Setup (Clone/Install/Build) if not done? 
    // For now assume setup is done via a separate "Install/Build" action or auto-done.
    // Let's auto-setup if folder missing.
    try {
        await fs.access(projectPath);
    } catch {
        await setupProject(projectId, io);
    }

    const [cmd, ...args] = project.startCmd.split(' ');
    const child = spawn(cmd, args, { cwd: projectPath, shell: true });
    
    const monitorInterval = setInterval(async () => {
        try {
            const stats = await pidusage(child.pid);
            // RAM check
            const ramUsageMB = stats.memory / 1024 / 1024;
            io.to(`project:${projectId}`).emit('stats', { 
                cpu: stats.cpu, 
                memory: ramUsageMB, 
                uptime: stats.elapsed 
            });
            
            if (project.ramLimit && ramUsageMB > project.ramLimit) {
                addLog(projectId, `RAM Limit Exceeded (${ramUsageMB.toFixed(2)}MB > ${project.ramLimit}MB). Killing process.`, 'error');
                stopProject(projectId);
            }
        } catch (e) {
            // Process might be dead
        }
    }, 1000);

    processes.set(projectId, { process: child, monitorInterval });
    
    updateProject(projectId, { status: 'running' });
    io.emit('project:update', { id: projectId, status: 'running' });
    addEvent(projectId, 'success', 'Project started successfully');

    child.stdout.on('data', (data) => {
        const msg = data.toString();
        const log = addLog(projectId, msg, 'stdout');
        io.to(`project:${projectId}`).emit('log', log);
    });

    child.stderr.on('data', (data) => {
        const msg = data.toString();
        const log = addLog(projectId, msg, 'stderr');
        io.to(`project:${projectId}`).emit('log', log);
    });

    child.on('close', (code) => {
        clearInterval(monitorInterval);
        processes.delete(projectId);
        updateProject(projectId, { status: 'stopped' });
        io.emit('project:update', { id: projectId, status: 'stopped' });
        addLog(projectId, `Process exited with code ${code}`, 'info');
        if (code !== 0 && code !== null) {
            addEvent(projectId, 'error', `Process exited with code ${code}`);
        } else {
            addEvent(projectId, 'info', 'Process stopped');
        }
    });
}

export async function stopProject(projectId) {
    const data = processes.get(projectId);
    if (data) {
        clearInterval(data.monitorInterval);
        // Tree kill might be needed for shell spawns
        data.process.kill();
        // Force update status just in case
        updateProject(projectId, { status: 'stopped' });
        processes.delete(projectId);
        addEvent(projectId, 'info', 'Project stopped manually');
    }
}

export async function pullProject(projectId, io) {
    const project = await getProject(projectId);
    const projectPath = path.join(PROJECTS_DIR, projectId);
    const wasRunning = processes.has(projectId);
    
    // Check if running
    if (wasRunning) {
        if (!project.autoDeploy) {
            throw new Error('Cannot pull updates while project is running. Stop it first.');
        }
        addLog(projectId, 'Stopping project for auto-deploy...', 'info');
        addEvent(projectId, 'info', 'Stopping project for auto-deploy');
        await stopProject(projectId);
        // Wait a bit for cleanup
        await new Promise(r => setTimeout(r, 1000));
    }
    
    try {
        await fs.access(projectPath);
    } catch {
        throw new Error('Project directory does not exist. Start project to clone it.');
    }
    
    const token = await getGithubToken();
    addLog(projectId, 'Pulling latest changes from GitHub...', 'info');
    addEvent(projectId, 'info', 'Pulling latest changes from GitHub...');
    io.to(`project:${projectId}`).emit('log', { 
        id: Date.now(), 
        timestamp: new Date().toISOString(), 
        message: 'Pulling latest changes from GitHub...', 
        type: 'info' 
    });
    
    const git = simpleGit(projectPath);
    // If token exists, we might need to update remote url if it expired or changed, but usually it's embedded or credential helper used.
    // For now assume the one used at clone works or we re-form it.
    
    // Actually, simple-git uses the .git/config. If we used a token in URL, it's there.
    // If we want to support token rotation, we should update the remote origin URL.
    const repoUrlWithAuth = project.repoUrl.replace('https://', `https://${token}@`);
    
    try {
        await git.removeRemote('origin');
    } catch {}
    await git.addRemote('origin', repoUrlWithAuth);

    const result = await git.pull('origin', 'main'); // Assume main for now, or detect default branch
    
    const msg = `Pull complete: ${JSON.stringify(result.summary)}`;
    addLog(projectId, msg, 'info');
    addEvent(projectId, 'success', 'Git pull completed');
    io.to(`project:${projectId}`).emit('log', { 
        id: Date.now(), 
        timestamp: new Date().toISOString(), 
        message: msg, 
        type: 'info' 
    });

    if (project.autoDeploy) {
        addLog(projectId, 'Auto-Deploy: Running Install/Build...', 'info');
        addEvent(projectId, 'info', 'Auto-Deploy: Running Install/Build...');
        
        if (project.installCmd) {
            await runCommand(projectId, project.installCmd, projectPath, io);
        }
        if (project.buildCmd) {
            await runCommand(projectId, project.buildCmd, projectPath, io);
        }
        
        addLog(projectId, 'Auto-Deploy: Restarting project...', 'info');
        addEvent(projectId, 'info', 'Auto-Deploy: Restarting project');
        await startProject(projectId, io);
    }
}

export async function stopAllProjects() {
    console.log('Stopping all project instances...');
    for (const projectId of processes.keys()) {
        await stopProject(projectId);
    }
}

export function getProjectStatus(projectId) {
    return processes.has(projectId) ? 'running' : 'stopped';
}
