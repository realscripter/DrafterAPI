import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api';
import io from 'socket.io-client';
import { 
    Play, Square, Terminal, Folder, ArrowLeft, Save, 
    Settings, ExternalLink, RefreshCw, X, Check, 
    Trash2, Search, FileCode, Activity, GitBranch, Download,
    AlertCircle, Info, CheckCircle, AlertTriangle
} from 'lucide-react';
import Editor from 'react-simple-code-editor';
import { highlight, languages } from 'prismjs/components/prism-core';
import 'prismjs/components/prism-clike';
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-json';
import 'prismjs/components/prism-css';
import 'prismjs/components/prism-markup'; // html
import 'prismjs/components/prism-bash';
import 'prismjs/components/prism-python';
import 'prismjs/themes/prism-tomorrow.css'; // Dark theme
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';

// Simple Toast Component
const Toast = ({ message, type, onClose }: { message: string, type: 'success' | 'error' | 'info', onClose: () => void }) => {
    useEffect(() => {
        const timer = setTimeout(onClose, 3000);
        return () => clearTimeout(timer);
    }, [onClose]);

    const bg = type === 'success' ? 'bg-green-500' : type === 'error' ? 'bg-red-500' : 'bg-blue-500';
    const Icon = type === 'success' ? CheckCircle : type === 'error' ? AlertCircle : Info;

    return (
        <div className={`fixed top-4 right-4 ${bg} text-white px-4 py-3 rounded-xl shadow-lg flex items-center gap-3 animate-in slide-in-from-right fade-in z-50`}>
            <Icon size={20} />
            <span className="font-medium text-sm">{message}</span>
            <button onClick={onClose} className="hover:bg-white/20 p-1 rounded-lg transition"><X size={16} /></button>
        </div>
    );
};

// Confirmation Modal Component
const ConfirmModal = ({ isOpen, title, message, onConfirm, onCancel, confirmText = 'Confirm', isDanger = false }: any) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-gray-900 border border-white/10 rounded-2xl p-6 max-w-md w-full shadow-2xl scale-100 animate-in zoom-in-95 duration-200">
                <div className="flex items-center gap-3 mb-4">
                    <div className={`p-3 rounded-full ${isDanger ? 'bg-red-500/10 text-red-500' : 'bg-blue-500/10 text-blue-500'}`}>
                        {isDanger ? <AlertTriangle size={24} /> : <Info size={24} />}
                    </div>
                    <h3 className="text-xl font-bold">{title}</h3>
                </div>
                <p className="text-gray-400 mb-8 leading-relaxed">
                    {message}
                </p>
                <div className="flex gap-3 justify-end">
                    <button 
                        onClick={onCancel}
                        className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-xl font-medium transition-colors"
                    >
                        Cancel
                    </button>
                    <button 
                        onClick={onConfirm}
                        className={`px-4 py-2 rounded-xl font-bold transition-colors ${
                            isDanger ? 'bg-red-600 hover:bg-red-500 text-white' : 'bg-blue-600 hover:bg-blue-500 text-white'
                        }`}
                    >
                        {confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
};

const ServerManager = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState<any>(null);
  const [status, setStatus] = useState('stopped');
  const [logs, setLogs] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [stats, setStats] = useState({ cpu: 0, memory: 0, uptime: 0 });
  const [statsHistory, setStatsHistory] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState('console');
  const [toast, setToast] = useState<{message: string, type: 'success' | 'error' | 'info'} | null>(null);
  const [confirmState, setConfirmState] = useState<{isOpen: boolean, title: string, message: string, onConfirm: () => void, isDanger?: boolean} | null>(null);
  const socketRef = useRef<any>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
      setToast({ message, type });
  };

  const confirm = (title: string, message: string, isDanger = false): Promise<boolean> => {
      return new Promise((resolve) => {
          setConfirmState({
              isOpen: true,
              title,
              message,
              isDanger,
              onConfirm: () => {
                  setConfirmState(null);
                  resolve(true);
              }
          });
      });
  };

  useEffect(() => {
    fetchProject();
    fetchLogs();
    fetchEvents();

    const socket = io(import.meta.env.DEV ? 'http://localhost:8000' : '/');
    socketRef.current = socket;

    socket.emit('join-project', id);

    socket.on('log', (log) => {
      setLogs(prev => [...prev, log]);
    });

    socket.on('stats', (data) => {
      setStats(data);
      setStatsHistory(prev => {
          const newHistory = [...prev, { ...data, time: new Date().toLocaleTimeString() }];
          if (newHistory.length > 20) newHistory.shift(); 
          return newHistory;
      });
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

  // Poll events occasionally
  useEffect(() => {
      const interval = setInterval(fetchEvents, 5000);
      return () => clearInterval(interval);
  }, [id]);

  const fetchProject = async () => {
    try {
        const res = await api.get(`/projects/${id}`);
        setProject(res.data);
        setStatus(res.data.status);
    } catch (e) {
        showToast('Failed to load project', 'error');
    }
  };

  const fetchLogs = async () => {
    try {
        const res = await api.get(`/projects/${id}/logs`);
        setLogs(res.data);
    } catch (e) {}
  };

  const fetchEvents = async () => {
      try {
          const res = await api.get(`/projects/${id}/events`);
          setEvents(res.data);
      } catch (e) {}
  };

  const handleClearLogs = async () => {
    // Custom confirmation
    setConfirmState({
        isOpen: true,
        title: 'Clear Logs',
        message: 'Are you sure you want to delete all logs? This history cannot be recovered.',
        isDanger: true,
        onConfirm: async () => {
            setConfirmState(null);
            try {
                await api.delete(`/projects/${id}/logs`);
                setLogs([]);
                showToast('Logs cleared', 'success');
            } catch (e) {
                showToast('Failed to clear logs', 'error');
            }
        }
    });
  };

  const handleStart = async () => {
    try {
        await api.post(`/projects/${id}/start`);
        showToast('Start command sent', 'success');
    } catch (e: any) {
        showToast(e.response?.data?.error || 'Failed to start', 'error');
    }
  };

  const handleStop = async () => {
    try {
        await api.post(`/projects/${id}/stop`);
        showToast('Stop command sent', 'info');
    } catch (e: any) {
        showToast(e.response?.data?.error || 'Failed to stop', 'error');
    }
  };

  const handleRestart = async () => {
    try {
        await api.post(`/projects/${id}/stop`);
        showToast('Restarting...', 'info');
        setTimeout(async () => {
            await api.post(`/projects/${id}/start`);
            showToast('Start command sent', 'success');
        }, 1000);
    } catch (e: any) {
        showToast('Failed to restart', 'error');
    }
  };

  const handlePullUpdates = async () => {
      if (status === 'running' && !project?.autoDeploy) {
           setConfirmState({
              isOpen: true,
              title: 'Project Running',
              message: 'The project is currently running. You should stop it before updating to avoid conflicts. Continue anyway?',
              isDanger: true,
              onConfirm: async () => {
                  setConfirmState(null);
                  performPull();
              }
           });
           return;
      }
      performPull();
  };

  const performPull = async () => {
      showToast('Pulling updates...', 'info');
      try {
        await api.post(`/projects/${id}/pull`);
        showToast('Updates pulled successfully!', 'success');
        fetchEvents();
      } catch (e: any) {
        showToast('Failed to pull updates: ' + (e.response?.data?.error || e.message), 'error');
      }
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
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      <ConfirmModal 
        isOpen={!!confirmState} 
        title={confirmState?.title} 
        message={confirmState?.message} 
        isDanger={confirmState?.isDanger}
        onConfirm={confirmState?.onConfirm} 
        onCancel={() => setConfirmState(null)} 
      />
      
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
                <div className="w-px bg-gray-800 my-1 mx-1" />
                <button 
                    onClick={handlePullUpdates}
                    className="p-2.5 rounded-lg transition-all text-blue-400 hover:bg-blue-500/10 hover:scale-105 active:scale-95 relative group"
                    title={project.autoDeploy ? "Pull & Auto Deploy" : "Pull Updates"}
                >
                    <Download size={20} />
                    {project.autoDeploy && <div className="absolute top-1 right-1 w-1.5 h-1.5 bg-green-500 rounded-full" />}
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
            { id: 'monitoring', icon: Activity, label: 'Monitoring' },
            { id: 'events', icon: GitBranch, label: 'Activity' },
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
                                    {log.timestamp && !isNaN(new Date(log.timestamp).getTime()) 
                                        ? new Date(log.timestamp).toLocaleTimeString([], { hour12: false }) 
                                        : '--:--:--'}
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
        
        {activeTab === 'files' && <FileManager projectId={id!} showToast={showToast} confirm={confirm} />}
        {activeTab === 'monitoring' && <Monitoring statsHistory={statsHistory} />}
        {activeTab === 'events' && <EventsList events={events} />}
        {activeTab === 'settings' && <ProjectSettings projectId={id!} project={project} onUpdate={fetchProject} showToast={showToast} confirm={confirm} />}
      </div>
    </div>
  );
};

const EventsList = ({ events }: { events: any[] }) => {
    return (
        <div className="h-full p-6 overflow-y-auto scrollbar-custom bg-gray-950">
            <div className="max-w-4xl mx-auto space-y-4">
                <h3 className="text-lg font-bold text-gray-300 mb-6 flex items-center gap-2">
                    <Activity size={20} /> Recent Activity
                </h3>
                {events.length === 0 ? (
                    <div className="text-gray-500 italic text-center py-10">No events recorded yet.</div>
                ) : (
                    events.map((event) => (
                        <div key={event.id} className="bg-gray-900 border border-white/5 p-4 rounded-xl flex items-center gap-4">
                            <div className={`p-2 rounded-lg ${
                                event.type === 'error' ? 'bg-red-500/10 text-red-500' :
                                event.type === 'success' ? 'bg-green-500/10 text-green-500' :
                                'bg-blue-500/10 text-blue-500'
                            }`}>
                                {event.type === 'error' ? <AlertCircle size={20} /> :
                                 event.type === 'success' ? <CheckCircle size={20} /> :
                                 <Info size={20} />}
                            </div>
                            <div className="flex-1">
                                <p className="text-gray-200 font-medium">{event.message}</p>
                                <span className="text-xs text-gray-500">
                                    {event.timestamp && !isNaN(new Date(event.timestamp).getTime()) 
                                        ? new Date(event.timestamp).toLocaleString()
                                        : 'Unknown Time'}
                                </span>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

const Monitoring = ({ statsHistory }: { statsHistory: any[] }) => {
    return (
        <div className="h-full p-8 overflow-y-auto bg-gray-950">
            <div className="max-w-6xl mx-auto space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="bg-gray-900 p-6 rounded-2xl border border-white/5 shadow-xl">
                        <h3 className="text-lg font-bold text-gray-300 mb-6 flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-purple-500" />
                            CPU Usage
                        </h3>
                        <div className="h-[300px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={statsHistory}>
                                    <defs>
                                        <linearGradient id="colorCpu" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#8884d8" stopOpacity={0.8}/>
                                            <stop offset="95%" stopColor="#8884d8" stopOpacity={0}/>
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                                    <XAxis dataKey="time" stroke="#666" fontSize={12} tickLine={false} />
                                    <YAxis stroke="#666" fontSize={12} tickLine={false} unit="%" />
                                    <Tooltip 
                                        contentStyle={{ backgroundColor: '#111', border: '1px solid #333' }}
                                        labelStyle={{ color: '#888' }}
                                    />
                                    <Area type="monotone" dataKey="cpu" stroke="#8884d8" fillOpacity={1} fill="url(#colorCpu)" />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    <div className="bg-gray-900 p-6 rounded-2xl border border-white/5 shadow-xl">
                        <h3 className="text-lg font-bold text-gray-300 mb-6 flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-blue-500" />
                            Memory Usage (MB)
                        </h3>
                        <div className="h-[300px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={statsHistory}>
                                    <defs>
                                        <linearGradient id="colorMem" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                                    <XAxis dataKey="time" stroke="#666" fontSize={12} tickLine={false} />
                                    <YAxis stroke="#666" fontSize={12} tickLine={false} unit="MB" />
                                    <Tooltip 
                                        contentStyle={{ backgroundColor: '#111', border: '1px solid #333' }}
                                        labelStyle={{ color: '#888' }}
                                    />
                                    <Area type="monotone" dataKey="memory" stroke="#3b82f6" fillOpacity={1} fill="url(#colorMem)" />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

const FileManager = ({ projectId, showToast, confirm }: { projectId: string, showToast: any, confirm: any }) => {
    const [files, setFiles] = useState<any[]>([]);
    const [currentPath, setCurrentPath] = useState('');
    const [editingFile, setEditingFile] = useState<string | null>(null);
    const [fileContent, setFileContent] = useState('');
    const [originalContent, setOriginalContent] = useState('');
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    
    useEffect(() => {
        loadFiles(currentPath);
    }, [currentPath]);

    const loadFiles = async (path: string) => {
        setLoading(true);
        try {
            const res = await api.get(`/projects/${projectId}/files`, { params: { path } });
            setFiles(res.data);
        } catch (e) {
            showToast('Failed to load files', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleFileClick = async (file: any) => {
        if (file.isDirectory) {
            setCurrentPath(file.path);
        } else {
            setLoading(true);
            try {
                const res = await api.get(`/projects/${projectId}/files/content`, { params: { path: file.path } });
                setFileContent(res.data.content);
                setOriginalContent(res.data.content);
                setEditingFile(file.path);
            } catch (e) {
                showToast('Failed to load file', 'error');
            } finally {
                setLoading(false);
            }
        }
    };

    const handleSave = async () => {
        if (!editingFile) return;
        setSaving(true);
        try {
            await api.post(`/projects/${projectId}/files/content`, { content: fileContent }, { params: { path: editingFile } });
            setOriginalContent(fileContent);
            showToast('File saved!', 'success');
        } catch (e) {
            showToast('Failed to save file', 'error');
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
            <div className="h-full flex flex-col bg-[#1d1f21] animate-in fade-in duration-300">
                {/* Editor Header */}
                <div className="bg-[#25282c] border-b border-[#373b41] p-3 flex justify-between items-center px-6">
                    <div className="flex items-center gap-4">
                        <button 
                            onClick={async () => {
                                if (hasChanges) {
                                    const confirmed = await confirm('Unsaved Changes', 'You have unsaved changes. Are you sure you want to close?', true);
                                    if (!confirmed) return;
                                }
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
                
                {/* Syntax Highlighted Editor */}
                <div className="flex-1 relative overflow-hidden">
                    <Editor
                        value={fileContent}
                        onValueChange={code => setFileContent(code)}
                        highlight={code => highlight(code, languages.javascript, 'javascript')}
                        padding={24}
                        style={{
                            fontFamily: '"Fira Code", "Fira Mono", monospace',
                            fontSize: 14,
                            backgroundColor: '#1d1f21',
                            color: '#c5c8c6',
                            minHeight: '100%',
                        }}
                        className="min-h-full"
                    />
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
                    {loading && <div className="text-center py-4 text-gray-500 animate-pulse">Loading...</div>}
                    
                    {currentPath && (
                        <div 
                            className="p-4 hover:bg-white/5 cursor-pointer text-blue-400 rounded-xl flex items-center gap-3 transition-colors mb-2 group border border-transparent hover:border-blue-500/20"
                            onClick={() => setCurrentPath(currentPath.split('/').slice(0, -1).join('/'))}
                        >
                            <Folder size={20} className="group-hover:scale-110 transition-transform" />
                            <span className="font-bold">.. / (Parent Directory)</span>
                        </div>
                    )}
                    {!loading && filteredFiles.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 text-gray-600">
                            <Search size={48} className="mb-4 opacity-20" />
                            <p className="font-medium italic">No files match your search</p>
                        </div>
                    ) : (
                        !loading && filteredFiles.map(file => (
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

const ProjectSettings = ({ projectId, project, onUpdate, showToast, confirm }: { projectId: string; project: any; onUpdate: () => void, showToast: any, confirm: any }) => {
    const [formData, setFormData] = useState({
        port: project.port || 3000,
        startCmd: project.startCmd || '',
        installCmd: project.installCmd || '',
        buildCmd: project.buildCmd || '',
        ramLimit: project.ramLimit || 512,
        autoDeploy: project.autoDeploy || false
    });
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        setFormData({
            port: project.port || 3000,
            startCmd: project.startCmd || '',
            installCmd: project.installCmd || '',
            buildCmd: project.buildCmd || '',
            ramLimit: project.ramLimit || 512,
            autoDeploy: project.autoDeploy || false
        });
    }, [project]);

    const handleSave = async () => {
        setSaving(true);
        try {
            await api.put(`/projects/${projectId}`, formData);
            await onUpdate();
            showToast('Configuration saved successfully!', 'success');
        } catch (e) {
            showToast('Failed to save settings', 'error');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        const confirmed = await confirm('Delete Project', 'Are you sure you want to delete this project? This action cannot be undone.', true);
        if (!confirmed) return;
        
        setDeleting(true);
        try {
            // Stop the server first if running, but backend should handle cleanup
            await api.delete(`/projects/${projectId}`);
            showToast('Project deleted successfully', 'success');
            navigate('/dashboard');
        } catch (e: any) {
            showToast('Failed to delete project: ' + (e.response?.data?.error || e.message), 'error');
            setDeleting(false);
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
                        <div className="bg-gray-950/50 p-6 rounded-2xl border border-white/5 flex items-center justify-between">
                            <div>
                                <h4 className="font-bold text-white mb-1">Auto Deploy</h4>
                                <p className="text-xs text-gray-500">Automatically install, build and restart when you pull updates</p>
                            </div>
                            <button 
                                onClick={() => setFormData({...formData, autoDeploy: !formData.autoDeploy})}
                                className={`w-12 h-6 rounded-full transition-colors relative ${formData.autoDeploy ? 'bg-green-500' : 'bg-gray-700'}`}
                            >
                                <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-all ${formData.autoDeploy ? 'left-7' : 'left-1'}`} />
                            </button>
                        </div>

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

                        <div className="pt-4 space-y-4">
                            <button
                                onClick={handleSave}
                                disabled={saving}
                                className="w-full py-4 bg-white text-gray-900 hover:bg-gray-200 disabled:bg-gray-800 disabled:text-gray-600 rounded-2xl font-black text-sm uppercase tracking-widest transition-all active:scale-[0.98] shadow-xl"
                            >
                                {saving ? <RefreshCw className="animate-spin mx-auto" size={20} /> : 'Save Configuration'}
                            </button>

                            <div className="pt-8 border-t border-white/5">
                                <h4 className="text-red-400 font-bold mb-2 flex items-center gap-2">
                                    <Trash2 size={16} /> Danger Zone
                                </h4>
                                <button
                                    onClick={handleDelete}
                                    disabled={deleting}
                                    className="w-full py-3 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 rounded-xl font-bold text-sm uppercase tracking-widest transition-all active:scale-[0.98]"
                                >
                                    {deleting ? 'Deleting...' : 'Delete Project'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ServerManager;
