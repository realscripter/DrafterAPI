# DrafterAPI

A simple, self-hosted tool to manage and deploy GitHub projects on your own server.

## Features
- **Easy GitHub Integration**: Connects directly to your GitHub account.
- **Project Management**: Create, start, stop, and monitor projects.
- **Resource Control**: Set RAM limits for each project.
- **Live Console**: View logs in real-time.
- **File Manager**: Edit project files directly from the dashboard.

## Installation

### Linux VPS (Ubuntu/Debian) - One-Command Setup

1. Clone and run setup:
   ```bash
   git clone https://github.com/realscripter/DrafterAPI.git
   cd DrafterAPI
   chmod +x setup.sh start.sh
   ./setup.sh
   ```
   *This script will automatically install Node.js if it's missing, install all dependencies, and build the project.*

2. Generate your key:
   ```bash
   node server/index.js key
   ```

3. Start the server:
   ```bash
   ./start.sh
   ```

### Windows (Local Development)

1. **Clone the repository:**
   ```powershell
   git clone https://github.com/realscripter/DrafterAPI.git
   cd DrafterAPI
   ```

2. **Install dependencies and build:**
   ```powershell
   # Install Server Dependencies
   cd server
   npm install
   cd ..

   # Install Client Dependencies and Build
   cd client
   npm install
   npm run build
   cd ..
   ```

3. **Generate your key:**
   ```powershell
   .\DrafterApi.bat key
   ```

4. **Start the server:**
   ```powershell
   .\DrafterApi.bat
   ```

5. **Access Dashboard:**
   Open [http://localhost:8000](http://localhost:8000) in your browser.

## Manual Installation

1. **Prerequisites (Install Node.js)**:
   If you don't have Node.js installed (check with `node -v`), install it:
   ```bash
   # Ubuntu/Debian
   curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
   sudo apt-get install -y nodejs
   ```

2. Clone the repository:
   ```bash
   git clone https://github.com/realscripter/DrafterAPI.git
   cd DrafterAPI
   ```

2. Install dependencies and build:
   ```bash
   # Install Server Dependencies
   cd server
   npm install

   # Install Client Dependencies and Build
   cd ../client
   npm install
   npm run build
   cd ..
   ```

## Usage

1. **Generate Login Key**:
   Run this command once to generate your secure login key:
   ```bash
   # Windows
   .\DrafterApi.bat key
   
   # Linux/Mac
   node server/index.js key
   ```
   *Save the key shown in the console!*

2. **Start the Server**:
   ```bash
   # Windows
   .\DrafterApi.bat
   
   # Linux/Mac
   node server/index.js
   ```

3. **Access Dashboard**:
   Open [http://localhost:8000](http://localhost:8000) in your browser and login with your key.

## GitHub OAuth Setup (Optional - Recommended)

For easier GitHub connection without Personal Access Tokens:

1. **Create a GitHub OAuth App:**
   - Go to: https://github.com/settings/developers
   - Click "New OAuth App"
   - **Application name:** DrafterAPI (or any name)
   - **Homepage URL:** `http://localhost:8000` (or your domain)
   - **Authorization callback URL:** `http://localhost:8000/api/github/callback` (or `https://yourdomain.com/api/github/callback`)
   - Click "Register application"
   - Copy the **Client ID** and generate a **Client Secret**

2. **Configure OAuth in DrafterAPI:**
   ```bash
   # Edit server/config.json and add:
   {
     "githubClientId": "your_client_id_here",
     "githubClientSecret": "your_client_secret_here"
   }
   ```

3. **Restart the server** and use "Login with GitHub" button instead of entering a PAT.

**Note:** If OAuth is not configured, you can still use Personal Access Token method.

## Security
- The `config.json` containing your keys and tokens is stored locally in the `server` directory and is git-ignored.
- `projects_data` where your repos are cloned is also git-ignored.
- GitHub OAuth credentials are stored securely in `config.json`.
