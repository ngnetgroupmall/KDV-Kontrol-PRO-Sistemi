import { useEffect, useState } from 'react';
import { storageService, type Workspace } from '../services/storageService';
import { Trash2, FolderOpen, Plus } from 'lucide-react';
import { formatDate } from '../../../utils/parsers';

interface WorkspaceListProps {
    onSelect: (workspace: Workspace) => void;
    onCreateNew: (name: string) => void;
}

export default function WorkspaceList({ onSelect, onCreateNew }: WorkspaceListProps) {
    const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
    const [newCompanyName, setNewCompanyName] = useState('');
    const [isCreating, setIsCreating] = useState(false);

    useEffect(() => {
        loadWorkspaces();
    }, []);

    const loadWorkspaces = async () => {
        const list = await storageService.getAllWorkspaces();
        // Sort by date desc
        setWorkspaces(list.sort((a, b) => b.lastUpdated.getTime() - a.lastUpdated.getTime()));
    };

    const handleDelete = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        if (confirm('Bu çalışmayı silmek istediğinizden emin misiniz?')) {
            await storageService.deleteWorkspace(id);
            loadWorkspaces();
        }
    };

    const handleCreate = () => {
        if (newCompanyName.trim()) {
            onCreateNew(newCompanyName);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-white">Kayıtlı Çalışmalar</h2>
                <button
                    onClick={() => setIsCreating(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                >
                    <Plus size={20} />
                    Yeni Çalışma
                </button>
            </div>

            {isCreating && (
                <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 animate-in fade-in slide-in-from-top-4 mb-6">
                    <h3 className="text-lg font-bold text-white mb-4">Yeni Çalışma Oluştur</h3>
                    <div className="flex gap-4">
                        <input
                            type="text"
                            placeholder="Firma Adı Giriniz..."
                            className="flex-1 bg-slate-900 border border-slate-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-blue-500 outline-none"
                            value={newCompanyName}
                            onChange={(e) => setNewCompanyName(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                        />
                        <button
                            onClick={handleCreate}
                            disabled={!newCompanyName.trim()}
                            className="px-6 py-3 bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors font-medium"
                        >
                            Oluştur
                        </button>
                        <button
                            onClick={() => setIsCreating(false)}
                            className="px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
                        >
                            İptal
                        </button>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {workspaces.map(ws => (
                    <div
                        key={ws.id}
                        onClick={() => onSelect(ws)}
                        className="group bg-slate-800/50 hover:bg-slate-800 border border-slate-700 hover:border-blue-500/50 rounded-xl p-6 cursor-pointer transition-all hover:shadow-lg hover:shadow-blue-900/10 relative"
                    >
                        <div className="flex justify-between items-start mb-4">
                            <div className="w-12 h-12 bg-blue-500/10 rounded-lg flex items-center justify-center text-blue-400 group-hover:scale-110 transition-transform">
                                <FolderOpen size={24} />
                            </div>
                            <button
                                onClick={(e) => handleDelete(e, ws.id)}
                                className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-400/10 rounded-full transition-colors opacity-0 group-hover:opacity-100"
                            >
                                <Trash2 size={18} />
                            </button>
                        </div>
                        <h3 className="text-lg font-bold text-white mb-2 truncate">{ws.companyName}</h3>
                        <div className="space-y-1 text-sm text-slate-400">
                            <p>Son Güncelleme: {formatDate(ws.lastUpdated)}</p>
                            <p>SMMM Kaydı: {ws.smmmData?.length || 0} satır</p>
                            <p>Firma Kaydı: {ws.firmaData?.length || 0} satır</p>
                        </div>
                    </div>
                ))}

                {workspaces.length === 0 && !isCreating && (
                    <div className="col-span-full py-20 text-center text-slate-500">
                        <p className="text-lg">Henüz kayıtlı bir çalışma bulunmuyor.</p>
                        <p className="text-sm">Yeni bir çalışma oluşturarak başlayın.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
