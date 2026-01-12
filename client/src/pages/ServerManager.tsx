import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api';
import io from 'socket.io-client';
import { 
    Play, Square, Terminal, Folder, ArrowLeft, Save, 
    Settings, ExternalLink, RefreshCw, X, Check, 
    Globe, Trash2, Search, FileCode, HardDrive
} from 'lucide-react';

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

  const handleClearLogs = async () => {
    if (!confirm('Are you sure you want to delete all logs?')) return;
    await api.delete(`/projects/${id}/logs`);
    setLogs([]);
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
    if (project.domain) {
        window.open(`http://${project.domain}`, '_blank');
    } else {
        const port = project.port || 3000;
        window.open(`http://${window.location.hostname}:${port}`, '_blank');
    }
  };

  if (!project) return <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center font-sans">
    <div className="flex flex-col items-center gap-4">
        <RefreshCw className="animate-spin text-blue-500" size={40} />
        <span className="text-gray-400">Loading DrafterAPI Instance...</span>
    </div>
  </div>;

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col font-sans">
      {/* Header */}
      <div className="bg-gray-800 p-4 shadow-md flex justify-between items-center border-b border-gray-700 z-10">
        <div className="flex items-center gap-4">
            <button onClick={() => navigate('/dashboard')} className="text-gray-400 hover:text-white transition p-2 hover:bg-gray-700 rounded-lg">
                <ArrowLeft size={20} />
            </button>
            <div>
                <h1 className="text-xl font-bold leading-tight">{project.name}</h1>
                <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${status === 'running' ? 'bg-green-500 animate-pulse' : 'bg-gray-500'}`} />
                    <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{status}</span>
                </div>
            </div>
        </div>
        
        <div className="flex items-center gap-4">
            <div className="hidden md:flex items-center gap-3 mr-4 bg-gray-950/50 px-4 py-2 rounded-xl border border-gray-700/50">
                <div className="flex flex-col items-center">
                    <span className="text-[10px] text-gray-500 uppercase font-bold tracking-tighter">RAM</span>
                    <span className={`text-sm font-mono ${stats.memory > project.ramLimit * 0.8 ? 'text-red-400' : 'text-blue-400'}`}>
                        {stats.memory.toFixed(0)}MB
                    </span>
                </div>
                <div className="w-px h-6 bg-gray-800" />
                <div className="flex flex-col items-center">
                    <span className="text-[10px] text-gray-500 uppercase font-bold tracking-tighter">CPU</span>
                    <span className="text-sm font-mono text-purple-400">{stats.cpu.toFixed(1)}%</span>
                </div>
            </div>

            <div className="flex gap-2 bg-gray-900 p-1 rounded-xl border border-gray-700">
                <button 
                    onClick={handleStart} 
                    disabled={status === 'running'}
                    className={`p-2.5 rounded-lg transition-all ${status === 'running' ? 'text-gray-600 bg-gray-800' : 'text-green-400 hover:bg-green-500/10 hover:scale-105 active:scale-95'}`}
                    title="Start"
                >
                    <Play size={20} fill="currentColor" className={status === 'running' ? 'opacity-20' : ''} />
                </button>
                <button 
                    onClick={handleRestart}
                    disabled={status !== 'running'}
                    className={`p-2.5 rounded-lg transition-all ${status !== 'running' ? 'text-gray-600 bg-gray-800' : 'text-yellow-400 hover:bg-yellow-500/10 hover:scale-105 active:scale-95'}`}
                    title="Restart"
                >
                    <RefreshCw size={20} />
                </button>
                <button 
                    onClick={handleStop}
                    disabled={status !== 'running'}
                    className={`p-2.5 rounded-lg transition-all ${status !== 'running' ? 'text-gray-600 bg-gray-800' : 'text-red-400 hover:bg-red-500/10 hover:scale-105 active:scale-95'}`}
                    title="Stop"
                >
                    <Square size={20} fill="currentColor" className={status !== 'running' ? 'opacity-20' : ''} />
                </button>
            </div>

            {status === 'running' && (
                <button
                    onClick={openUrl}
                    className="p-2.5 bg-blue-600 hover:bg-blue-500 rounded-xl transition-all shadow-lg shadow-blue-900/20 active:scale-95 group"
                >
                    <ExternalLink size={20} className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                </button>
            )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex bg-gray-800 px-4 border-b border-gray-700 overflow-x-auto no-scrollbar">
        {[
            { id: 'console', icon: Terminal, label: 'Console' },
            { id: 'files', icon: Folder, label: 'File Editor' },
            { id: 'domains', icon: Globe, label: 'Domains & DNS' },
            { id: 'settings', icon: Settings, label: 'Settings' }
        ].map(tab => (
            <button 
                key={tab.id}
                className={`px-6 py-4 flex items-center gap-2.5 transition-all relative font-medium text-sm whitespace-nowrap
                    ${activeTab === tab.id ? 'text-blue-400' : 'text-gray-400 hover:text-gray-200 hover:bg-gray-700/50'}`}
                onClick={() => setActiveTab(tab.id)}
            >
                <tab.icon size={18} />
                {tab.label}
                {activeTab === tab.id && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500 rounded-t-full shadow-[0_-2px_10px_rgba(59,130,246,0.5)]" />}
            </button>
        ))}
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-hidden relative">
        {activeTab === 'console' && (
            <div className="h-full flex flex-col bg-black/40 backdrop-blur-sm">
                <div className="p-2 border-b border-white/5 flex justify-end bg-gray-900/50">
                    <button onClick={handleClearLogs} className="text-gray-500 hover:text-red-400 transition-colors flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-md hover:bg-red-500/10">
                        <Trash2 size={12} /> Clear Output
                    </button>
                </div>
                <div className="flex-1 p-6 font-mono text-sm overflow-y-auto scrollbar-custom selection:bg-blue-500/30">
                    {logs.length === 0 ? (
                        <div className="h-full flex items-center justify-center text-gray-600 italic animate-pulse">
                            Waiting for output...
                        </div>
                    ) : (
                        logs.map((log) => (
                            <div key={log.id} className="mb-1 hover:bg-white/5 px-2 py-0.5 rounded transition-colors group flex gap-3">
                                <span className="text-gray-700 select-none font-bold text-[10px] leading-6 min-w-[70px]">
                                    {new Date(log.timestamp).toLocaleTimeString([], { hour12: false })}
                                </span>
                                <span className={`leading-6 flex-1 break-all ${
                                    log.type === 'stderr' ? 'text-red-400' : 
                                    log.type === 'info' ? 'text-blue-400 font-bold' : 
                                    'text-gray-300'
                                }`}>
                                    {log.message}
                                </span>
                            </div>
                        ))
                    )}
                    <div ref={logsEndRef} />
                </div>
            </div>
        )}
        
        {activeTab === 'files' && <FileManager projectId={id!} />}
        {activeTab === 'domains' && <DomainSettings projectId={id!} project={project} onUpdate={fetchProject} />}
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

    const getLanguage = (filename: string) => {
        const ext = filename.split('.').pop()?.toLowerCase();
        const map: any = {
            'js': 'javascript', 'ts': 'typescript', 'tsx': 'typescript', 'jsx': 'javascript',
            'json': 'json', 'html': 'html', 'css': 'css', 'md': 'markdown', 'py': 'python',
            'sh': 'bash', 'bat': 'batch'
        };
        return map[ext!] || 'plain';
    };

    const hasChanges = fileContent !== originalContent;

    if (editingFile) {
        const lang = getLanguage(editingFile);
        return (
            <div className="h-full flex flex-col bg-gray-950 animate-in fade-in duration-300">
                {/* Editor Header */}
                <div className="bg-gray-900 border-b border-gray-800 p-3 flex justify-between items-center px-6">
                    <div className="flex items-center gap-4">
                        <button 
                            onClick={() => {
                                if (hasChanges && !confirm('You have unsaved changes. Are you sure you want to close?')) return;
                                setEditingFile(null);
                                setFileContent('');
                                setOriginalContent('');
                            }} 
                            className="text-gray-400 hover:text-white transition p-1.5 hover:bg-white/5 rounded-lg"
                        >
                            <X size={20} />
                        </button>
                        <div>
                            <div className="flex items-center gap-2">
                                <FileCode size={16} className="text-blue-400" />
                                <span className="text-gray-200 font-mono text-sm font-bold">{editingFile.split('/').pop()}</span>
                            </div>
                            <span className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">{lang}</span>
                        </div>
                        {hasChanges && (
                            <div className="flex items-center gap-1.5 px-2 py-0.5 bg-yellow-500/10 border border-yellow-500/20 rounded-full">
                                <div className="w-1.5 h-1.5 bg-yellow-500 rounded-full animate-pulse" />
                                <span className="text-[10px] text-yellow-500 font-bold uppercase">Modified</span>
                            </div>
                        )}
                    </div>
                    <button 
                        onClick={handleSave} 
                        disabled={saving || !hasChanges}
                        className="px-6 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-800 disabled:text-gray-600 rounded-xl text-sm font-bold flex items-center gap-2 transition-all shadow-lg shadow-blue-900/20 active:scale-95"
                    >
                        {saving ? <RefreshCw size={16} className="animate-spin" /> : <Save size={16} />}
                        {saving ? 'Saving...' : 'Save Changes'}
                    </button>
                </div>
                
                {/* Clean Code Editor Area */}
                <div className="flex-1 relative">
                    <div className="absolute inset-0 p-8">
                        <textarea 
                            className="w-full h-full bg-transparent text-gray-200 font-mono text-base resize-none outline-none leading-relaxed scrollbar-custom"
                            value={fileContent}
                            onChange={(e) => setFileContent(e.target.value)}
                            spellCheck={false}
                            autoFocus
                            style={{ tabSize: 4 }}
                        />
                    </div>
                </div>
            </div>
        )
    }

    const filteredFiles = files.filter(file => 
        file.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="h-full flex flex-col bg-gray-950">
            {/* File Browser Header */}
            <div className="bg-gray-900/50 border-b border-white/5 p-4 flex items-center gap-4 px-8">
                <div className="relative flex-1 group">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-blue-400 transition-colors" />
                    <input
                        type="text"
                        placeholder="Filter files in current directory..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-gray-900 border border-gray-800 rounded-xl pl-10 pr-4 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500/50 transition-all"
                    />
                </div>
                {currentPath && (
                    <button
                        onClick={() => setCurrentPath(currentPath.split('/').slice(0, -1).join('/'))}
                        className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-xl text-sm font-bold flex items-center gap-2 transition-all active:scale-95"
                    >
                        <ArrowLeft size={16} /> Up
                    </button>
                )}
            </div>

            {/* File List */}
            <div className="flex-1 overflow-y-auto p-6 scrollbar-custom">
                <div className="max-w-5xl mx-auto space-y-1">
                    {currentPath && (
                        <div 
                            className="p-4 hover:bg-white/5 cursor-pointer text-blue-400 rounded-xl flex items-center gap-3 transition-colors mb-2 group border border-transparent hover:border-blue-500/20"
                            onClick={() => setCurrentPath(currentPath.split('/').slice(0, -1).join('/'))}
                        >
                            <Folder size={20} className="group-hover:scale-110 transition-transform" />
                            <span className="font-bold">.. / (Parent Directory)</span>
                        </div>
                    )}
                    {filteredFiles.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 text-gray-600">
                            <Search size={48} className="mb-4 opacity-20" />
                            <p className="font-medium italic">No files match your search</p>
                        </div>
                    ) : (
                        filteredFiles.map(file => (
                            <div 
                                key={file.path} 
                                className="p-4 hover:bg-white/5 cursor-pointer flex items-center gap-4 text-gray-300 rounded-xl transition-all border border-transparent hover:border-white/5 group"
                                onClick={() => handleFileClick(file)}
                            >
                                {file.isDirectory ? (
                                    <div className="p-2 bg-yellow-500/10 rounded-lg text-yellow-500 group-hover:scale-110 transition-transform">
                                        <Folder size={20} fill="currentColor" fillOpacity={0.2} />
                                    </div>
                                ) : (
                                    <div className="p-2 bg-blue-500/10 rounded-lg text-blue-400 group-hover:scale-110 transition-transform">
                                        <FileCode size={20} />
                                    </div>
                                )}
                                <div className="flex-1">
                                    <span className="font-medium group-hover:text-white transition-colors">{file.name}</span>
                                    {!file.isDirectory && <div className="text-[10px] text-gray-600 uppercase font-bold tracking-widest mt-0.5">{getLanguage(file.name)}</div>}
                                </div>
                                <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-tighter">Click to {file.isDirectory ? 'Open' : 'Edit'}</span>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};

const DomainSettings = ({ projectId, project, onUpdate }: { projectId: string; project: any; onUpdate: () => void }) => {
    const [domain, setDomain] = useState(project.domain || '');
    const [saving, setSaving] = useState(false);

    const handleConnect = async () => {
        if (!domain) return;
        setSaving(true);
        try {
            await api.post(`/projects/${projectId}/domain`, { domain, port: project.port || 3000 });
            await onUpdate();
            alert('Domain connected! Point your DNS A record to your server IP.');
        } catch (e: any) {
            alert(e.response?.data?.error || 'Failed to connect domain');
        } finally {
            setSaving(false);
        }
    };

    const handleRemove = async () => {
        if (!confirm('Are you sure you want to remove this domain?')) return;
        setSaving(true);
        try {
            await api.delete(`/projects/${projectId}/domain`);
            await onUpdate();
            setDomain('');
        } catch (e) {
            alert('Failed to remove domain');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="h-full overflow-y-auto p-8 scrollbar-custom bg-gray-950">
            <div className="max-w-2xl mx-auto">
                <div className="bg-gray-900 rounded-3xl p-8 border border-white/5 shadow-2xl">
                    <div className="flex items-center gap-4 mb-8">
                        <div className="p-3 bg-blue-500/10 rounded-2xl text-blue-400">
                            <Globe size={28} />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold">Custom Domain</h3>
                            <p className="text-sm text-gray-500">Route your traffic through a professional URL</p>
                        </div>
                    </div>
                    
                    <div className="space-y-6">
                        <div className="bg-gray-950/50 p-6 rounded-2xl border border-white/5 space-y-4">
                            <div className="flex flex-col gap-2">
                                <label className="text-xs font-bold text-gray-500 uppercase tracking-widest ml-1">Connect your domain</label>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={domain}
                                        onChange={(e) => setDomain(e.target.value)}
                                        placeholder="panel.yourdomain.com"
                                        className="flex-1 bg-gray-900 border border-gray-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all"
                                    />
                                    {project.domain ? (
                                        <button
                                            onClick={handleRemove}
                                            disabled={saving}
                                            className="px-4 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white rounded-xl transition-all border border-red-500/20"
                                        >
                                            <Trash2 size={20} />
                                        </button>
                                    ) : (
                                        <button
                                            onClick={handleConnect}
                                            disabled={saving || !domain}
                                            className="px-6 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-800 disabled:text-gray-600 rounded-xl font-bold text-sm transition-all active:scale-95 shadow-lg shadow-blue-900/20"
                                        >
                                            {saving ? <RefreshCw className="animate-spin" size={18} /> : 'Connect'}
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="bg-blue-500/5 p-6 rounded-2xl border border-blue-500/10">
                            <h4 className="text-sm font-bold text-blue-400 mb-3 flex items-center gap-2">
                                <HardDrive size={16} /> DNS Instructions
                            </h4>
                            <p className="text-sm text-gray-400 mb-4 leading-relaxed">
                                To make your domain work, add the following <span className="text-white font-bold">A record</span> in your DNS provider (Cloudflare, Namecheap, etc.):
                            </p>
                            <div className="bg-gray-950 rounded-xl p-4 font-mono text-sm border border-white/5 grid grid-cols-3 gap-2">
                                <div className="text-gray-600 uppercase text-[10px] font-bold">Type</div>
                                <div className="text-gray-600 uppercase text-[10px] font-bold">Host</div>
                                <div className="text-gray-600 uppercase text-[10px] font-bold">Value</div>
                                <div className="text-blue-400">A</div>
                                <div className="text-white">@</div>
                                <div className="text-green-400">Your VPS IP</div>
                            </div>
                        </div>
                    </div>
                </div>
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
            alert('Configuration saved successfully!');
        } catch (e) {
            alert('Failed to save settings');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="h-full overflow-y-auto p-8 scrollbar-custom bg-gray-950">
            <div className="max-w-2xl mx-auto">
                <div className="bg-gray-900 rounded-3xl p-8 border border-white/5 shadow-2xl">
                    <div className="flex items-center gap-4 mb-8">
                        <div className="p-3 bg-purple-500/10 rounded-2xl text-purple-400">
                            <Settings size={28} />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold">Instance Configuration</h3>
                            <p className="text-sm text-gray-500">Fine-tune how your project runs</p>
                        </div>
                    </div>
                    
                    <div className="space-y-6">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest ml-1">Network Port</label>
                                <input
                                    type="number"
                                    value={formData.port}
                                    onChange={(e) => setFormData({...formData, port: Number(e.target.value)})}
                                    className="w-full bg-gray-950 border border-gray-800 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-purple-500/50 transition-all font-mono"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest ml-1">RAM Allocation (MB)</label>
                                <input
                                    type="number"
                                    value={formData.ramLimit}
                                    onChange={(e) => setFormData({...formData, ramLimit: Number(e.target.value)})}
                                    className="w-full bg-gray-950 border border-gray-800 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-purple-500/50 transition-all font-mono"
                                />
                            </div>
                        </div>

                        {[
                            { id: 'startCmd', label: 'Start Command', color: 'green' },
                            { id: 'installCmd', label: 'Install Command', color: 'blue' },
                            { id: 'buildCmd', label: 'Build Command', color: 'orange' }
                        ].map(cmd => (
                            <div key={cmd.id} className="space-y-2">
                                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest ml-1">{cmd.label}</label>
                                <input
                                    type="text"
                                    value={(formData as any)[cmd.id]}
                                    onChange={(e) => setFormData({...formData, [cmd.id]: e.target.value})}
                                    className="w-full bg-gray-950 border border-gray-800 rounded-xl px-4 py-2.5 text-gray-200 focus:outline-none focus:border-blue-500/50 transition-all font-mono text-sm"
                                />
                            </div>
                        ))}

                        <div className="pt-4">
                            <button
                                onClick={handleSave}
                                disabled={saving}
                                className="w-full py-4 bg-white text-gray-900 hover:bg-gray-200 disabled:bg-gray-800 disabled:text-gray-600 rounded-2xl font-black text-sm uppercase tracking-widest transition-all active:scale-[0.98] shadow-xl"
                            >
                                {saving ? <RefreshCw className="animate-spin mx-auto" size={20} /> : 'Save Configuration'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ServerManager;
