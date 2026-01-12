import React, { useEffect, useState } from 'react';
import api from '../api';
import { Plus, Github, Server, Play, Square, RefreshCw, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface Project {
  id: string;
  name: string;
  repoUrl: string;
  status: 'stopped' | 'running' | 'error';
  ramLimit: number;
}

const Dashboard = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [githubUser, setGithubUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [projectsRes, githubRes] = await Promise.all([
        api.get('/projects'),
        api.get('/github/status')
      ]);
      setProjects(projectsRes.data);
      if (githubRes.data.connected) {
        setGithubUser(githubRes.data.user);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('drafter_key');
    navigate('/login');
  };

  if (loading) return <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">Loading...</div>;

  return (
    <div className="min-h-screen bg-gray-900 text-white font-sans">
      <nav className="bg-gray-800 p-4 shadow-md flex justify-between items-center">
        <div className="flex items-center gap-2">
            <Server className="text-blue-500" />
            <h1 className="text-xl font-bold">DrafterApi</h1>
        </div>
        <div className="flex items-center gap-4">
            {githubUser ? (
                <div className="flex items-center gap-2 text-sm text-gray-300">
                    <img src={githubUser.avatar_url} alt="gh" className="w-6 h-6 rounded-full" />
                    <span>{githubUser.login}</span>
                </div>
            ) : (
                <button onClick={() => navigate('/dashboard/connect-github')} className="text-sm bg-gray-700 hover:bg-gray-600 px-3 py-1 rounded flex items-center gap-2">
                    <Github size={16} /> Connect GitHub
                </button>
            )}
            <button onClick={handleLogout} className="bg-red-600 px-4 py-2 rounded text-sm hover:bg-red-700 transition">Logout</button>
        </div>
      </nav>

      <div className="p-8 max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-2xl font-bold">Projects</h2>
          <button 
            onClick={() => navigate('/dashboard/create')}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded flex items-center gap-2 transition"
          >
            <Plus size={18} /> Create Project
          </button>
        </div>

        {projects.length === 0 ? (
          <div className="bg-gray-800 p-12 rounded-lg text-center border-2 border-dashed border-gray-700">
            <p className="text-gray-400 mb-4">No projects found.</p>
            <button 
                onClick={() => navigate('/dashboard/create')}
                className="text-blue-400 hover:text-blue-300 underline"
            >
                Create your first project
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map((project) => (
              <div key={project.id} className="bg-gray-800 rounded-lg p-6 shadow-lg hover:shadow-xl transition border border-gray-700">
                <div className="flex justify-between items-start mb-4">
                    <h3 className="text-xl font-bold truncate" title={project.name}>{project.name}</h3>
                    <span className={`px-2 py-1 rounded text-xs font-bold ${
                        project.status === 'running' ? 'bg-green-500/20 text-green-400' : 
                        project.status === 'error' ? 'bg-red-500/20 text-red-400' : 'bg-gray-700 text-gray-400'
                    }`}>
                        {project.status.toUpperCase()}
                    </span>
                </div>
                <p className="text-gray-400 text-sm mb-4 truncate">{project.repoUrl}</p>
                
                <div className="flex gap-2 mt-4">
                    <button className="flex-1 bg-gray-700 hover:bg-gray-600 py-2 rounded flex justify-center items-center gap-2 text-sm transition"
                        onClick={() => navigate(`/dashboard/server/${project.id}`)}
                    >
                        Manage
                    </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
