import { Layers, Plus } from 'lucide-react';
import { useState } from 'react';
import { useCompany } from '../../context/CompanyContext';
import { Button } from './Button';

interface NoCompanySelectedProps {
    moduleName?: string;
}

export default function NoCompanySelected({ moduleName }: NoCompanySelectedProps) {
    const { createCompany } = useCompany();
    const [isCreating, setIsCreating] = useState(false);
    const [newName, setNewName] = useState('');
    const [loading, setLoading] = useState(false);

    const handleCreate = async () => {
        if (!newName.trim()) return;
        setLoading(true);
        try {
            await createCompany(newName.trim());
            setNewName('');
            setIsCreating(false);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col items-center justify-center h-[60vh] text-center animate-fade-in">
            <div className="w-24 h-24 bg-slate-800 rounded-full flex items-center justify-center mb-6">
                <Layers className="text-slate-600 w-12 h-12" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Firma Seçimi Gerekli</h2>
            <p className="text-slate-400 max-w-md mb-6">
                {moduleName
                    ? `${moduleName} kullanmak için lütfen bir firma seçin veya yeni bir firma oluşturun.`
                    : 'Devam etmek için lütfen bir firma seçin veya yeni bir firma oluşturun.'}
            </p>

            {isCreating ? (
                <div className="flex items-center gap-2 w-full max-w-sm">
                    <input
                        type="text"
                        placeholder="Firma adı..."
                        autoFocus
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                        className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                    />
                    <Button variant="primary" size="sm" onClick={handleCreate} isLoading={loading} disabled={!newName.trim()}>
                        Oluştur
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setIsCreating(false)}>
                        İptal
                    </Button>
                </div>
            ) : (
                <Button variant="primary" onClick={() => setIsCreating(true)} leftIcon={<Plus size={18} />}>
                    Yeni Firma Oluştur
                </Button>
            )}
        </div>
    );
}
