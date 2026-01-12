import React, { useState, useEffect } from 'react';
import api from '../api';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Github } from 'lucide-react';

const ConnectGithub = () => {
  const [token, setToken] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    // Check for OAuth errors or success
    const oauthError = searchParams.get('error');
    const githubConnected = searchParams.get('github_connected');
    
    if (oauthError) {
      setError('GitHub OAuth failed. Please try again or use Personal Access Token.');
    } else if (githubConnected) {
      navigate('/dashboard');
    }
  }, [searchParams, navigate]);

  const handleOAuthLogin = async () => {
    setLoading(true);
    try {
      const res = await api.get('/github/oauth');
      if (res.data.authUrl) {
        window.location.href = res.data.authUrl;
      } else {
        setError('OAuth not configured. Please use Personal Access Token method.');
        setLoading(false);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to start OAuth flow. Use PAT method instead.');
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/github/connect', { token });
      navigate('/dashboard');
    } catch (err) {
      setError('Invalid token. Please check your Personal Access Token.');
      setLoading(false);
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
        
        {/* OAuth Button */}
        <div className="mb-6">
          <button
            onClick={handleOAuthLogin}
            disabled={loading}
            className="w-full bg-gray-800 hover:bg-gray-700 border-2 border-gray-600 text-white font-bold py-3 px-4 rounded transition flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Github size={20} />
            {loading ? 'Connecting...' : 'Login with GitHub'}
          </button>
        </div>

        <div className="flex items-center gap-4 mb-6">
          <div className="flex-1 border-t border-gray-700"></div>
          <span className="text-gray-500 text-sm">OR</span>
          <div className="flex-1 border-t border-gray-700"></div>
        </div>

        <p className="text-gray-400 text-center mb-4 text-sm">
            Use Personal Access Token (Classic) with `repo` scope for private repositories.
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
              disabled={loading}
            />
          </div>
          {error && <p className="text-red-500 text-sm mb-4">{error}</p>}
          <div className="flex gap-3">
            <button
                type="button"
                onClick={() => navigate('/dashboard')}
                className="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-2 px-4 rounded transition"
                disabled={loading}
            >
                Cancel
            </button>
            <button
                type="submit"
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded transition disabled:opacity-50"
                disabled={loading}
            >
                {loading ? 'Connecting...' : 'Connect'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ConnectGithub;
