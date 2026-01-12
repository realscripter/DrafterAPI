import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api';
import io from 'socket.io-client';
import { Play, Square, Terminal, Folder, ArrowLeft, Save, Settings, ExternalLink, RefreshCw, X, Check } from 'lucide-react';

const ServerManager = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState<any>(null);
  const [status, setStatus] = useState('stopped');
  const [logs, setLogs] = useState<any[]>([]);
  const [stats, setStats] = useState({ cpu: 0, memory: 0, uptime: 0 });
  const [activeTab, setActiveTab] = useState('console');
  const socketRef = useRef<any>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchProject();
    fetchLogs();

    const socket = io(import.meta.env.DEV ? 'http://localhost:8000' : '/');
    socketRef.current = socket;

    socket.emit('join-project', id);

    socket.on('log', (log) => {
      setLogs(prev => [...prev, log]);
    });

    socket.on('stats', (data) => {
      setStats(data);
    });

    socket.on('project:update', (data) => {
        if (data.id === id) setStatus(data.status);
    });

    return () => {
      socket.disconnect();
    };
  }, [id]);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const fetchProject = async () => {
    const res = await api.get(`/projects/${id}`);
    setProject(res.data);
    setStatus(res.data.status);
  };

  const fetchLogs = async () => {
    const res = await api.get(`/projects/${id}/logs`);
    setLogs(res.data);
  };

  const handleStart = async () => {
    await api.post(`/projects/${id}/start`);
  };

  const handleStop = async () => {
    await api.post(`/projects/${id}/stop`);
  };

  const handleRestart = async () => {
    await api.post(`/projects/${id}/stop`);
    setTimeout(async () => {
      await api.post(`/projects/${id}/start`);
    }, 1000);
  };

  const openUrl = () => {
    const port = project.port || 3000;
    const url = `http://localhost:${port}`;
    window.open(url, '_blank');
  };

  if (!project) return <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">Loading...</div>;

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col">
      {/* Header */}
      <div className="bg-gray-800 p-4 shadow-md flex justify-between items-center border-b border-gray-700">
        <div className="flex items-center gap-4">
            <button onClick={() => navigate('/dashboard')} className="text-gray-400 hover:text-white transition">
                <ArrowLeft size={20} />
            </button>
            <h1 className="text-xl font-bold">{project.name}</h1>
            <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                status === 'running' ? 'bg-green-500/20 text-green-400' : 'bg-gray-700 text-gray-400'
            }`}>
                {status.toUpperCase()}
            </span>
        </div>
        <div className="flex items-center gap-4">
            <div className="text-sm text-gray-400">
                <span className="mr-4">RAM: {stats.memory.toFixed(1)} / {project.ramLimit} MB</span>
                <span>CPU: {stats.cpu.toFixed(1)}%</span>
            </div>
            {status === 'running' && project.port && (
                <button
                    onClick={openUrl}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 rounded text-sm flex items-center gap-2 transition"
                >
                    <ExternalLink size={14} /> Open URL
                </button>
            )}
            <div className="flex gap-2">
                <button 
                    onClick={handleStart} 
                    disabled={status === 'running'}
                    className={`p-2 rounded transition ${status === 'running' ? 'bg-gray-700 text-gray-500 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700 text-white'}`}
                    title="Start"
                >
                    <Play size={18} />
                </button>
                <button 
                    onClick={handleRestart}
                    disabled={status !== 'running'}
                    className={`p-2 rounded transition ${status !== 'running' ? 'bg-gray-700 text-gray-500 cursor-not-allowed' : 'bg-yellow-600 hover:bg-yellow-700 text-white'}`}
                    title="Restart"
                >
                    <RefreshCw size={18} />
                </button>
                <button 
                    onClick={handleStop}
                    disabled={status !== 'running'}
                    className={`p-2 rounded transition ${status !== 'running' ? 'bg-gray-700 text-gray-500 cursor-not-allowed' : 'bg-red-600 hover:bg-red-700 text-white'}`}
                    title="Stop"
                >
                    <Square size={18} />
                </button>
            </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex bg-gray-800 border-b border-gray-700">
        <button 
            className={`px-6 py-3 flex items-center gap-2 transition ${activeTab === 'console' ? 'bg-gray-900 text-blue-400 border-b-2 border-blue-400' : 'text-gray-400 hover:bg-gray-700'}`}
            onClick={() => setActiveTab('console')}
        >
            <Terminal size={16} /> Console
        </button>
        <button 
            className={`px-6 py-3 flex items-center gap-2 transition ${activeTab === 'files' ? 'bg-gray-900 text-blue-400 border-b-2 border-blue-400' : 'text-gray-400 hover:bg-gray-700'}`}
            onClick={() => setActiveTab('files')}
        >
            <Folder size={16} /> Files
        </button>
        <button 
            className={`px-6 py-3 flex items-center gap-2 transition ${activeTab === 'settings' ? 'bg-gray-900 text-blue-400 border-b-2 border-blue-400' : 'text-gray-400 hover:bg-gray-700'}`}
            onClick={() => setActiveTab('settings')}
        >
            <Settings size={16} /> Settings
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'console' && (
            <div className="h-full bg-black p-4 font-mono text-sm overflow-y-auto">
                {logs.length === 0 ? (
                    <div className="text-gray-500 text-center mt-8">No logs yet. Start the project to see output.</div>
                ) : (
                    logs.map((log) => (
                        <div key={log.id} className="mb-1 hover:bg-gray-900/50 px-2 py-0.5 rounded">
                            <span className="text-gray-500 select-none">[{new Date(log.timestamp).toLocaleTimeString()}] </span>
                            <span className={log.type === 'stderr' ? 'text-red-400' : log.type === 'info' ? 'text-blue-400' : 'text-gray-300'}>
                                {log.message}
                            </span>
                        </div>
                    ))
                )}
                <div ref={logsEndRef} />
            </div>
        )}
        {activeTab === 'files' && <FileManager projectId={id!} />}
        {activeTab === 'settings' && <ProjectSettings projectId={id!} project={project} onUpdate={fetchProject} />}
      </div>
    </div>
  );
};

const FileManager = ({ projectId }: { projectId: string }) => {
    const [files, setFiles] = useState<any[]>([]);
    const [currentPath, setCurrentPath] = useState('');
    const [editingFile, setEditingFile] = useState<string | null>(null);
    const [fileContent, setFileContent] = useState('');
    const [originalContent, setOriginalContent] = useState('');
    const [saving, setSaving] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    
    useEffect(() => {
        loadFiles(currentPath);
    }, [currentPath]);

    const loadFiles = async (path: string) => {
        try {
            const res = await api.get(`/projects/${projectId}/files`, { params: { path } });
            setFiles(res.data);
        } catch (e) {
            console.error('Failed to load files:', e);
        }
    };

    const handleFileClick = async (file: any) => {
        if (file.isDirectory) {
            setCurrentPath(file.path);
        } else {
            try {
                const res = await api.get(`/projects/${projectId}/files/content`, { params: { path: file.path } });
                setFileContent(res.data.content);
                setOriginalContent(res.data.content);
                setEditingFile(file.path);
            } catch (e) {
                alert('Failed to load file');
            }
        }
    };

    const handleSave = async () => {
        if (!editingFile) return;
        setSaving(true);
        try {
            await api.post(`/projects/${projectId}/files/content`, { content: fileContent }, { params: { path: editingFile } });
            setOriginalContent(fileContent);
        } catch (e) {
            alert('Failed to save file');
        } finally {
            setSaving(false);
        }
    };

    const hasChanges = fileContent !== originalContent;

    if (editingFile) {
        return (
            <div className="h-full flex flex-col bg-gray-900">
                {/* Editor Header */}
                <div className="bg-gray-800 border-b border-gray-700 p-3 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <button 
                            onClick={() => {
                                if (hasChanges && !confirm('You have unsaved changes. Are you sure you want to close?')) return;
                                setEditingFile(null);
                                setFileContent('');
                                setOriginalContent('');
                            }} 
                            className="text-gray-400 hover:text-white transition"
                        >
                            <X size={18} />
                        </button>
                        <span className="text-gray-300 font-mono text-sm">{editingFile}</span>
                        {hasChanges && <span className="text-yellow-400 text-xs">● Modified</span>}
                    </div>
                    <button 
                        onClick={handleSave} 
                        disabled={saving || !hasChanges}
                        className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:text-gray-500 rounded text-sm flex items-center gap-2 transition"
                    >
                        {saving ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
                        {saving ? 'Saving...' : 'Save'}
                    </button>
                </div>
                
                {/* Code Editor */}
                <textarea 
                    className="flex-1 bg-gray-950 text-gray-100 p-6 font-mono text-sm resize-none outline-none leading-relaxed"
                    value={fileContent}
                    onChange={(e) => setFileContent(e.target.value)}
                    spellCheck={false}
                    style={{ tabSize: 2 }}
                />
            </div>
        )
    }

    const filteredFiles = files.filter(file => 
        file.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="h-full flex flex-col bg-gray-900">
            {/* File Browser Header */}
            <div className="bg-gray-800 border-b border-gray-700 p-3 flex items-center gap-3">
                <input
                    type="text"
                    placeholder="Search files..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="flex-1 bg-gray-900 border border-gray-700 rounded px-3 py-1.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                />
                {currentPath && (
                    <button
                        onClick={() => setCurrentPath(currentPath.split('/').slice(0, -1).join('/'))}
                        className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-sm flex items-center gap-2 transition"
                    >
                        <ArrowLeft size={14} /> Back
                    </button>
                )}
            </div>

            {/* File List */}
            <div className="flex-1 overflow-y-auto p-4">
                {currentPath && (
                    <div 
                        className="p-3 hover:bg-gray-800 cursor-pointer text-blue-400 mb-2 rounded flex items-center gap-2 transition"
                        onClick={() => setCurrentPath(currentPath.split('/').slice(0, -1).join('/'))}
                    >
                        <ArrowLeft size={16} /> ..
                    </div>
                )}
                {filteredFiles.length === 0 ? (
                    <div className="text-gray-500 text-center mt-8">No files found</div>
                ) : (
                    filteredFiles.map(file => (
                        <div 
                            key={file.path} 
                            className="p-3 hover:bg-gray-800 cursor-pointer flex items-center gap-3 text-gray-300 rounded transition group"
                            onClick={() => handleFileClick(file)}
                        >
                            {file.isDirectory ? (
                                <Folder size={18} className="text-yellow-500" />
                            ) : (
                                <div className="w-[18px] h-[18px] flex items-center justify-center">
                                    <div className="w-1.5 h-1.5 bg-gray-500 rounded-full group-hover:bg-gray-400" />
                                </div>
                            )}
                            <span className="flex-1">{file.name}</span>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

const ProjectSettings = ({ projectId, project, onUpdate }: { projectId: string; project: any; onUpdate: () => void }) => {
    const [formData, setFormData] = useState({
        port: project.port || 3000,
        startCmd: project.startCmd || '',
        installCmd: project.installCmd || '',
        buildCmd: project.buildCmd || '',
        ramLimit: project.ramLimit || 512
    });
    const [saving, setSaving] = useState(false);

    const handleSave = async () => {
        setSaving(true);
        try {
            await api.put(`/projects/${projectId}`, formData);
            await onUpdate();
            alert('Settings saved! Restart the project for changes to take effect.');
        } catch (e) {
            alert('Failed to save settings');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="h-full overflow-y-auto p-6">
            <div className="max-w-2xl mx-auto space-y-6">
                <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                    <h3 className="text-lg font-bold mb-4">Project Configuration</h3>
                    
                    <div className="space-y-4">
                        <div>
                            <label className="block text-gray-400 mb-2 text-sm font-medium">Port</label>
                            <input
                                type="number"
                                value={formData.port}
                                onChange={(e) => setFormData({...formData, port: Number(e.target.value)})}
                                className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                                placeholder="3000"
                            />
                            <p className="text-gray-500 text-xs mt-1">The port your application runs on</p>
                        </div>

                        <div>
                            <label className="block text-gray-400 mb-2 text-sm font-medium">Install Command</label>
                            <input
                                type="text"
                                value={formData.installCmd}
                                onChange={(e) => setFormData({...formData, installCmd: e.target.value})}
                                className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white font-mono text-sm focus:outline-none focus:border-blue-500"
                                placeholder="npm install"
                            />
                        </div>

                        <div>
                            <label className="block text-gray-400 mb-2 text-sm font-medium">Build Command</label>
                            <input
                                type="text"
                                value={formData.buildCmd}
                                onChange={(e) => setFormData({...formData, buildCmd: e.target.value})}
                                className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white font-mono text-sm focus:outline-none focus:border-blue-500"
                                placeholder="npm run build"
                            />
                        </div>

                        <div>
                            <label className="block text-gray-400 mb-2 text-sm font-medium">Start Command</label>
                            <input
                                type="text"
                                value={formData.startCmd}
                                onChange={(e) => setFormData({...formData, startCmd: e.target.value})}
                                className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white font-mono text-sm focus:outline-none focus:border-blue-500"
                                placeholder="npm start"
                            />
                        </div>

                        <div>
                            <label className="block text-gray-400 mb-2 text-sm font-medium">RAM Limit (MB)</label>
                            <input
                                type="range"
                                min="128"
                                max="8192"
                                step="128"
                                value={formData.ramLimit}
                                onChange={(e) => setFormData({...formData, ramLimit: Number(e.target.value)})}
                                className="w-full"
                            />
                            <div className="text-right text-gray-400 text-sm mt-1">{formData.ramLimit} MB</div>
                        </div>
                    </div>

                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="mt-6 w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:text-gray-500 rounded text-sm font-medium flex items-center justify-center gap-2 transition"
                    >
                        {saving ? <RefreshCw size={16} className="animate-spin" /> : <Check size={16} />}
                        {saving ? 'Saving...' : 'Save Settings'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ServerManager;
