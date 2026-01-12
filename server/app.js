#!/usr/bin/env node
import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';
import { generateKey, resetKey, validateKey, hasKey } from './auth.js';
import { saveGithubToken, getGithubToken, listRepos, getUser } from './github.js';
import { listProjects, createProject, getProject, deleteProject, updateProject } from './projects.js';
import { startProject, stopProject, getLogs, setupProject } from './runner.js';
import { listFiles, readFile, saveFile } from './files.js';
import readline from 'readline';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);

const PORT = 8000;

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

  app.delete('/api/projects/:id', async (req, res) => {
    await deleteProject(req.params.id);
    res.json({ success: true });
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

  app.get('/api/projects/:id/logs', (req, res) => {
    res.json(getLogs(req.params.id));
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

  // For any other request, send the index.html file
  // This allows client-side routing to work
  app.get('*', (req, res) => {
    // Check if the request is for an API endpoint
    if (req.path.startsWith('/api')) {
       return res.status(404).json({ error: 'Not found' });
    }
    
    // Otherwise serve index.html
    res.sendFile(path.join(__dirname, '../client/dist/index.html'));
  });

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`DrafterApi running on port ${PORT}`);
    console.log(`Access dashboard at http://localhost:${PORT}`);
  });
}

// main();
