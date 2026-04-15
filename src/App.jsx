import { useEffect, useState } from 'react';
import {
  createBuild,
  deleteBuild,
  fetchBuilds,
  updateBuild,
  updateBuildArchive,
  updateBuildStatus
} from './api.js';
import { getNextPcNumber } from '../shared/calculations.js';
import ArchiveTab from './components/ArchiveTab.jsx';
import BuildForm from './components/BuildForm.jsx';
import BuildsBoard from './components/BuildsBoard.jsx';
import FinanceTab from './components/FinanceTab.jsx';
import SettingsTab from './components/SettingsTab.jsx';
import { getTelegramUser, initializeTelegram, requestTelegramFullscreen } from './telegram.js';

const REQUIRED_SCHEMA_VERSION = 3;

const TABS = [
  { id: 'builds', title: 'Сборки ПК' },
  { id: 'finance', title: 'Расчеты' },
  { id: 'archive', title: 'Архив' },
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
  const activeBuilds = builds.filter((build) => !build.archived);
  const archivedBuilds = builds.filter((build) => build.archived);

  async function loadBuilds() {
    setLoading(true);
    setError('');
    try {
      const data = await fetchBuilds();
      setBuilds(data.items || []);
      setStorage(data.storage || '');
      if (data.storage === 'google-sheets' && data.schemaVersion < REQUIRED_SCHEMA_VERSION) {
        setError(
          'Google Apps Script еще не обновлен. Архив и новые поля не будут сохраняться, пока не вставить свежий Code.gs и не сделать New version -> Deploy.'
        );
      }
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
    setEditingBuild({ pcNumber: getNextPcNumber(builds) });
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
    delete copiedBuild.notificationHalfSentAt;
    delete copiedBuild.notificationTwoDaysSentAt;
    copiedBuild.status = 'assembly';
    copiedBuild.pcNumber = getNextPcNumber(builds);
    copiedBuild.contractNumber = '';
    copiedBuild.paymentDate = '';
    copiedBuild.shippingDate = '';
    copiedBuild.receivedDate = '';
    copiedBuild.buildDeadline = '';
    copiedBuild.assemblyStartDate = '';
    copiedBuild.trackingNumber = '';
    copiedBuild.archived = false;
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

  async function toggleArchive(build, archived) {
    const previous = builds;
    const nextBuild = { ...build, archived };
    setBuilds((current) => current.map((item) => (item.id === build.id ? nextBuild : item)));
    try {
      const updated = await updateBuildArchive(build.id, archived);
      if (Boolean(updated?.archived) !== archived) {
        setBuilds(previous);
        setError(
          'Архив не сохранился: Google Apps Script работает на старой версии. Обновите Code.gs и сделайте New version -> Deploy.'
        );
        return;
      }
      setBuilds((current) => current.map((item) => (item.id === build.id ? updated : item)));
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
        <button className="fullscreen-tab-button" onClick={requestTelegramFullscreen}>
          Во весь экран
        </button>
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
          builds={activeBuilds}
          onAdd={openNewBuild}
          onEdit={openEditBuild}
          onCopy={openCopyBuild}
          onArchive={toggleArchive}
          onStatusChange={changeStatus}
        />
      ) : null}

      {!loading && activeTab === 'finance' ? <FinanceTab builds={activeBuilds} /> : null}

      {!loading && activeTab === 'archive' ? (
        <ArchiveTab
          builds={archivedBuilds}
          onEdit={openEditBuild}
          onCopy={openCopyBuild}
          onArchive={toggleArchive}
        />
      ) : null}

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
