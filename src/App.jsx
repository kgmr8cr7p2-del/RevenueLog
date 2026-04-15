import { useEffect, useState } from 'react';
import { createBuild, deleteBuild, fetchBuilds, updateBuild, updateBuildStatus } from './api.js';
import BuildForm from './components/BuildForm.jsx';
import BuildsBoard from './components/BuildsBoard.jsx';
import FinanceTab from './components/FinanceTab.jsx';
import SettingsTab from './components/SettingsTab.jsx';
import { getTelegramUser, initializeTelegram } from './telegram.js';

const TABS = [
  { id: 'builds', title: 'Сборки ПК' },
  { id: 'finance', title: 'Расчеты' },
  { id: 'settings', title: 'Настройки' }
];

export default function App() {
  const [activeTab, setActiveTab] = useState('builds');
  const [builds, setBuilds] = useState([]);
  const [storage, setStorage] = useState('');
  const [editingBuild, setEditingBuild] = useState(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [telegramUser, setTelegramUser] = useState(null);

  async function loadBuilds() {
    setLoading(true);
    setError('');
    try {
      const data = await fetchBuilds();
      setBuilds(data.items || []);
      setStorage(data.storage || '');
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    initializeTelegram();
    setTelegramUser(getTelegramUser());
    loadBuilds();
  }, []);

  function openNewBuild() {
    setEditingBuild(null);
    setIsFormOpen(true);
  }

  function openEditBuild(build) {
    setEditingBuild(build);
    setIsFormOpen(true);
  }

  function openCopyBuild(build) {
    const copiedBuild = structuredClone(build);
    delete copiedBuild.id;
    delete copiedBuild.createdAt;
    delete copiedBuild.updatedAt;
    delete copiedBuild.lastChangedAt;
    copiedBuild.status = 'assembly';
    copiedBuild.pcNumber = '';
    copiedBuild.contractNumber = '';
    copiedBuild.paymentDate = '';
    copiedBuild.shippingDate = '';
    copiedBuild.receivedDate = '';
    copiedBuild.buildDeadline = '';
    setEditingBuild(copiedBuild);
    setIsFormOpen(true);
  }

  async function saveBuild(payload) {
    setSaving(true);
    setError('');
    try {
      const saved = editingBuild?.id
        ? await updateBuild(editingBuild.id, payload)
        : await createBuild(payload);

      setBuilds((current) => {
        if (!editingBuild?.id) return [saved, ...current];
        return current.map((item) => (item.id === saved.id ? saved : item));
      });
      setIsFormOpen(false);
      setEditingBuild(null);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  async function changeStatus(id, status) {
    const previous = builds;
    setBuilds((current) =>
      current.map((build) => (build.id === id ? { ...build, status } : build))
    );
    try {
      const updated = await updateBuildStatus(id, status);
      setBuilds((current) => current.map((build) => (build.id === id ? updated : build)));
    } catch (requestError) {
      setBuilds(previous);
      setError(requestError.message);
    }
  }

  async function removeBuild(id) {
    setSaving(true);
    setError('');
    try {
      await deleteBuild(id);
      setBuilds((current) => current.filter((build) => build.id !== id));
      setIsFormOpen(false);
      setEditingBuild(null);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="app-shell">
      <nav className="tabs" aria-label="Разделы">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            className={activeTab === tab.id ? 'active' : ''}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.title}
          </button>
        ))}
      </nav>

      {error ? (
        <div className="error-banner">
          <span>{error}</span>
          <button onClick={() => setError('')}>OK</button>
        </div>
      ) : null}

      {loading ? <div className="loading">Загрузка...</div> : null}

      {!loading && activeTab === 'builds' ? (
        <BuildsBoard
          builds={builds}
          onAdd={openNewBuild}
          onEdit={openEditBuild}
          onCopy={openCopyBuild}
          onStatusChange={changeStatus}
        />
      ) : null}

      {!loading && activeTab === 'finance' ? <FinanceTab builds={builds} /> : null}

      {!loading && activeTab === 'settings' ? (
        <SettingsTab storage={storage} user={telegramUser} />
      ) : null}

      {isFormOpen ? (
        <BuildForm
          build={editingBuild}
          saving={saving}
          onClose={() => {
            setIsFormOpen(false);
            setEditingBuild(null);
          }}
          onSave={saveBuild}
          onDelete={removeBuild}
        />
      ) : null}
    </main>
  );
}
