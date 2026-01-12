#!/usr/bin/env node
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

// NOTE: This file must NOT have any external dependencies (like simple-git or axios)
// at the top level, otherwise it will crash before it can tell the user to install them.

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

async function getSimpleGit() {
    try {
        const simpleGit = (await import('simple-git')).default;
        return simpleGit;
    } catch (e) {
        throw new Error('Dependency "simple-git" is missing.');
    }
}

async function checkUpdate() {
    try {
        const simpleGit = await getSimpleGit();
        const git = simpleGit(ROOT_DIR);
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
        if (e.message.includes('simple-git')) {
             console.log('Run \x1b[33mnpm install\x1b[0m in the server directory first.');
        }
        return false;
    }
}

async function performUpdate() {
    try {
        const simpleGit = await getSimpleGit();
        console.log('\x1b[36m[Updater]\x1b[0m Pulling latest changes...');
        const git = simpleGit(ROOT_DIR);
        await git.pull();
        
        console.log('\x1b[36m[Updater]\x1b[0m Installing Server Dependencies...');
        await runCommand('npm', ['install'], path.join(ROOT_DIR, 'server'));

        console.log('\x1b[36m[Updater]\x1b[0m Rebuilding Client...');
        await runCommand('npm', ['install'], path.join(ROOT_DIR, 'client'));
        await runCommand('npm', ['run', 'build'], path.join(ROOT_DIR, 'client'));
        
        console.log('\x1b[32m[Updater]\x1b[0m Update Complete! Please restart the server.');
    } catch(e) {
        console.error('\x1b[31m[Update Failed]\x1b[0m', e.message);
        if (e.message.includes('simple-git')) {
             // If simple-git is missing, we can try to install server deps first manually using child_process
             console.log('Attempting to install server dependencies directly...');
             try {
                await runCommand('npm', ['install'], path.join(ROOT_DIR, 'server'));
                console.log('Dependencies installed. Retrying update...');
                // We could recurse here, but let's just ask user to run it again to be safe
                console.log('Please run the update command again.');
             } catch(err) {
                 console.error('Failed to install dependencies automatically.');
             }
        }
    }
}

async function main() {
    const args = process.argv.slice(2);
    const command = args[0];

    // Explicit check for node_modules in server directory
    const nodeModulesPath = path.join(__dirname, 'node_modules');
    if (!fs.existsSync(nodeModulesPath)) {
        console.error('\x1b[31m[Error]\x1b[0m Server dependencies are missing.');
        console.log('\x1b[33mInstalling dependencies now...\x1b[0m');
        try {
            await runCommand('npm', ['install'], __dirname);
            console.log('\x1b[32mDependencies installed successfully!\x1b[0m');
            // Continue execution...
        } catch (e) {
            console.error('\x1b[31mFailed to install dependencies automatically.\x1b[0m');
            console.error('Please run: \x1b[33mcd server && npm install\x1b[0m');
            process.exit(1);
        }
    }

    if (command === 'update') {
        await performUpdate();
        process.exit(0);
    }

    if (command === 'checkupdate') {
        await checkUpdate();
        process.exit(0);
    }
    
    try {
        const { run } = await import('./app.js');
        await run(args);
    } catch (e) {
        console.error('\x1b[31m[Error]\x1b[0m Failed to start application.');
        if (e.code === 'ERR_MODULE_NOT_FOUND') {
            console.error('Missing dependencies:', e.message);
            console.error('Try running: \x1b[33mcd server && npm install\x1b[0m');
        } else {
            console.error(e);
        }
        process.exit(1);
    }
}

main();
