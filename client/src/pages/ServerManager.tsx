import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api';
import io from 'socket.io-client';
import { Play, Square, ChevronLeft, Terminal, Folder, ArrowLeft, Save } from 'lucide-react';

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

    const socket = io('http://localhost:8000');
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

  if (!project) return <div>Loading...</div>;

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col">
      {/* Header */}
      <div className="bg-gray-800 p-4 shadow-md flex justify-between items-center">
        <div className="flex items-center gap-4">
            <button onClick={() => navigate('/dashboard')} className="text-gray-400 hover:text-white">
                <ArrowLeft />
            </button>
            <h1 className="text-xl font-bold">{project.name}</h1>
            <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                status === 'running' ? 'bg-green-500/20 text-green-400' : 'bg-gray-700 text-gray-400'
            }`}>
                {status.toUpperCase()}
            </span>
        </div>
        <div className="flex items-center gap-6">
            <div className="text-sm text-gray-400">
                <span className="mr-4">RAM: {stats.memory.toFixed(1)} / {project.ramLimit} MB</span>
                <span>CPU: {stats.cpu.toFixed(1)}%</span>
            </div>
            <div className="flex gap-2">
                <button 
                    onClick={handleStart} 
                    disabled={status === 'running'}
                    className={`p-2 rounded ${status === 'running' ? 'bg-gray-700 text-gray-500' : 'bg-green-600 hover:bg-green-700 text-white'}`}
                >
                    <Play size={20} />
                </button>
                <button 
                    onClick={handleStop}
                    disabled={status !== 'running'}
                    className={`p-2 rounded ${status !== 'running' ? 'bg-gray-700 text-gray-500' : 'bg-red-600 hover:bg-red-700 text-white'}`}
                >
                    <Square size={20} />
                </button>
            </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex bg-gray-800 border-t border-gray-700">
        <button 
            className={`px-6 py-3 flex items-center gap-2 ${activeTab === 'console' ? 'bg-gray-900 text-blue-400 border-t-2 border-blue-400' : 'text-gray-400 hover:bg-gray-700'}`}
            onClick={() => setActiveTab('console')}
        >
            <Terminal size={16} /> Console
        </button>
        <button 
            className={`px-6 py-3 flex items-center gap-2 ${activeTab === 'files' ? 'bg-gray-900 text-blue-400 border-t-2 border-blue-400' : 'text-gray-400 hover:bg-gray-700'}`}
            onClick={() => setActiveTab('files')}
        >
            <Folder size={16} /> Files
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden p-4">
        {activeTab === 'console' && (
            <div className="bg-black rounded-lg p-4 font-mono text-sm h-full overflow-y-auto border border-gray-700">
                {logs.map((log) => (
                    <div key={log.id} className="mb-1">
                        <span className="text-gray-500 select-none">[{new Date(log.timestamp).toLocaleTimeString()}] </span>
                        <span className={log.type === 'stderr' ? 'text-red-400' : 'text-gray-300'}>
                            {log.message}
                        </span>
                    </div>
                ))}
                <div ref={logsEndRef} />
            </div>
        )}
        {activeTab === 'files' && <FileManager projectId={id!} />}
      </div>
    </div>
  );
};

const FileManager = ({ projectId }: { projectId: string }) => {
    const [files, setFiles] = useState<any[]>([]);
    const [currentPath, setCurrentPath] = useState('');
    const [editingFile, setEditingFile] = useState<string | null>(null);
    const [fileContent, setFileContent] = useState('');
    
    useEffect(() => {
        loadFiles(currentPath);
    }, [currentPath]);

    const loadFiles = async (path: string) => {
        const res = await api.get(`/projects/${projectId}/files`, { params: { path } });
        setFiles(res.data);
    };

    const handleFileClick = async (file: any) => {
        if (file.isDirectory) {
            setCurrentPath(file.path);
        } else {
            const res = await api.get(`/projects/${projectId}/files/content`, { params: { path: file.path } });
            setFileContent(res.data.content);
            setEditingFile(file.path);
        }
    };

    const handleSave = async () => {
        if (!editingFile) return;
        await api.post(`/projects/${projectId}/files/content`, { content: fileContent }, { params: { path: editingFile } });
        alert('Saved!');
    };

    if (editingFile) {
        return (
            <div className="h-full flex flex-col bg-gray-800 rounded-lg border border-gray-700">
                <div className="p-3 border-b border-gray-700 flex justify-between items-center bg-gray-800">
                    <span className="text-gray-300">{editingFile}</span>
                    <div className="flex gap-2">
                        <button onClick={() => setEditingFile(null)} className="px-3 py-1 bg-gray-700 rounded text-sm hover:bg-gray-600">Close</button>
                        <button onClick={handleSave} className="px-3 py-1 bg-blue-600 rounded text-sm hover:bg-blue-700 flex items-center gap-1">
                            <Save size={14} /> Save
                        </button>
                    </div>
                </div>
                <textarea 
                    className="flex-1 bg-gray-900 text-gray-300 p-4 font-mono text-sm resize-none outline-none"
                    value={fileContent}
                    onChange={(e) => setFileContent(e.target.value)}
                />
            </div>
        )
    }

    return (
        <div className="bg-gray-800 rounded-lg p-4 h-full border border-gray-700 overflow-y-auto">
            {currentPath && (
                <div 
                    className="p-2 hover:bg-gray-700 cursor-pointer text-blue-400 mb-2 flex items-center gap-2"
                    onClick={() => setCurrentPath(currentPath.split('/').slice(0, -1).join('/'))}
                >
                    <ArrowLeft size={16} /> ..
                </div>
            )}
            {files.map(file => (
                <div 
                    key={file.path} 
                    className="p-2 hover:bg-gray-700 cursor-pointer flex items-center gap-2 text-gray-300 border-b border-gray-700/50"
                    onClick={() => handleFileClick(file)}
                >
                    {file.isDirectory ? <Folder size={18} className="text-yellow-500" /> : <div className="w-[18px]" />}
                    {file.name}
                </div>
            ))}
        </div>
    );
};

export default ServerManager;
