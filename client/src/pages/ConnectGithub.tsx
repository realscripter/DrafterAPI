import React, { useState } from 'react';
import api from '../api';
import { useNavigate } from 'react-router-dom';
import { Github } from 'lucide-react';

const ConnectGithub = () => {
  const [token, setToken] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/github/connect', { token });
      navigate('/dashboard');
    } catch (err) {
      setError('Invalid token. Please check your Personal Access Token.');
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center p-4">
      <div className="bg-gray-800 p-8 rounded-lg shadow-lg w-full max-w-md border border-gray-700">
        <div className="flex justify-center mb-6">
            <div className="bg-gray-700 p-3 rounded-full">
                <Github size={40} />
            </div>
        </div>
        <h2 className="text-2xl font-bold text-center mb-2">Connect GitHub</h2>
        <p className="text-gray-400 text-center mb-6 text-sm">
            Generate a Personal Access Token (Classic) with `repo` scope to access your private repositories.
        </p>
        
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-gray-400 mb-2 text-sm">Personal Access Token</label>
            <input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-white focus:outline-none focus:border-blue-500"
              placeholder="ghp_..."
            />
          </div>
          {error && <p className="text-red-500 text-sm mb-4">{error}</p>}
          <div className="flex gap-3">
            <button
                type="button"
                onClick={() => navigate('/dashboard')}
                className="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-2 px-4 rounded transition"
            >
                Cancel
            </button>
            <button
                type="submit"
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded transition"
            >
                Connect
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ConnectGithub;
