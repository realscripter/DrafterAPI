import React, { useState, useEffect } from 'react';
import api from '../api';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';

const CreateProject = () => {
  const navigate = useNavigate();
  const [repos, setRepos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({
    name: '',
    repoUrl: '',
    installCmd: 'npm install',
    buildCmd: 'npm run build',
    startCmd: 'npm start',
    port: 3000,
    ramLimit: 512
  });

  useEffect(() => {
    fetchRepos();
  }, []);

  const fetchRepos = async () => {
    try {
      const res = await api.get('/github/repos');
      setRepos(res.data);
    } catch (err) {
      console.error('Failed to load repos', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/projects', formData);
      navigate('/dashboard');
    } catch (err) {
      alert('Failed to create project');
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
        <div className="max-w-3xl mx-auto">
            <button onClick={() => navigate('/dashboard')} className="flex items-center text-gray-400 hover:text-white mb-6">
                <ChevronLeft size={20} /> Back to Dashboard
            </button>
            
            <h1 className="text-3xl font-bold mb-8">Create New Project</h1>
            
            <form onSubmit={handleSubmit} className="bg-gray-800 p-8 rounded-lg shadow-lg border border-gray-700 space-y-6">
                
                <div>
                    <label className="block text-gray-400 mb-2">Project Name</label>
                    <input 
                        required
                        className="w-full bg-gray-900 border border-gray-700 rounded p-2 focus:border-blue-500 outline-none"
                        value={formData.name}
                        onChange={e => setFormData({...formData, name: e.target.value})}
                    />
                </div>

                <div>
                    <label className="block text-gray-400 mb-2">GitHub Repository</label>
                    <select 
                        required
                        className="w-full bg-gray-900 border border-gray-700 rounded p-2 focus:border-blue-500 outline-none"
                        value={formData.repoUrl}
                        onChange={e => {
                            const repo = repos.find(r => r.clone_url === e.target.value);
                            setFormData({
                                ...formData, 
                                repoUrl: e.target.value,
                                name: formData.name || (repo ? repo.name : '')
                            })
                        }}
                    >
                        <option value="">Select a repository...</option>
                        {repos.map(repo => (
                            <option key={repo.id} value={repo.clone_url}>
                                {repo.full_name} ({repo.private ? 'Private' : 'Public'})
                            </option>
                        ))}
                    </select>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <label className="block text-gray-400 mb-2 text-sm">Install Command</label>
                        <input 
                            className="w-full bg-gray-900 border border-gray-700 rounded p-2 focus:border-blue-500 outline-none text-sm"
                            value={formData.installCmd}
                            onChange={e => setFormData({...formData, installCmd: e.target.value})}
                        />
                    </div>
                    <div>
                        <label className="block text-gray-400 mb-2 text-sm">Build Command</label>
                        <input 
                            className="w-full bg-gray-900 border border-gray-700 rounded p-2 focus:border-blue-500 outline-none text-sm"
                            value={formData.buildCmd}
                            onChange={e => setFormData({...formData, buildCmd: e.target.value})}
                        />
                    </div>
                    <div>
                        <label className="block text-gray-400 mb-2 text-sm">Start Command</label>
                        <input 
                            className="w-full bg-gray-900 border border-gray-700 rounded p-2 focus:border-blue-500 outline-none text-sm"
                            value={formData.startCmd}
                            onChange={e => setFormData({...formData, startCmd: e.target.value})}
                        />
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-gray-400 mb-2">RAM Limit (MB)</label>
                        <input 
                            type="range" 
                            min="128" 
                            max="8192" 
                            step="128"
                            className="w-full"
                            value={formData.ramLimit}
                            onChange={e => setFormData({...formData, ramLimit: Number(e.target.value)})}
                        />
                        <div className="text-right text-gray-400 text-sm">{formData.ramLimit} MB</div>
                    </div>
                    <div>
                        <label className="block text-gray-400 mb-2">Network Port</label>
                        <input 
                            type="number"
                            className="w-full bg-gray-900 border border-gray-700 rounded p-2 focus:border-blue-500 outline-none"
                            value={formData.port}
                            onChange={e => setFormData({...formData, port: Number(e.target.value)})}
                        />
                    </div>
                </div>

                <button 
                    type="submit" 
                    className="w-full bg-blue-600 hover:bg-blue-700 py-3 rounded font-bold transition"
                >
                    Create Project
                </button>
            </form>
        </div>
    </div>
  );
};

export default CreateProject;
