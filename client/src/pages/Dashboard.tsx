import React, { useEffect, useState } from 'react';
import api from '../api';
import { Plus, Github, Server, Trash2, X } from 'lucide-react';
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
  const [showLogo, setShowLogo] = useState(localStorage.getItem('hide_logo') !== 'true');
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

  const toggleLogo = () => {
      const newState = !showLogo;
      setShowLogo(newState);
      if (!newState) {
          localStorage.setItem('hide_logo', 'true');
      } else {
          localStorage.removeItem('hide_logo');
      }
  };

  const handleDelete = async (e: React.MouseEvent, projectId: string) => {
    e.stopPropagation();
    if (!window.confirm('Are you sure you want to delete this project?')) return;
    try {
        await api.delete(`/projects/${projectId}`);
        setProjects(projects.filter(p => p.id !== projectId));
    } catch (err) {
        alert('Failed to delete project');
    }
  };

  if (loading) return <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center font-sans">Loading...</div>;

  return (
    <div className="min-h-screen bg-gray-900 text-white font-sans">
      <nav className="bg-gray-800 p-4 shadow-md flex justify-between items-center border-b border-gray-700">
        <div className="flex items-center gap-4 group">
            {showLogo && (
                <div className="flex items-center gap-2 relative">
                    <Server className="text-blue-500" />
                    <h1 className="text-xl font-bold">DrafterApi</h1>
                    <button 
                        onClick={toggleLogo}
                        className="absolute -right-6 opacity-0 group-hover:opacity-100 text-gray-500 hover:text-red-400 transition-opacity p-1"
                        title="Hide Logo"
                    >
                        <X size={12} />
                    </button>
                </div>
            )}
            {!showLogo && (
                <button 
                    onClick={toggleLogo}
                    className="text-gray-600 hover:text-blue-500 transition-colors text-xs font-bold uppercase tracking-widest"
                >
                    Show Branding
                </button>
            )}
        </div>
        <div className="flex items-center gap-4">
            {githubUser ? (
                <div className="flex items-center gap-2 text-sm text-gray-300 bg-gray-900 px-3 py-1.5 rounded-full border border-gray-700">
                    <img src={githubUser.avatar_url} alt="gh" className="w-5 h-5 rounded-full" />
                    <span className="font-medium">{githubUser.login}</span>
                </div>
            ) : (
                <button onClick={() => navigate('/dashboard/connect-github')} className="text-sm bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-all font-medium">
                    <Github size={16} /> Connect GitHub
                </button>
            )}
            <button onClick={handleLogout} className="bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white border border-red-500/20 px-4 py-2 rounded-lg text-sm transition-all font-medium">Logout</button>
        </div>
      </nav>

      <div className="p-8 max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-2xl font-bold text-white">Projects</h2>
          <button 
            onClick={() => navigate('/dashboard/create')}
            className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-xl flex items-center gap-2 transition-all shadow-lg shadow-blue-900/20 active:scale-95 font-medium"
          >
            <Plus size={18} /> Create Project
          </button>
        </div>

        {projects.length === 0 ? (
          <div className="bg-gray-800/50 p-12 rounded-3xl text-center border-2 border-dashed border-gray-700/50 flex flex-col items-center justify-center gap-4">
            <div className="p-4 bg-gray-800 rounded-full mb-2">
                <Server size={32} className="text-gray-600" />
            </div>
            <p className="text-gray-400 text-lg">No projects found.</p>
            <button 
                onClick={() => navigate('/dashboard/create')}
                className="text-blue-400 hover:text-blue-300 font-medium hover:underline"
            >
                Create your first project
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map((project) => (
              <div key={project.id} className="bg-gray-800 rounded-2xl p-6 shadow-xl hover:shadow-2xl transition-all border border-gray-700 hover:border-gray-600 group">
                <div className="flex justify-between items-start mb-4">
                    <h3 className="text-xl font-bold truncate text-white group-hover:text-blue-400 transition-colors" title={project.name}>{project.name}</h3>
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        project.status === 'running' ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 
                        project.status === 'error' ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-gray-700 text-gray-400 border border-gray-600'
                    }`}>
                        {project.status}
                    </span>
                </div>
                <p className="text-gray-500 text-sm mb-6 truncate flex items-center gap-1.5">
                    <Github size={14} />
                    {project.repoUrl.replace('https://github.com/', '')}
                </p>
                
                <div className="flex gap-2 mt-auto">
                    <button className="flex-1 bg-gray-900 hover:bg-gray-700 text-gray-300 hover:text-white py-2.5 rounded-xl flex justify-center items-center gap-2 text-sm font-medium transition-all border border-gray-700"
                        onClick={() => navigate(`/dashboard/server/${project.id}`)}
                    >
                        Manage Server
                    </button>
                    <button 
                        className="bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 px-3 rounded-xl transition-all"
                        onClick={(e) => handleDelete(e, project.id)}
                        title="Delete Project"
                    >
                        <Trash2 size={18} />
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
