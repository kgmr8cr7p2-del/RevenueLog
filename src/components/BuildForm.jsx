import { useMemo, useState } from 'react';
import {
  ACCOUNT_PRICES_USD,
  COMPONENTS,
  STATUSES,
  addDaysToDateString,
  calculateTotals,
  formatRub,
  formatUsd,
  toDateInputValue,
  toNumber
} from '../../shared/calculations.js';
import { fetchExchangeRate } from '../api.js';
import SummaryCard from './SummaryCard.jsx';

function createEmptyBuild() {
  return {
    status: 'assembly',
    pcNumber: '',
    contractNumber: '',
    components: COMPONENTS.map((component) => ({
      key: component.key,
      label: component.label,
      value: '',
      priceRub: ''
    })),
    accounts: { manual: '', auto: '' },
    fsmSubscriptionUsd: '',
    paid: { amount: '', currency: 'RUB', exchangeRate: '' },
    delivery: { amount: '', currency: 'RUB' },
    trackingNumber: '',
    paymentDate: '',
    shippingDate: '',
    receivedDate: '',
    buildDeadline: '',
    assemblyTermDays: '',
    assemblyStartDate: '',
    lastChangedAt: '',
    telegramId: '',
    contractFile: null,
    archived: false,
    note: ''
  };
}

function normalizeForForm(build) {
  if (!build) return createEmptyBuild();
  const existingComponents = new Map((build.components || []).map((item) => [item.key, item]));
  return {
    ...createEmptyBuild(),
    ...build,
    components: COMPONENTS.map((component) => ({
      key: component.key,
      label: component.label,
      value: existingComponents.get(component.key)?.value || '',
      priceRub: existingComponents.get(component.key)?.priceRub ?? ''
    })),
    accounts: {
      manual: build.accounts?.manual ?? '',
      auto: build.accounts?.auto ?? ''
    },
    paid: {
      amount: build.paid?.amount ?? '',
      currency: build.paid?.currency || 'RUB',
      exchangeRate: build.paid?.exchangeRate ?? ''
    },
    delivery: {
      amount: build.delivery?.amount ?? '',
      currency: build.delivery?.currency || 'RUB'
    },
    paymentDate: toDateInputValue(build.paymentDate),
    shippingDate: toDateInputValue(build.shippingDate),
    receivedDate: toDateInputValue(build.receivedDate),
    buildDeadline: toDateInputValue(build.buildDeadline),
    assemblyStartDate: toDateInputValue(build.assemblyStartDate),
    lastChangedAt: build.lastChangedAt || build.updatedAt || ''
  };
}

function formatRateMessage(rate) {
  const valuesText = (rate.values || [])
    .map((item) => `${item.label}: ${item.value} ₽`)
    .join('; ');
  const fetchedAt = rate.fetchedAt
    ? new Date(rate.fetchedAt).toLocaleString('ru-RU')
    : new Date().toLocaleString('ru-RU');
  const fallbackText = rate.fallbackReason ? ` ${rate.fallbackReason}.` : '';
  const detailsText = valuesText ? ` Текущие значения: ${valuesText}.` : '';

  return `${rate.source}: среднее ${rate.value} ₽.${detailsText} ${fetchedAt}.${fallbackText}`;
}

export default function BuildForm({ build, onClose, onSave, onDelete, onUploadContractFile, saving }) {
  const [form, setForm] = useState(() => normalizeForForm(build));
  const [rateLoading, setRateLoading] = useState(false);
  const [rateMessage, setRateMessage] = useState('');
  const [fileUploading, setFileUploading] = useState(false);
  const [fileMessage, setFileMessage] = useState('');
  const totals = useMemo(() => calculateTotals(form), [form]);
  const calculatedDeadline = useMemo(
    () => addDaysToDateString(form.paymentDate, form.assemblyTermDays),
    [form.paymentDate, form.assemblyTermDays]
  );
  const isEditing = Boolean(build?.id);
  const needsExchangeRate =
    toNumber(form.paid.exchangeRate) <= 0 &&
    (toNumber(form.accounts.manual) > 0 ||
      toNumber(form.accounts.auto) > 0 ||
      toNumber(form.fsmSubscriptionUsd) > 0 ||
      form.paid.currency === 'USD' ||
      form.delivery.currency === 'USD');

  function updateField(path, value) {
    setForm((current) => {
      const next = structuredClone(current);
      const parts = path.split('.');
      let target = next;
      for (let index = 0; index < parts.length - 1; index += 1) {
        target = target[parts[index]];
      }
      target[parts.at(-1)] = value;
      return next;
    });
  }

  function updateComponent(index, field, value) {
    setForm((current) => {
      const next = structuredClone(current);
      next.components[index][field] = value;
      return next;
    });
  }

  async function loadAutomaticRate() {
    setRateLoading(true);
    setRateMessage('');
    try {
      const rate = await fetchExchangeRate();
      updateField('paid.exchangeRate', rate.value);
      setRateMessage(formatRateMessage(rate));
    } catch (error) {
      setRateMessage(error.message || 'Не удалось получить курс');
    } finally {
      setRateLoading(false);
    }
  }

  async function uploadContractFile(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !build?.id || !onUploadContractFile) return;
    if (!/\.(pdf|doc|docx)$/i.test(file.name)) {
      setFileMessage('Можно загрузить только PDF, DOC или DOCX.');
      return;
    }

    setFileUploading(true);
    setFileMessage('');
    try {
      const updated = await onUploadContractFile(build.id, file);
      setForm((current) => ({
        ...current,
        contractFile: updated.contractFile || null,
        lastChangedAt: updated.lastChangedAt || current.lastChangedAt
      }));
      setFileMessage('Файл договора загружен.');
    } catch (error) {
      setFileMessage(error.message || 'Не удалось загрузить файл договора');
    } finally {
      setFileUploading(false);
    }
  }

  function submit(event) {
    event.preventDefault();
    if (fileUploading) {
      setFileMessage('Дождитесь окончания загрузки договора.');
      return;
    }

    const buildDeadline = addDaysToDateString(form.paymentDate, form.assemblyTermDays);
    const payload = { ...form, assemblyStartDate: form.paymentDate, buildDeadline };
    onSave({ ...payload, totals: calculateTotals(payload) });
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <form className="build-form" onSubmit={submit}>
        <header className="modal-header">
          <div>
            <h2>{isEditing ? 'Редактировать ПК' : 'Новый ПК'}</h2>
            <p>Все суммы пересчитываются сразу.</p>
          </div>
          <button type="button" className="ghost-button" onClick={onClose}>
            Закрыть
          </button>
        </header>

        <div className="form-grid">
          <label>
            Номер ПК
            <input
              value={form.pcNumber}
              onChange={(event) => updateField('pcNumber', event.target.value)}
              placeholder="Например: 124"
            />
          </label>
          <label>
            Номер договора
            <input
              value={form.contractNumber}
              onChange={(event) => updateField('contractNumber', event.target.value)}
              placeholder="Договор"
            />
          </label>
          <label>
            Статус
            <select value={form.status} onChange={(event) => updateField('status', event.target.value)}>
              {STATUSES.map((status) => (
                <option key={status.id} value={status.id}>
                  {status.title}
                </option>
              ))}
            </select>
          </label>
        </div>

        <section className="form-section">
          <h3>Комплектующие</h3>
          <div className="components-table">
            {form.components.map((component, index) => (
              <div className="component-row" key={component.key}>
                <label>
                  {component.label}
                  <input
                    value={component.value}
                    onChange={(event) => updateComponent(index, 'value', event.target.value)}
                    placeholder="Название"
                  />
                </label>
                <label>
                  Цена, ₽
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={component.priceRub}
                    onChange={(event) => updateComponent(index, 'priceRub', event.target.value)}
                    placeholder="0"
                  />
                </label>
              </div>
            ))}
          </div>
          <div className="inline-total">
            <span>Итого комплектующие</span>
            <strong>{formatRub(totals.componentsTotalRub)}</strong>
          </div>
        </section>

        <section className="form-section">
          <h3>Аккаунты и подписка</h3>
          <div className="form-grid">
            <label>
              Ручная прокачка, шт.
              <input
                type="number"
                min="0"
                step="1"
                value={form.accounts.manual}
                onChange={(event) => updateField('accounts.manual', event.target.value)}
              />
              <small>{formatUsd(ACCOUNT_PRICES_USD.manual)} за аккаунт</small>
            </label>
            <label>
              Автоматическая прокачка, шт.
              <input
                type="number"
                min="0"
                step="1"
                value={form.accounts.auto}
                onChange={(event) => updateField('accounts.auto', event.target.value)}
              />
              <small>{formatUsd(ACCOUNT_PRICES_USD.auto)} за аккаунт</small>
            </label>
            <label>
              Подписка FSM, $
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.fsmSubscriptionUsd}
                onChange={(event) => updateField('fsmSubscriptionUsd', event.target.value)}
              />
            </label>
          </div>
          <div className="inline-total">
            <span>Итого аккаунты</span>
            <strong>{formatUsd(totals.accountsCostUsd)}</strong>
          </div>
        </section>

        <section className="form-section">
          <h3>Оплата и доставка</h3>
          <div className="form-grid">
            <label>
              Сколько заплатил покупатель
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.paid.amount}
                onChange={(event) => updateField('paid.amount', event.target.value)}
              />
            </label>
            <label>
              Валюта оплаты
              <select
                value={form.paid.currency}
                onChange={(event) => updateField('paid.currency', event.target.value)}
              >
                <option value="RUB">Рубли</option>
                <option value="USD">Доллары</option>
              </select>
            </label>
            <label>
              Курс $
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.paid.exchangeRate}
                onChange={(event) => updateField('paid.exchangeRate', event.target.value)}
                placeholder="Например: 92"
              />
              <button
                type="button"
                className="inline-action-button"
                onClick={loadAutomaticRate}
                disabled={rateLoading}
              >
                {rateLoading ? 'Загрузка...' : 'Взять курс'}
              </button>
              {rateMessage ? <small>{rateMessage}</small> : null}
            </label>
            <label>
              Доставка
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.delivery.amount}
                onChange={(event) => updateField('delivery.amount', event.target.value)}
              />
            </label>
            <label>
              Валюта доставки
              <select
                value={form.delivery.currency}
                onChange={(event) => updateField('delivery.currency', event.target.value)}
              >
                <option value="RUB">Рубли</option>
                <option value="USD">Доллары</option>
              </select>
            </label>
            <label>
              Telegram ID или username
              <input
                value={form.telegramId}
                onChange={(event) => updateField('telegramId', event.target.value)}
                placeholder="@username или 123456789"
              />
            </label>
            <label>
              Трек-номер доставки
              <input
                value={form.trackingNumber}
                onChange={(event) => updateField('trackingNumber', event.target.value)}
                placeholder="Например: CDEK123456"
              />
            </label>
          </div>
          <label className="wide-label">
            Заметка
            <textarea
              value={form.note}
              onChange={(event) => updateField('note', event.target.value)}
              rows="4"
            />
          </label>
        </section>

        <section className="form-section">
          <h3>Даты</h3>
          <div className="form-grid">
            <label>
              Дата оплаты
              <input
                type="date"
                value={form.paymentDate}
                onChange={(event) => updateField('paymentDate', event.target.value)}
              />
            </label>
            <label>
              Срок на все, дней
              <input
                type="number"
                min="0"
                step="1"
                value={form.assemblyTermDays}
                onChange={(event) => updateField('assemblyTermDays', event.target.value)}
                placeholder="Например: 10"
              />
              <small>Считается от даты оплаты.</small>
            </label>
            <label>
              Дедлайн
              <input value={calculatedDeadline} placeholder="Дата оплаты + срок" readOnly />
            </label>
            <label>
              Последнее изменение
              <input value={form.lastChangedAt ? new Date(form.lastChangedAt).toLocaleString('ru-RU') : ''} readOnly />
            </label>
          </div>
        </section>

        <section className="form-section">
          <h3>Файл договора</h3>
          <div className="file-panel">
            {form.contractFile?.url ? (
              <a href={form.contractFile.url} target="_blank" rel="noreferrer">
                {form.contractFile.name || 'Открыть файл договора'}
              </a>
            ) : (
              <span>Файл договора не прикреплен.</span>
            )}
            {isEditing ? (
              <label>
                Загрузить PDF или Word
                <input
                  type="file"
                  accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  onChange={uploadContractFile}
                  disabled={fileUploading}
                />
              </label>
            ) : (
              <small>Сначала сохраните ПК, потом прикрепите договор.</small>
            )}
            {fileMessage ? <small>{fileMessage}</small> : null}
          </div>
        </section>

        {needsExchangeRate ? (
          <div className="warning-note">
            Введите курс $, чтобы рублевый расчет учитывал долларовые расходы.
          </div>
        ) : null}

        <section className="calculation-strip">
          <SummaryCard title="Покупатель заплатил" rub={totals.paidRub} usd={totals.paidUsd} />
          <SummaryCard title="Потрачено" rub={totals.expensesRub} usd={totals.expensesUsd} />
          <SummaryCard
            title="Заработано"
            rub={totals.profitRub}
            usd={totals.profitUsd}
            tone={totals.profitRub >= 0 ? 'good' : 'bad'}
          />
        </section>

        <footer className="modal-actions">
          {isEditing ? (
            <button type="button" className="danger-button" onClick={() => onDelete(build.id)}>
              Удалить
            </button>
          ) : (
            <span />
          )}
          <button type="submit" className="primary-button" disabled={saving || fileUploading}>
            {fileUploading ? 'Загрузка файла...' : saving ? 'Сохранение...' : 'Сохранить'}
          </button>
        </footer>
      </form>
    </div>
  );
}
