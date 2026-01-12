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
const logs = new Map(); // projectId -> []

export function getLogs(projectId) {
  return logs.get(projectId) || [];
}

function addLog(projectId, message, type = 'stdout') {
    if (!logs.has(projectId)) logs.set(projectId, []);
    const projectLogs = logs.get(projectId);
    const logEntry = {
        id: Date.now() + Math.random(),
        timestamp: new Date().toISOString(),
        message,
        type
    };
    projectLogs.push(logEntry);
    
    // Keep last 1000 lines
    if (projectLogs.length > 1000) projectLogs.shift();
    
    return logEntry;
}

export async function setupProject(projectId, io) {
    const project = await getProject(projectId);
    if (!project) throw new Error('Project not found');
    
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
    }, 2000);

    processes.set(projectId, { process: child, monitorInterval });
    
    updateProject(projectId, { status: 'running' });
    io.emit('project:update', { id: projectId, status: 'running' });

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
    }
}

export function getProjectStatus(projectId) {
    return processes.has(projectId) ? 'running' : 'stopped';
}
