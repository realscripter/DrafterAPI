# DrafterAPI

A simple, self-hosted tool to manage and deploy GitHub projects on your own server.

## Features
- **Easy GitHub Integration**: Connects directly to your GitHub account.
- **Project Management**: Create, start, stop, and monitor projects.
- **Resource Control**: Set RAM limits for each project.
- **Live Console**: View logs in real-time.
- **File Manager**: Edit project files directly from the dashboard.

## Installation

1. Clone the repository:
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

## Security
- The `config.json` containing your keys and tokens is stored locally in the `server` directory and is git-ignored.
- `projects_data` where your repos are cloned is also git-ignored.
