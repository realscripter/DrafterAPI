#!/usr/bin/env node
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import simpleGit from 'simple-git';
import readline from 'readline';

// We need to import these dynamically or handle the fact that they might depend on installed modules
// But for CLI entry point, we should keep it clean.
// The issue is that index.js imports github.js which imports axios.
// If axios isn't installed, index.js fails to load immediately.

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.join(__dirname, '..');

async function runCommand(command, args, cwd = ROOT_DIR) {
    return new Promise((resolve, reject) => {
        const child = spawn(command, args, { cwd, stdio: 'inherit', shell: true });
        child.on('close', (code) => {
            if (code === 0) resolve();
            else reject(new Error(`Command failed with code ${code}`));
        });
    });
}

async function checkUpdate() {
    const git = simpleGit(ROOT_DIR);
    try {
        await git.fetch();
        const status = await git.status();
        if (status.behind > 0) {
            console.log(`\x1b[33m[Update Available]\x1b[0m You are ${status.behind} commits behind.`);
            return true;
        }
        console.log('\x1b[32m[Up to Date]\x1b[0m DrafterAPI is on the latest version.');
        return false;
    } catch (e) {
        console.error('Failed to check for updates:', e.message);
        return false;
    }
}

async function performUpdate() {
    console.log('\x1b[36m[Updater]\x1b[0m Pulling latest changes...');
    const git = simpleGit(ROOT_DIR);
    await git.pull();
    
    console.log('\x1b[36m[Updater]\x1b[0m Installing Server Dependencies...');
    await runCommand('npm', ['install'], path.join(ROOT_DIR, 'server'));

    console.log('\x1b[36m[Updater]\x1b[0m Rebuilding Client...');
    await runCommand('npm', ['install'], path.join(ROOT_DIR, 'client'));
    await runCommand('npm', ['run', 'build'], path.join(ROOT_DIR, 'client'));
    
    console.log('\x1b[32m[Updater]\x1b[0m Update Complete! Please restart the server.');
}

async function main() {
    const args = process.argv.slice(2);
    const command = args[0];

    if (command === 'update') {
        await performUpdate();
        process.exit(0);
    }

    if (command === 'checkupdate') {
        await checkUpdate();
        process.exit(0);
    }

    // Lazy load the actual app so we don't crash if dependencies are missing during 'update'
    // This is a bit of a hack, but necessary if index.js has top-level imports that fail.
    // However, the user is running `node server/index.js key`.
    // We should move the main logic to a separate file or handle imports better.
    
    // For now, let's fix the immediate issue: imports causing crash before we can even run logic.
    // We will dynamically import ./app.js which will contain the previous index.js logic.
    
    try {
        const { run } = await import('./app.js');
        await run(args);
    } catch (e) {
        if (e.code === 'ERR_MODULE_NOT_FOUND') {
            console.error('\x1b[31m[Error]\x1b[0m Dependencies missing. Please run: \x1b[33mcd server && npm install\x1b[0m');
            console.error('Or run the setup script.');
            console.error('Debug:', e.message);
        } else {
            console.error(e);
        }
        process.exit(1);
    }
}

main();
