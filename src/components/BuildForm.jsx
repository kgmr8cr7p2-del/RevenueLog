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

export default function BuildForm({ build, onClose, onSave, onDelete, saving }) {
  const [form, setForm] = useState(() => normalizeForForm(build));
  const totals = useMemo(() => calculateTotals(form), [form]);
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

  function submit(event) {
    event.preventDefault();
    const buildDeadline =
      form.buildDeadline ||
      addDaysToDateString(form.assemblyStartDate || form.paymentDate, form.assemblyTermDays);
    const payload = { ...form, buildDeadline };
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
              Дата отправки
              <input
                type="date"
                value={form.shippingDate}
                onChange={(event) => updateField('shippingDate', event.target.value)}
              />
            </label>
            <label>
              Дата получения
              <input
                type="date"
                value={form.receivedDate}
                onChange={(event) => updateField('receivedDate', event.target.value)}
              />
            </label>
            <label>
              Дедлайн сборки
              <input
                type="date"
                value={form.buildDeadline}
                onChange={(event) => updateField('buildDeadline', event.target.value)}
              />
            </label>
            <label>
              Дата начала сборки
              <input
                type="date"
                value={form.assemblyStartDate}
                onChange={(event) => updateField('assemblyStartDate', event.target.value)}
              />
            </label>
            <label>
              Срок сборки, дней
              <input
                type="number"
                min="0"
                step="1"
                value={form.assemblyTermDays}
                onChange={(event) => updateField('assemblyTermDays', event.target.value)}
                placeholder="Например: 10"
              />
            </label>
            <label>
              Последнее изменение
              <input value={form.lastChangedAt ? new Date(form.lastChangedAt).toLocaleString('ru-RU') : ''} readOnly />
            </label>
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
          <button type="submit" className="primary-button" disabled={saving}>
            {saving ? 'Сохранение...' : 'Сохранить'}
          </button>
        </footer>
      </form>
    </div>
  );
}
