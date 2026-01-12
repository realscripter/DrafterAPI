#!/usr/bin/env node
import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';
import { generateKey, resetKey, validateKey, hasKey } from './auth.js';
import { saveGithubToken, getGithubToken, listRepos, getUser, readConfig, writeConfig } from './github.js';
import { listProjects, createProject, getProject, deleteProject, updateProject } from './projects.js';
import { startProject, stopProject, getLogs, setupProject, clearLogs, stopAllProjects, pullProject, getEvents } from './runner.js';
import { listFiles, readFile, saveFile } from './files.js';
import { setupDomain, removeDomain } from './domains.js';
import readline from 'readline';
import axios from 'axios';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);

const PORT = process.env.PORT || 8000;

export async function run(args) {
  const command = args[0];

  if (command === 'key') {
    try {
      const key = await generateKey();
      console.log('Generated Login Key:', key);
      console.log('Save this key! You will not be able to see it again.');
    } catch (err) {
      console.error(err.message);
    }
    process.exit(0);
  }

  if (command === 'keyreset') {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    rl.question('Are you sure you want to reset the login key? (y/n) ', async (answer) => {
      if (answer.toLowerCase() === 'y') {
        await resetKey();
        console.log('Key reset successfully. Run "drafterapi key" to generate a new one.');
      } else {
        console.log('Cancelled.');
      }
      rl.close();
      process.exit(0);
    });
    return;
  }

  if (command === 'github-oauth') {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    rl.question('GitHub Client ID: ', async (clientId) => {
      if (!clientId) {
        console.log('Client ID is required.');
        rl.close();
        process.exit(1);
      }

      rl.question('GitHub Client Secret: ', async (clientSecret) => {
        if (!clientSecret) {
          console.log('Client Secret is required.');
          rl.close();
          process.exit(1);
        }

        try {
          const config = await readConfig();
          config.githubClientId = clientId;
          config.githubClientSecret = clientSecret;
          await writeConfig(config);
          console.log('GitHub OAuth credentials saved successfully!');
          console.log('Restart the server to use OAuth login.');
        } catch (err) {
          console.error('Failed to save credentials:', err.message);
        }
        rl.close();
        process.exit(0);
      });
    });
    return;
  }

  // Check if key exists
  const keyExists = await hasKey();
  if (!keyExists) {
    console.log('No login key found. Please run "node index.js key" (or "drafterapi key") to generate one first.');
    // We allow starting but login will be impossible without key
  }

  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: {
      origin: '*', // Allow dev frontend
    }
  });

  app.use(cors());
  app.use(express.json());

  // API Routes
  app.post('/api/login', async (req, res) => {
    const { key } = req.body;
    if (await validateKey(key)) {
      // In a real app, issue a JWT token. For simplicity, we just return success
      // and the frontend can store the key (or we can sign a token).
      // Let's use the key as the token for now since it's a simple tool.
      res.json({ success: true, token: key }); 
    } else {
      res.status(401).json({ success: false, message: 'Invalid key' });
    }
  });

  // Middleware to check auth
  const authMiddleware = async (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (token && await validateKey(token)) {
      next();
    } else {
      res.status(401).json({ error: 'Unauthorized' });
    }
  };

  app.use('/api', authMiddleware);

  app.get('/api/status', (req, res) => {
    res.json({ status: 'running', port: PORT });
  });

  // GitHub Routes
  app.get('/api/github/status', async (req, res) => {
    const user = await getUser();
    res.json({ connected: !!user, user });
  });

  // GitHub OAuth - Start OAuth flow
  app.get('/api/github/oauth', async (req, res) => {
    const config = await readConfig();
    const clientId = config.githubClientId;
    
    if (!clientId) {
      return res.status(400).json({ error: 'GitHub OAuth not configured. Please set GITHUB_CLIENT_ID in config.' });
    }

    const redirectUri = `${req.protocol}://${req.get('host')}/api/github/callback`;
    const scope = 'repo user:email';
    const state = Math.random().toString(36).substring(7); // Simple state for CSRF protection
    
    // Store state in config temporarily
    config.oauthState = state;
    await writeConfig(config);
    
    const githubAuthUrl = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scope}&state=${state}`;
    res.json({ authUrl: githubAuthUrl });
  });

  // GitHub OAuth - Callback handler
  app.get('/api/github/callback', async (req, res) => {
    const { code, state } = req.query;
    const config = await readConfig();
    
    if (!code) {
      return res.redirect('/dashboard?error=oauth_failed');
    }

    // Verify state
    if (state !== config.oauthState) {
      return res.redirect('/dashboard?error=invalid_state');
    }

    try {
      // Exchange code for access token
      const tokenResponse = await axios.post('https://github.com/login/oauth/access_token', {
        client_id: config.githubClientId,
        client_secret: config.githubClientSecret,
        code: code,
      }, {
        headers: {
          Accept: 'application/json',
        }
      });

      const accessToken = tokenResponse.data.access_token;
      if (!accessToken) {
        throw new Error('No access token received');
      }

      // Save token
      await saveGithubToken(accessToken);
      
      // Clean up state
      delete config.oauthState;
      await writeConfig(config);

      // Redirect to dashboard
      res.redirect('/dashboard?github_connected=true');
    } catch (error) {
      console.error('OAuth error:', error);
      res.redirect('/dashboard?error=oauth_failed');
    }
  });

  // Legacy PAT support (still works)
  app.post('/api/github/connect', async (req, res) => {
    const { token } = req.body;
    if (!token) return res.status(400).json({ error: 'Token required' });
    
    // Validate token
    try {
        await saveGithubToken(token);
        const user = await getUser(); // Verify it works
        if (!user) throw new Error('Invalid token');
        res.json({ success: true, user });
    } catch (e) {
        res.status(400).json({ error: 'Invalid GitHub token' });
    }
  });

  app.get('/api/github/repos', async (req, res) => {
    try {
      const repos = await listRepos();
      res.json(repos);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Project Routes
  app.get('/api/projects', async (req, res) => {
    const projects = await listProjects();
    res.json(projects);
  });

  app.post('/api/projects', async (req, res) => {
    try {
      const project = await createProject(req.body);
      res.json(project);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/projects/:id', async (req, res) => {
    const project = await getProject(req.params.id);
    if (!project) return res.status(404).json({ error: 'Not found' });
    res.json(project);
  });

  app.put('/api/projects/:id', async (req, res) => {
    try {
      const project = await updateProject(req.params.id, req.body);
      res.json(project);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/projects/:id', async (req, res) => {
    await removeDomain(req.params.id);
    await deleteProject(req.params.id);
    res.json({ success: true });
  });

  app.post('/api/projects/:id/domain', async (req, res) => {
    const { domain, port } = req.body;
    try {
        await setupDomain(req.params.id, domain, port);
        await updateProject(req.params.id, { domain });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/projects/:id/domain', async (req, res) => {
    try {
        await removeDomain(req.params.id);
        await updateProject(req.params.id, { domain: null });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
  });

  // Runner Routes
  app.post('/api/projects/:id/start', async (req, res) => {
    try {
      await startProject(req.params.id, io);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/projects/:id/stop', async (req, res) => {
    try {
      await stopProject(req.params.id);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/projects/:id/pull', async (req, res) => {
    try {
      await pullProject(req.params.id, io);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/projects/:id/logs', async (req, res) => {
    res.json(await getLogs(req.params.id));
  });

  app.get('/api/projects/:id/events', async (req, res) => {
    res.json(await getEvents(req.params.id));
  });

  app.delete('/api/projects/:id/logs', async (req, res) => {
    try {
      await clearLogs(req.params.id);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // File Routes
  app.get('/api/projects/:id/files', async (req, res) => {
    try {
        const files = await listFiles(req.params.id, req.query.path?.toString() || '');
        res.json(files);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
  });

  app.get('/api/projects/:id/files/content', async (req, res) => {
    try {
        const content = await readFile(req.params.id, req.query.path?.toString() || '');
        res.json({ content });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/projects/:id/files/content', async (req, res) => {
    try {
        await saveFile(req.params.id, req.query.path?.toString() || '', req.body.content);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
  });

  // Socket.io
  io.on('connection', (socket) => {
    socket.on('join-project', (projectId) => {
        socket.join(`project:${projectId}`);
    });
    
    socket.on('leave-project', (projectId) => {
        socket.leave(`project:${projectId}`);
    });
  });


  // Serve Frontend (Production)
  // Serve static files from the 'dist' directory
  app.use(express.static(path.join(__dirname, '../client/dist')));

  // Handle SPA routing
  // Express 5 routing fix for SPA using Splat
  app.get(/(.*)/, (req, res, next) => {
    if (req.path.startsWith('/api')) {
        return next();
    }
    res.sendFile(path.join(__dirname, '../client/dist/index.html'));
  });

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`DrafterApi running on port ${PORT}`);
    console.log(`Access dashboard at http://localhost:${PORT}`);
  });

  // Handle exit
  const cleanup = async () => {
    await stopAllProjects();
    process.exit(0);
  };

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
}

// main();
