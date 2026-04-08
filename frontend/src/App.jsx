import { useEffect, useState } from 'react';
import microgateLogo from './assets/microgate2.png';

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || '/api';
const tokenStorageKey = 'compras-auth-token';
const mergedPurchasedStatus = 'comprado/aguardando entrega';
const finalizedStatus = 'finalizado';
const orderStatuses = [
  'pendente',
  mergedPurchasedStatus,
  finalizedStatus,
  'cancelado'
];
const panelFilterStatuses = ['pendente', mergedPurchasedStatus];
const historyFilterStatuses = [finalizedStatus, 'cancelado'];
const maxOrderImageBytes = 5 * 1024 * 1024;
const acceptedOrderImageTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);

const orderStatusLabels = {
  pending: 'pendente',
  purchased: mergedPurchasedStatus,
  waiting_delivery: mergedPurchasedStatus,
  delivered: 'Finalizado',
  email_pending: 'pendente email',
  cancelled: 'cancelado',
  pendente: 'pendente',
  comprado: mergedPurchasedStatus,
  'aguardando entrega': mergedPurchasedStatus,
  'comprado/aguardando entrega': mergedPurchasedStatus,
  'pendente email': 'pendente email',
  entregue: 'Finalizado',
  finalizado: 'Finalizado',
  cancelado: 'cancelado'
};

function normalizeOrderStatus(status) {
  if (status === 'comprado' || status === 'purchased') {
    return mergedPurchasedStatus;
  }

  if (status === 'aguardando entrega' || status === 'waiting_delivery') {
    return mergedPurchasedStatus;
  }

  if (status === 'entregue' || status === 'delivered') {
    return finalizedStatus;
  }

  return status;
}

const roleLabels = {
  admin: 'Administrador',
  user: 'Solicitante',
  administrador: 'Administrador',
  comprador: 'Comprador',
  solicitante: 'Solicitante'
};

const emptyUserForm = {
  id: null,
  name: '',
  username: '',
  password: '',
  email: '',
  role: 'solicitante'
};

const emptyPasswordForm = {
  currentPassword: '',
  newPassword: '',
  confirmPassword: ''
};

const createEmptyRequestItem = () => ({
  productName: '',
  productLink: '',
  notes: '',
  compraParaguai: false,
  quantity: 1,
  productValue: '',
  saleValue: '0.00',
  imageFile: null,
  imagePreviewUrl: ''
});

const createEmptyRequestForm = () => ({
  requestName: '',
  buyerId: null,
  urgency: 'normal',
  relatedOs: '',
  items: [createEmptyRequestItem()]
});

const isFinishedStatus = (status) =>
  status === finalizedStatus ||
  status === 'entregue' ||
  status === 'delivered' ||
  status === 'cancelado' ||
  status === 'cancelled';
const isPendingStatus = (status) => status === 'pendente' || status === 'pending';

function formatCurrencyValue(value) {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return '0.00';
  }

  return numericValue.toFixed(2);
}

function getBaseSaleMultiplier(productValue) {
  return Number(productValue) < 1000 ? 1.7 : 1.6;
}

function calculateSaleValue(productValue, compraParaguai = false) {
  const normalizedProductValue = Number(productValue);

  if (!Number.isFinite(normalizedProductValue)) {
    return 0;
  }

  const baseMultiplier = getBaseSaleMultiplier(normalizedProductValue);
  const finalMultiplier = compraParaguai ? baseMultiplier * 1.25 : baseMultiplier;

  return Number(formatCurrencyValue(normalizedProductValue * finalMultiplier));
}

function formatDateTime(value) {
  if (!value) {
    return '-';
  }

  return new Date(value).toLocaleString('pt-BR');
}

function validateRequestImageFile(file) {
  if (!file) {
    return '';
  }

  if (!acceptedOrderImageTypes.has(file.type)) {
    return 'Tipo de imagem invalido. Use JPG, PNG ou WEBP.';
  }

  if (file.size > maxOrderImageBytes) {
    return 'A imagem deve ter no maximo 5 MB.';
  }

  return '';
}

function revokeRequestItemPreview(item) {
  if (item?.imagePreviewUrl) {
    URL.revokeObjectURL(item.imagePreviewUrl);
  }
}

function buildCreateOrderFormData(form) {
  const formData = new FormData();

  formData.append('requestName', form.requestName);
  formData.append('buyerId', String(form.buyerId));
  formData.append('urgency', form.urgency);
  formData.append('relatedOs', form.relatedOs || '');

  const serializedItems = form.items.map((item) => ({
    productName: item.productName,
    productLink: item.productLink,
    notes: item.notes,
    compraParaguai: Boolean(item.compraParaguai),
    quantity: Number(item.quantity),
    productValue: Number(item.productValue || 0)
  }));

  formData.append('items', JSON.stringify(serializedItems));

  form.items.forEach((item, index) => {
    if (item.imageFile) {
      formData.append(`itemImage_${index}`, item.imageFile);
    }
  });

  return formData;
}

function normalizeDateInputValue(value) {
  if (!value) {
    return '';
  }

  return String(value).slice(0, 10);
}

function openDatePickerOnFieldClick(event) {
  const input = event.currentTarget;

  if (typeof input.showPicker === 'function') {
    input.showPicker();
  }
}

function getOrderIdFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const rawValue = params.get('orderId');
  const orderId = Number(rawValue);

  if (!Number.isInteger(orderId) || orderId <= 0) {
    return null;
  }

  return orderId;
}

async function parseApiResponse(response) {
  const contentType = response.headers.get('content-type') || '';

  if (contentType.includes('application/json')) {
    return response.json();
  }

  const rawText = await response.text();
  return { rawText };
}

function formatOrderStatus(status) {
  return orderStatusLabels[status] || status || '-';
}

function normalizeRole(role) {
  if (role === 'admin') {
    return 'administrador';
  }

  if (role === 'user') {
    return 'solicitante';
  }

  return role;
}

function isAdministrator(user) {
  return normalizeRole(user?.role) === 'administrador';
}

function isBuyer(user) {
  return normalizeRole(user?.role) === 'comprador';
}

function isRequester(user) {
  return normalizeRole(user?.role) === 'solicitante';
}

function canManageUsers(user) {
  return isAdministrator(user);
}

function canReopenOrder(user) {
  return true;
}

function getPersistedOrderStatus(order) {
  return order?.persistedStatus || order?.status;
}

function canEditOrder(user, order) {
  if (!user || !order) {
    return false;
  }

  if (isFinishedStatus(getPersistedOrderStatus(order))) {
    return false;
  }

  return true;
}

function canDeleteOrder(user, order) {
  if (!user || !order) {
    return false;
  }

  return !isFinishedStatus(getPersistedOrderStatus(order));
}

function formatRoleLabel(role) {
  return roleLabels[normalizeRole(role)] || role || '-';
}

function OrderTimelineSection({ title, entries, emptyMessage, contentField = 'description' }) {
  return (
    <section className="order-block">
      <div className="section-header">
        <div>
          <p className="eyebrow">{title}</p>
        </div>
      </div>

      <div className="history-list">
        {entries?.length ? (
          entries.map((entry) => (
            <article key={entry.id} className="history-item">
              <div className="history-item__meta">
                <strong>{entry.name}</strong>
                <span>@{entry.username}</span>
                <span>{formatDateTime(entry.createdAt)}</span>
              </div>
              <p>{entry[contentField]}</p>
            </article>
          ))
        ) : (
          <p className="empty-state">{emptyMessage}</p>
        )}
      </div>
    </section>
  );
}

function OrderDetailContent({
  currentSection,
  commentDraft,
  selectedOrder,
  selectedOrderCanEdit,
  users,
  openOrderItemImage,
  updateSelectedOrderCommentDraft,
  updateSelectedOrderField,
  updateSelectedOrderItem
}) {
  const relatedOsValue = String(selectedOrder.relatedOs ?? '');

  if (currentSection === 'comments') {
    return (
      <>
        <section className="order-block">
          <div className="section-header">
            <div>
              <p className="eyebrow">Comentarios</p>
            </div>
          </div>

          <label>
            <span>Comentarios / Obs</span>
            <textarea
              value={commentDraft}
              onChange={(event) => updateSelectedOrderCommentDraft(event.target.value)}
              rows={5}
              disabled={!selectedOrderCanEdit}
            />
          </label>
        </section>

        <OrderTimelineSection
          title="Histórico de comentarios"
          entries={selectedOrder.commentsHistory}
          emptyMessage="Nenhum comentario registrado ainda."
          contentField="comment"
        />
      </>
    );
  }

  if (currentSection === 'history') {
    return (
      <OrderTimelineSection
        title="Histórico de alteracoes"
        entries={selectedOrder.history}
        emptyMessage="Nenhuma alteracao registrada ainda."
      />
    );
  }

  return (
    <>
      <section className="order-block">
        <div className="section-header">
          <div>
            <p className="eyebrow">Informacoes gerais</p>
          </div>
        </div>

        <div className="order-general-grid">
          <label>
            <span>Solicitante</span>
            <input
              type="text"
              value={`${selectedOrder.requesterName} (@${selectedOrder.requesterUsername})`}
              readOnly
            />
          </label>

          <label>
            <span>Data do pedido</span>
            <input type="text" value={formatDateTime(selectedOrder.createdAt)} readOnly />
          </label>

          <label>
            <span>OS</span>
            <input
              type="text"
              value={relatedOsValue}
              onChange={(event) => {
                const value = event.target.value.replace(/[^0-9]/g, '');
                updateSelectedOrderField('relatedOs', value);
              }}
              placeholder="Numero da OS"
              disabled={!selectedOrderCanEdit}
            />
          </label>

          <label>
            <span>urgência</span>
            <input
              type="text"
              value={selectedOrder.urgency === 'priority' ? 'Prioridade' : 'Normal'}
              readOnly
            />
          </label>

          <label>
            <span>Status do pedido</span>
            <select
              value={selectedOrder.status}
              onChange={(event) => updateSelectedOrderField('status', event.target.value)}
              disabled={!selectedOrderCanEdit}
            >
              {orderStatuses.map((status) => (
                <option key={status} value={status}>
                  {formatOrderStatus(status)}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>Comprador</span>
            <select
              value={selectedOrder.buyerId || ''}
              onChange={(event) =>
                updateSelectedOrderField('buyerId', Number(event.target.value) || null)
              }
              disabled={!selectedOrderCanEdit}
            >
              <option value="">Selecione</option>
              {users
                .filter((user) => normalizeRole(user.role) === 'comprador')
                .map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name}
                  </option>
                ))}
            </select>
          </label>

          <label>
            <span>Previsão de entrega</span>
            <input
              type="date"
              value={normalizeDateInputValue(selectedOrder.estimatedDelivery)}
              onClick={openDatePickerOnFieldClick}
              onChange={(event) =>
                updateSelectedOrderField('estimatedDelivery', event.target.value)
              }
              disabled={!selectedOrderCanEdit}
            />
          </label>
        </div>
      </section>

      <section className="order-block">
        <div className="section-header">
          <div>
            <p className="eyebrow">Itens solicitados</p>
          </div>
        </div>

        <div className="order-items-table">
          <div className="order-items-table__head">
            <span>Produto</span>
            <span>Qtd</span>
            <span>Link</span>
            <span>Imagem</span>
            <span>Detalhes</span>
            <span>Obs</span>
            <span>Compra PY</span>
            <span>Valor do produto</span>
            <span>Valor da venda</span>
            <span>Valor repassado</span>
          </div>

          <div className="order-items-table__body">
            {selectedOrder.items.map((item) => (
              <article key={item.id} className="order-item-row">
                <strong>{item.productName}</strong>
                <span>{item.quantity}</span>
                <div className="order-item-link-field">
                  <input
                    type="url"
                    value={item.productLink}
                    onChange={(event) =>
                      updateSelectedOrderItem(item.id, 'productLink', event.target.value)
                    }
                    placeholder="https://..."
                    disabled={!selectedOrderCanEdit}
                  />
                  <button
                    type="button"
                    className="button button--ghost"
                    onClick={() => window.open(item.productLink, '_blank', 'noopener,noreferrer')}
                    disabled={!item.productLink}
                  >
                    Abrir
                  </button>
                </div>
                <div className="order-item-link-field">
                  <button
                    type="button"
                    className="button button--ghost"
                    onClick={() => openOrderItemImage(selectedOrder.id, item.id, item.productName)}
                    disabled={!item.imageUrl}
                  >
                    Ver imagem
                  </button>
                </div>
                <span>{item.notes || '-'}</span>
                <label className="checkbox-field">
                  <input
                    type="checkbox"
                    checked={Boolean(item.compraParaguai)}
                    onChange={(event) =>
                      updateSelectedOrderItem(item.id, 'compraParaguai', event.target.checked)
                    }
                    disabled={!selectedOrderCanEdit}
                  />
                  <span>Sim</span>
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={item.productValue}
                  onChange={(event) =>
                    updateSelectedOrderItem(item.id, 'productValue', event.target.value)
                  }
                  disabled={!selectedOrderCanEdit}
                />
                <input type="text" value={formatCurrencyValue(item.saleValue)} readOnly />
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={item.passedValue}
                  onChange={(event) =>
                    updateSelectedOrderItem(item.id, 'passedValue', event.target.value)
                  }
                  disabled={!selectedOrderCanEdit}
                />
              </article>
            ))}
          </div>
        </div>

        <div className="order-total">
          <span>Total do pedido</span>
          <strong>R$ {formatCurrencyValue(selectedOrder.total)}</strong>
        </div>
      </section>
    </>
  );
}

function PasswordChangeContent({
  currentUser,
  passwordForm,
  passwordMessage,
  passwordMessageType,
  isSavingPassword,
  onChangePasswordField,
  onSubmitPasswordChange
}) {
  return (
    <section className="request-layout">
      <article className="panel panel--centered">
        <form className="user-form" onSubmit={onSubmitPasswordChange}>
          <div className="section-header section-header--page">
            <div>
              <p className="eyebrow">Conta</p>
              <h1 className="page-title">Alterar senha</h1>
              <p className="description">
                {currentUser.passwordChangeRequired
                  ? 'A senha inicial precisa ser alterada antes de continuar.'
                  : 'Atualize sua senha de acesso quando precisar.'}
              </p>
            </div>
          </div>

          <label>
            <span>Senha atual</span>
            <input
              type="password"
              value={passwordForm.currentPassword}
              onChange={(event) => onChangePasswordField('currentPassword', event.target.value)}
              placeholder="Informe a senha atual"
            />
          </label>

          <label>
            <span>Nova senha</span>
            <input
              type="password"
              value={passwordForm.newPassword}
              onChange={(event) => onChangePasswordField('newPassword', event.target.value)}
              placeholder="Informe a nova senha"
            />
          </label>

          <label>
            <span>Confirmar nova senha</span>
            <input
              type="password"
              value={passwordForm.confirmPassword}
              onChange={(event) => onChangePasswordField('confirmPassword', event.target.value)}
              placeholder="Repita a nova senha"
            />
          </label>

          {passwordMessage ? (
            <p className={`feedback ${passwordMessageType === 'error' ? 'feedback--error' : ''}`}>
              {passwordMessage}
            </p>
          ) : null}

          <button type="submit" className="button button--green" disabled={isSavingPassword}>
            {isSavingPassword ? 'Salvando...' : 'Salvar senha'}
          </button>
        </form>
      </article>
    </section>
  );
}

function App() {
  const [token, setToken] = useState(() => localStorage.getItem(tokenStorageKey) || '');
  const [currentUser, setCurrentUser] = useState(null);
  const [isBootstrapping, setIsBootstrapping] = useState(Boolean(token));
  const [activeTab, setActiveTab] = useState('request');
  const [loginForm, setLoginForm] = useState({
    username: '',
    password: ''
  });
  const [loginError, setLoginError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [requestForm, setRequestForm] = useState(createEmptyRequestForm);
  const [requestMessage, setRequestMessage] = useState('');
  const [requestMessageType, setRequestMessageType] = useState('success');
  const [isSubmittingRequest, setIsSubmittingRequest] = useState(false);
  const [passwordForm, setPasswordForm] = useState(emptyPasswordForm);
  const [passwordMessage, setPasswordMessage] = useState('');
  const [passwordMessageType, setPasswordMessageType] = useState('success');
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  const [orders, setOrders] = useState([]);
  const [ordersFilters, setOrdersFilters] = useState({
    id: '',
    status: '',
    requesterId: ''
  });
  const [isLoadingOrders, setIsLoadingOrders] = useState(false);
  const [ordersError, setOrdersError] = useState('');
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [isLoadingSelectedOrder, setIsLoadingSelectedOrder] = useState(false);
  const [selectedOrderError, setSelectedOrderError] = useState('');
  const [orderActionMessage, setOrderActionMessage] = useState('');
  const [isSavingSelectedOrder, setIsSavingSelectedOrder] = useState(false);
  const [isDeletingSelectedOrder, setIsDeletingSelectedOrder] = useState(false);
  const [reopeningOrderId, setReopeningOrderId] = useState(null);
  const [selectedOrderSection, setSelectedOrderSection] = useState('order');
  const [selectedOrderCommentDraft, setSelectedOrderCommentDraft] = useState('');
  const [users, setUsers] = useState([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [usersError, setUsersError] = useState('');
  const [userForm, setUserForm] = useState(emptyUserForm);
  const [isSavingUser, setIsSavingUser] = useState(false);
  const [formMessage, setFormMessage] = useState('');
  const [popup, setPopup] = useState(null);
  const [orderImageModal, setOrderImageModal] = useState({
    isOpen: false,
    src: '',
    title: '',
    subtitle: '',
    loading: false,
    error: ''
  });
  const [linkedOrderId, setLinkedOrderId] = useState(() => getOrderIdFromUrl());

  const activeOrders = orders.filter((order) => !isFinishedStatus(order.status));
  const historicalOrders = orders.filter((order) => isFinishedStatus(order.status));
  const passwordChangeRequired = Boolean(currentUser?.passwordChangeRequired);
  const selectedOrderCanEdit = canEditOrder(currentUser, selectedOrder);
  const selectedOrderCanDelete = canDeleteOrder(currentUser, selectedOrder);
  const userCanReopenOrder = canReopenOrder(currentUser);
  const availableStatusFilters =
    activeTab === 'history' ? historyFilterStatuses : panelFilterStatuses;

  useEffect(() => {
    if (!popup) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      setPopup(null);
    }, 3000);

    return () => window.clearTimeout(timeoutId);
  }, [popup]);

  useEffect(() => {
    return () => {
      if (orderImageModal.src?.startsWith('blob:')) {
        URL.revokeObjectURL(orderImageModal.src);
      }
    };
  }, [orderImageModal.src]);

  const hasUnsavedRequestChanges =
    Boolean(requestForm.requestName.trim()) ||
    Boolean(requestForm.relatedOs.trim()) ||
    requestForm.items.some(
      (item) =>
        item.productName.trim() ||
        item.productLink.trim() ||
        item.notes.trim() ||
        item.compraParaguai ||
        String(item.quantity) !== '1' ||
        String(item.productValue).trim() ||
        Boolean(item.imageFile)
    );

  function clearRequestFormState() {
    setRequestForm((current) => {
      current.items.forEach(revokeRequestItemPreview);
      return createEmptyRequestForm();
    });
  }

  useEffect(() => {
    if (currentUser?.passwordChangeRequired) {
      setActiveTab('password');
    }
  }, [currentUser]);

  useEffect(() => {
    if (!token) {
      setCurrentUser(null);
      setIsBootstrapping(false);
      return;
    }

    async function bootstrapSession() {
      try {
        const response = await fetch(`${apiBaseUrl}/auth/me`, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });

        if (!response.ok) {
          throw new Error('Sua sessao expirou. Faca login novamente.');
        }

        const data = await response.json();
        setCurrentUser(data.user);
        if (data.user?.passwordChangeRequired) {
          setActiveTab('password');
        }
      } catch (error) {
        clearSession();
        setLoginError(error.message);
      } finally {
        setIsBootstrapping(false);
      }
    }

    bootstrapSession();
  }, [token]);

  useEffect(() => {
    if (!currentUser || currentUser.passwordChangeRequired) {
      setOrders([]);
      return;
    }

    loadOrders(token, ordersFilters);
  }, [currentUser, token, ordersFilters]);

  useEffect(() => {
    if (!currentUser || !linkedOrderId) {
      return;
    }

    openOrderActions(linkedOrderId);
    setLinkedOrderId(null);

    const nextUrl = new URL(window.location.href);
    nextUrl.searchParams.delete('orderId');
    window.history.replaceState({}, '', nextUrl.toString());
  }, [currentUser, linkedOrderId]);

  useEffect(() => {
    if (!ordersFilters.status) {
      return;
    }

    if (availableStatusFilters.includes(ordersFilters.status)) {
      return;
    }

    setOrdersFilters((current) => ({
      ...current,
      status: ''
    }));
  }, [activeTab, availableStatusFilters, ordersFilters.status]);

  useEffect(() => {
    if (currentUser && !currentUser.passwordChangeRequired) {
      loadUsers(token);
    } else {
      setUsers([]);
    }
  }, [currentUser, token]);

  useEffect(() => {
    function handleBeforeUnload(event) {
      if (!hasUnsavedRequestChanges) {
        return;
      }

      event.preventDefault();
      event.returnValue = '';
    }

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [hasUnsavedRequestChanges]);

  async function loadUsers(currentToken) {
    setIsLoadingUsers(true);
    setUsersError('');

    try {
      const response = await fetch(`${apiBaseUrl}/users`, {
        headers: {
          Authorization: `Bearer ${currentToken}`
        }
      });

      if (!response.ok) {
        throw new Error('Nao foi possivel carregar os Usuários.');
      }

      const data = await response.json();
      setUsers(data.users);
    } catch (error) {
      setUsersError(error.message);
    } finally {
      setIsLoadingUsers(false);
    }
  }

  async function loadOrders(currentToken, filters = {}) {
    setIsLoadingOrders(true);
    setOrdersError('');

    try {
      const query = new URLSearchParams();

      if (filters.id?.trim()) {
        query.set('id', filters.id.trim());
      }

      if (filters.status?.trim()) {
        query.set('status', filters.status.trim());
      }

      if (filters.requesterId?.trim()) {
        query.set('requesterId', filters.requesterId.trim());
      }

      const response = await fetch(`${apiBaseUrl}/orders?${query.toString()}`, {
        headers: {
          Authorization: `Bearer ${currentToken}`
        }
      });

      if (!response.ok) {
        throw new Error('Nao foi possivel carregar os pedidos.');
      }

      const data = await response.json();
      setOrders(data.orders.map((order) => ({ ...order, status: normalizeOrderStatus(order.status) })));
    } catch (error) {
      setOrdersError(error.message);
    } finally {
      setIsLoadingOrders(false);
    }
  }

  async function loadOrderDetails(orderId) {
    setIsLoadingSelectedOrder(true);
    setSelectedOrderError('');
    setOrderActionMessage('');

    try {
      const response = await fetch(`${apiBaseUrl}/orders/${orderId}`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Nao foi possivel carregar o pedido.');
      }

      const persistedStatus = normalizeOrderStatus(data.order.status);

      setSelectedOrder({
        ...data.order,
        status: persistedStatus,
        persistedStatus,
        relatedOs: data.order.relatedOs ? String(data.order.relatedOs) : '',
        estimatedDelivery: normalizeDateInputValue(data.order.estimatedDelivery),
        history: data.order.history || [],
        commentsHistory: data.order.commentsHistory || []
      });
      setSelectedOrderCommentDraft(data.order.comments || '');
    } catch (error) {
      setSelectedOrderError(error.message);
    } finally {
      setIsLoadingSelectedOrder(false);
    }
  }

  function updateSelectedOrderField(field, value) {
    setOrderActionMessage('');
    setSelectedOrder((current) => {
      if (!current) {
        return current;
      }

      const nextOrder = {
        ...current,
        [field]: value
      };

      if (field === 'relatedOs') {
        nextOrder.relatedOs = value;
      }

      return nextOrder;
    });
  }

  function updateSelectedOrderCommentDraft(value) {
    setOrderActionMessage('');
    setSelectedOrderCommentDraft(value);
  }

  function updateSelectedOrderItem(itemId, field, value) {
    setOrderActionMessage('');
    setSelectedOrder((current) => {
      if (!current) {
        return current;
      }

      const items = current.items.map((item) => {
        if (item.id !== itemId) {
          return item;
        }

        const updatedItem = {
          ...item,
          [field]: value
        };

        if (field === 'productValue' || field === 'compraParaguai') {
          updatedItem.saleValue = calculateSaleValue(
            Number(updatedItem.productValue || 0),
            Boolean(updatedItem.compraParaguai)
          );
          updatedItem.passedValue = Number(
            formatCurrencyValue(
              Number(updatedItem.saleValue || 0) * Number(updatedItem.quantity || 0)
            )
          );
        }

        return updatedItem;
      });

      const total = items.reduce(
        (sum, item) => sum + Number(item.passedValue || 0),
        0
      );

      return {
        ...current,
        items,
        total: Number(formatCurrencyValue(total))
      };
    });
  }

  function openOrderActions(orderId) {
    setActiveTab('panel');
    setSelectedOrderSection('order');
    loadOrderDetails(orderId);
  }

  function handleOrderRowKeyDown(event, orderId) {
    if (event.key !== 'Enter' && event.key !== ' ') {
      return;
    }

    event.preventDefault();
    openOrderActions(orderId);
  }

  function closeOrderActions() {
    setSelectedOrder(null);
    setSelectedOrderError('');
    setOrderActionMessage('');
    setSelectedOrderSection('order');
    setSelectedOrderCommentDraft('');
  }

  function clearSession() {
    localStorage.removeItem(tokenStorageKey);
    setToken('');
    setCurrentUser(null);
    setUsers([]);
    setUserForm(emptyUserForm);
    setFormMessage('');
    setPasswordForm(emptyPasswordForm);
    setPasswordMessage('');
  }

  function confirmDiscardUnsavedRequest() {
    if (!hasUnsavedRequestChanges) {
      return true;
    }

    const confirmed = window.confirm(
      'Existem alteracoes nao salvas neste pedido. Deseja sair mesmo assim?'
    );

    if (confirmed) {
      clearRequestFormState();
      setRequestMessage('');
    }

    return confirmed;
  }

  function updateLoginField(field, value) {
    setLoginForm((current) => ({
      ...current,
      [field]: value
    }));
  }

  function updatePasswordField(field, value) {
    setPasswordMessage('');
    setPasswordForm((current) => ({
      ...current,
      [field]: value
    }));
  }

  function updateUserField(field, value) {
    setUserForm((current) => ({
      ...current,
      [field]: value
    }));
  }

  function updateRequestField(field, value) {
    setRequestMessage('');
    setRequestForm((current) => ({
      ...current,
      [field]: value
    }));
  }

  function updateOrdersFilter(field, value) {
    setOrdersFilters((current) => ({
      ...current,
      [field]: value
    }));
  }

  function updateRequestItem(index, field, value) {
    setRequestMessage('');
    setRequestForm((current) => ({
      ...current,
      items: current.items.map((item, itemIndex) => {
        if (itemIndex !== index) {
          return item;
        }

        const updatedItem = {
          ...item,
          [field]: value
        };

        if (field === 'productValue' || field === 'compraParaguai') {
          updatedItem.saleValue = formatCurrencyValue(
            calculateSaleValue(
              Number(updatedItem.productValue || 0),
              Boolean(updatedItem.compraParaguai)
            )
          );
        }

        if (field === 'quantity') {
          updatedItem.quantity = value;
        }

        return updatedItem;
      })
    }));
  }

  function addRequestItem() {
    setRequestForm((current) => ({
      ...current,
      items: [...current.items, createEmptyRequestItem()]
    }));
  }

  function removeRequestItem(index) {
    setRequestMessage('');
    setRequestForm((current) => {
      if (current.items.length === 1) {
        current.items.forEach(revokeRequestItemPreview);
        return {
          ...current,
          items: [createEmptyRequestItem()]
        };
      }

      const itemToRemove = current.items[index];
      revokeRequestItemPreview(itemToRemove);

      return {
        ...current,
        items: current.items.filter((_, itemIndex) => itemIndex !== index)
      };
    });
  }

  function updateRequestItemImage(index, file) {
    setRequestMessage('');
    const imageError = validateRequestImageFile(file);

    if (imageError) {
      setRequestMessageType('error');
      setRequestMessage(imageError);
      return;
    }

    setRequestForm((current) => ({
      ...current,
      items: current.items.map((item, itemIndex) => {
        if (itemIndex !== index) {
          return item;
        }

        revokeRequestItemPreview(item);

        return {
          ...item,
          imageFile: file || null,
          imagePreviewUrl: file ? URL.createObjectURL(file) : ''
        };
      })
    }));
  }

  function changeTab(nextTab) {
    if (nextTab === activeTab) {
      closeOrderActions();
      return;
    }

    if (passwordChangeRequired && nextTab !== 'password') {
      return;
    }

    if (!confirmDiscardUnsavedRequest()) {
      return;
    }

    closeOrderActions();
    setActiveTab(nextTab);
  }

  async function handleLogin(event) {
    event.preventDefault();
    setIsLoggingIn(true);
    setLoginError('');

    try {
      const response = await fetch(`${apiBaseUrl}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(loginForm)
      });
      const data = await parseApiResponse(response);

      if (!response.ok) {
        throw new Error(data.error || 'Falha ao autenticar.');
      }

      if (!data?.token || !data?.user) {
        throw new Error(
          'Resposta inesperada da API. Verifique se o endpoint /api/auth/login esta configurado no servidor.'
        );
      }

      localStorage.setItem(tokenStorageKey, data.token);
      setToken(data.token);
      setCurrentUser(data.user);
      setActiveTab(data.user?.passwordChangeRequired ? 'password' : 'request');
      setPasswordForm(emptyPasswordForm);
      setPasswordMessage('');
      setLoginForm({
        username: '',
        password: ''
      });
    } catch (error) {
      setLoginError(error.message);
    } finally {
      setIsLoggingIn(false);
    }
  }

  function handleLogout() {
    if (!confirmDiscardUnsavedRequest()) {
      return;
    }

    clearSession();
    closeOrderActions();
    clearRequestFormState();
    setRequestMessage('');
    setPasswordForm(emptyPasswordForm);
    setPasswordMessage('');
  }

  async function handlePasswordChangeSubmit(event) {
    event.preventDefault();

    if (!currentUser) {
      return;
    }

    if (!passwordForm.currentPassword.trim() || !passwordForm.newPassword.trim()) {
      setPasswordMessageType('error');
      setPasswordMessage('Informe a senha atual e a nova senha.');
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordMessageType('error');
      setPasswordMessage('A confirmação da nova senha não confere.');
      return;
    }

    setIsSavingPassword(true);
    setPasswordMessage('');

    try {
      const response = await fetch(`${apiBaseUrl}/auth/password`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          currentPassword: passwordForm.currentPassword,
          newPassword: passwordForm.newPassword
        })
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Nao foi possivel atualizar a senha.');
      }

      setCurrentUser(data.user);
      setPasswordForm(emptyPasswordForm);
      setPasswordMessageType('success');
      setPasswordMessage('Senha atualizada com sucesso.');
      setPopup({
        type: 'success',
        message: 'Senha atualizada com sucesso.'
      });
      setActiveTab('request');
    } catch (error) {
      setPasswordMessageType('error');
      setPasswordMessage(error.message);
    } finally {
      setIsSavingPassword(false);
    }
  }

  async function handleRequestSubmit(event) {
    event.preventDefault();
    setIsSubmittingRequest(true);
    setRequestMessage('');

    if (!requestForm.requestName.trim()) {
      setRequestMessage('Informe o nome do pedido.');
      setIsSubmittingRequest(false);
      return;
    }

    if (!requestForm.buyerId) {
      setRequestMessage('Selecione um comprador.');
      setIsSubmittingRequest(false);
      return;
    }

    const invalidItem = requestForm.items.find((item) =>
      Boolean(validateRequestImageFile(item.imageFile))
    );

    if (invalidItem) {
      setRequestMessageType('error');
      setRequestMessage(validateRequestImageFile(invalidItem.imageFile));
      setIsSubmittingRequest(false);
      return;
    }

    try {
      const formData = buildCreateOrderFormData(requestForm);

      const response = await fetch(`${apiBaseUrl}/orders`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`
        },
        body: formData
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Nao foi possivel enviar o pedido.');
      }

      clearRequestFormState();
      setRequestMessageType('success');
      setRequestMessage('Pedido enviado com sucesso.');
      setPopup({
        type: 'success',
        message: 'Pedido enviado com sucesso.'
      });
      setActiveTab('panel');
      await loadOrders(token, ordersFilters);
    } catch (error) {
      setRequestMessageType('error');
      setRequestMessage(error.message);
    } finally {
      setIsSubmittingRequest(false);
    }
  }

  async function handleUserSubmit(event) {
    event.preventDefault();
    setIsSavingUser(true);
    setFormMessage('');

    const isEditing = Boolean(userForm.id);
    const endpoint = isEditing
      ? `${apiBaseUrl}/users/${userForm.id}`
      : `${apiBaseUrl}/users`;
    const method = isEditing ? 'PUT' : 'POST';

    try {
      const response = await fetch(endpoint, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          name: userForm.name,
          username: userForm.username,
          password: userForm.password,
          email: userForm.email,
          role: userForm.role
        })
      });
      const data = response.status === 204 ? null : await response.json();

      if (!response.ok) {
        throw new Error(data?.error || 'Nao foi possivel salvar o usuario.');
      }

      setFormMessage(
        isEditing ? 'Usuario atualizado com sucesso.' : 'Usuario criado com sucesso.'
      );
      setUserForm(emptyUserForm);
      await loadUsers(token);
    } catch (error) {
      setFormMessage(error.message);
    } finally {
      setIsSavingUser(false);
    }
  }

  function handleEditUser(user) {
    setFormMessage('');
    setUserForm({
      id: user.id,
      name: user.name,
      username: user.username,
      password: '',
      email: user.email || '',
      role: user.role
    });
  }

  async function handleDeleteUser(userId) {
    const shouldDelete = window.confirm('Deseja remover este usuario?');

    if (!shouldDelete) {
      return;
    }

    setFormMessage('');

    try {
      const response = await fetch(`${apiBaseUrl}/users/${userId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Nao foi possivel remover o usuario.');
      }

      await loadUsers(token);
    } catch (error) {
      setFormMessage(error.message);
    }
  }

  async function handleSaveSelectedOrder(event) {
    event.preventDefault();

    if (!selectedOrder || !canEditOrder(currentUser, selectedOrder)) {
      return;
    }

    if (selectedOrder.estimatedDelivery && isPendingStatus(selectedOrder.status)) {
      setPopup({
        type: 'warning',
        message: 'Defina um status diferente de pendente ao informar uma Previsão de entrega.'
      });
      return;
    }

    setIsSavingSelectedOrder(true);
    setOrderActionMessage('');

    try {
      const commentToSave = selectedOrderCommentDraft || selectedOrder.comments || '';

      const response = await fetch(`${apiBaseUrl}/orders/${selectedOrder.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          buyerId: selectedOrder.buyerId,
          status: selectedOrder.status,
          estimatedDelivery: selectedOrder.estimatedDelivery || '',
          comments: commentToSave,
          relatedOs: String(selectedOrder.relatedOs ?? ''),
          items: selectedOrder.items.map((item) => ({
            id: item.id,
            productLink: item.productLink,
            compraParaguai: Boolean(item.compraParaguai),
            productValue: Number(item.productValue || 0),
            passedValue: Number(item.passedValue || 0)
          }))
        })
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Nao foi possivel salvar o pedido.');
      }

      const persistedStatus = normalizeOrderStatus(data.order.status);

      setSelectedOrder({
        ...data.order,
        status: persistedStatus,
        persistedStatus,
        comments: commentToSave,
        relatedOs: String(data.order.relatedOs ?? ''),
        estimatedDelivery: normalizeDateInputValue(data.order.estimatedDelivery),
        history: data.order.history || [],
        commentsHistory: data.order.commentsHistory || []
      });
      setSelectedOrderCommentDraft('');
      setOrderActionMessage('Pedido atualizado com sucesso.');
      setPopup({
        type: 'success',
        message: 'Alteracoes salvas com sucesso.'
      });
      await loadOrders(token, ordersFilters);

      if (isFinishedStatus(data.order.status)) {
        setActiveTab('history');
      }
    } catch (error) {
      setOrderActionMessage(error.message);
    } finally {
      setIsSavingSelectedOrder(false);
    }
  }

  function closeOrderImageModal() {
    setOrderImageModal((current) => {
      if (current.src?.startsWith('blob:')) {
        URL.revokeObjectURL(current.src);
      }

      return {
        isOpen: false,
        src: '',
        title: '',
        subtitle: '',
        loading: false,
        error: ''
      };
    });
  }

  async function openOrderItemImage(orderId, itemId, productName = '') {
    setOrderImageModal((current) => {
      if (current.src?.startsWith('blob:')) {
        URL.revokeObjectURL(current.src);
      }

      return {
        isOpen: true,
        src: '',
        title: productName || `Item #${itemId}`,
        subtitle: `Pedido #${orderId}`,
        loading: true,
        error: ''
      };
    });

    try {
      const response = await fetch(`${apiBaseUrl}/orders/${orderId}/items/${itemId}/image`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (!response.ok) {
        const errorData = await parseApiResponse(response);
        throw new Error(errorData?.error || 'Nao foi possivel carregar a imagem deste item.');
      }

      const imageBlob = await response.blob();
      const imageObjectUrl = URL.createObjectURL(imageBlob);
      setOrderImageModal((current) => ({
        ...current,
        src: imageObjectUrl,
        loading: false,
        error: ''
      }));
    } catch (error) {
      const errorMessage = error.message || 'Nao foi possivel carregar a imagem deste item.';
      setOrderImageModal((current) => ({
        ...current,
        src: '',
        loading: false,
        error: errorMessage
      }));
      setPopup({
        type: 'warning',
        message: errorMessage
      });
    }
  }

  async function handleDeleteSelectedOrder() {
    if (!selectedOrder || !canDeleteOrder(currentUser, selectedOrder)) {
      return;
    }

    const shouldDelete = window.confirm(
      `Deseja excluir o pedido #${selectedOrder.id}? Essa acao nao pode ser desfeita.`
    );

    if (!shouldDelete) {
      return;
    }

    setIsDeletingSelectedOrder(true);
    setOrderActionMessage('');

    try {
      const response = await fetch(`${apiBaseUrl}/orders/${selectedOrder.id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Nao foi possivel excluir o pedido.');
      }

      closeOrderActions();
      await loadOrders(token, ordersFilters);
    } catch (error) {
      setOrderActionMessage(error.message);
    } finally {
      setIsDeletingSelectedOrder(false);
    }
  }

  async function handleReopenOrder(order) {
    if (!canReopenOrder(currentUser)) {
      return;
    }

    const reason = window.prompt(
      `Informe o motivo da reabertura do pedido #${order.id}:`
    );

    if (reason === null) {
      return;
    }

    const trimmedReason = reason.trim();

    if (!trimmedReason) {
      setPopup({
        type: 'warning',
        message: 'O motivo da reabertura e obrigatorio.'
      });
      return;
    }

    setReopeningOrderId(order.id);
    setOrderActionMessage('');

    try {
      const response = await fetch(`${apiBaseUrl}/orders/${order.id}/reopen`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          reason: trimmedReason
        })
      });

      const data = await parseApiResponse(response);

      if (!response.ok) {
        throw new Error(data.error || 'Nao foi possivel reabrir o pedido.');
      }

      setPopup({
        type: 'success',
        message: `Pedido #${order.id} reaberto com sucesso.`
      });

      await loadOrders(token, ordersFilters);
    } catch (error) {
      setPopup({
        type: 'error',
        message: error.message
      });
    } finally {
      setReopeningOrderId(null);
    }
  }

  function resetUserForm() {
    setFormMessage('');
    setUserForm(emptyUserForm);
  }

  if (isBootstrapping) {
    return (
      <div className="app-shell">
        <main className="page page--auth">
          <section className="panel panel--centered panel--auth">
            <div className="auth-brand">
              <img src={microgateLogo} alt="Microgate" className="auth-brand__logo" />
              <div>
                <p className="eyebrow">Sistema de Compras</p>
                <h1>Validando sessao...</h1>
              </div>
            </div>
          </section>
        </main>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="app-shell">
        <main className="page page--auth">
          <section className="panel panel--centered panel--auth-compact">
            <form className="auth-form auth-form--panel" onSubmit={handleLogin}>
              <div className="auth-brand auth-brand--stacked">
                <img src={microgateLogo} alt="Microgate" className="auth-brand__logo" />
                <h2>Sistema de Compras</h2>
                <p className="eyebrow">Entrar</p>
              </div>

              <label>
                <span>Usuario</span>
                <input
                  type="text"
                  value={loginForm.username}
                  onChange={(event) => updateLoginField('username', event.target.value)}
                  placeholder="Informe seu usuário"
                  autoComplete="username"
                />
              </label>

              <label>
                <span>Senha</span>
                <input
                  type="password"
                  value={loginForm.password}
                  onChange={(event) => updateLoginField('password', event.target.value)}
                  placeholder="Informe sua senha"
                  autoComplete="current-password"
                />
              </label>

              {loginError ? <p className="feedback feedback--error">{loginError}</p> : null}

              <button type="submit" className="button" disabled={isLoggingIn}>
                {isLoggingIn ? 'Entrando...' : 'Entrar'}
              </button>
            </form>
          </section>
        </main>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <header className="site-header">
        <div className="site-header__inner">
          <div className="site-brand">
            <img src={microgateLogo} alt="Microgate" className="site-brand__logo" />
            <div className="site-brand__copy">
              <p className="eyebrow">Sistema de Compras</p>
              <span>{currentUser.name}</span>
            </div>
          </div>

          <div className="site-header__actions">
            <nav className="tabbar">
              {!passwordChangeRequired ? (
                <>
                  <button
                    type="button"
                    className={`tab-button tab-button--green ${activeTab === 'request' ? 'tab-button--active' : ''}`}
                    onClick={() => changeTab('request')}
                  >
                    Novo pedido
                  </button>
                  <button
                    type="button"
                    className={`tab-button ${activeTab === 'panel' ? 'tab-button--active' : ''}`}
                    onClick={() => changeTab('panel')}
                  >
                    Painel de pedidos
                  </button>
                  <button
                    type="button"
                    className={`tab-button ${activeTab === 'history' ? 'tab-button--active' : ''}`}
                    onClick={() => changeTab('history')}
                  >
                    Histórico
                  </button>
                  {canManageUsers(currentUser) ? (
                    <button
                      type="button"
                      className={`tab-button ${activeTab === 'users' ? 'tab-button--active' : ''}`}
                      onClick={() => changeTab('users')}
                    >
                      Usuários
                    </button>
                  ) : null}
                </>
              ) : null}

              <button
                type="button"
                className={`tab-button ${activeTab === 'password' ? 'tab-button--active' : ''}`}
                onClick={() => changeTab('password')}
              >
                Alterar senha
              </button>
            </nav>

            <button type="button" className="button button--danger" onClick={handleLogout}>
              Sair
            </button>
          </div>
        </div>
      </header>

      <main className="page page--dashboard">
        {popup ? (
          <div
            className={`notification notification--${popup.type}`}
            role="status"
            aria-live="polite"
            aria-atomic="true"
          >
            <div className="notification__content">
              <p>{popup.message}</p>
            </div>
            <div className="notification__progress" aria-hidden="true"></div>
          </div>
        ) : null}

        {orderImageModal.isOpen ? (
          <div
            className="photo-modal"
            onClick={(event) => {
              if (event.target === event.currentTarget) {
                closeOrderImageModal();
              }
            }}
          >
            <div className="photo-modal__box">
              <div className="photo-modal__content">
                {orderImageModal.loading ? (
                  <p className="photo-modal__loading">Carregando imagem...</p>
                ) : null}

                {!orderImageModal.loading && orderImageModal.error ? (
                  <p className="photo-modal__error">{orderImageModal.error}</p>
                ) : null}

                {!orderImageModal.loading && !orderImageModal.error && orderImageModal.src ? (
                  <img src={orderImageModal.src} alt={orderImageModal.title || 'Imagem do item'} />
                ) : null}
              </div>

              <div className="photo-modal__footer">
                <div>
                  <p className="photo-modal__title">{orderImageModal.title || 'Imagem do item'}</p>
                  <p className="photo-modal__subtitle">{orderImageModal.subtitle}</p>
                </div>
                <button
                  type="button"
                  className="button button--ghost"
                  onClick={closeOrderImageModal}
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {activeTab === 'password' ? (
          <PasswordChangeContent
            currentUser={currentUser}
            passwordForm={passwordForm}
            passwordMessage={passwordMessage}
            passwordMessageType={passwordMessageType}
            isSavingPassword={isSavingPassword}
            onChangePasswordField={updatePasswordField}
            onSubmitPasswordChange={handlePasswordChangeSubmit}
          />
        ) : null}

        {activeTab === 'request' && !passwordChangeRequired ? (
          <section className="request-layout">
            <article className="panel">
              <div className="section-header section-header--page">
                <div>
                  <p className="eyebrow">Novo pedido</p>
                  <h1 className="page-title">Preencha os dados do pedido</h1>
                </div>
              </div>

              <form className="request-form" onSubmit={handleRequestSubmit}>
              <div className="form-grid form-grid--request-line">
                <label>
                  <span>Nome do pedido</span>
                  <input
                    type="text"
                    value={requestForm.requestName}
                    onChange={(event) => updateRequestField('requestName', event.target.value)}
                    placeholder="Ex.: Compra de insumos para bancada"
                  />
                </label>

                <label>
                  <span>Comprador</span>
                  <select
                    value={requestForm.buyerId || ''}
                    onChange={(event) => updateRequestField('buyerId', Number(event.target.value) || null)}
                  >
                    <option value="">Selecione</option>
                    {users
                      .filter((user) => normalizeRole(user.role) === 'comprador')
                      .map((user) => (
                        <option key={user.id} value={user.id}>
                          {user.name}
                        </option>
                      ))}
                  </select>
                </label>

                <label>
                  <span>urgência</span>
                  <select
                    value={requestForm.urgency}
                    onChange={(event) => updateRequestField('urgency', event.target.value)}
                  >
                    <option value="normal">Normal</option>
                    <option value="priority">Prioridade</option>
                  </select>
                </label>
                <label>
                  <span>OS relacionada</span>
                  <input
                    type="text"
                    value={requestForm.relatedOs}
                    onChange={(event) => {
                      const value = event.target.value.replace(/[^0-9]/g, '');
                      updateRequestField('relatedOs', value);
                    }}
                    placeholder="Numero da OS"
                  />
                </label>
              </div>

                <div className="items-header">
                  <div>
                    <p className="eyebrow">Itens</p>
                    <h2>Produtos do pedido</h2>
                  </div>

                  <button type="button" className="button button--ghost" onClick={addRequestItem}>
                    Adicionar item
                  </button>
                </div>

                <div className="items-list">
                  {requestForm.items.map((item, index) => (
                    <article key={index} className="item-card">
                      <div className="item-card__header">
                        <h3>Item {index + 1}</h3>
                        <button
                          type="button"
                          className="button button--ghost"
                          onClick={() => removeRequestItem(index)}
                        >
                          Remover
                        </button>
                      </div>

                    <div className="form-grid">
                      <label>
                        <span>Produto</span>
                        <input
                          type="text"
                          value={item.productName}
                          onChange={(event) =>
                            updateRequestItem(index, 'productName', event.target.value)
                          }
                          placeholder="Nome do produto"
                        />
                      </label>

                      <label>
                        <span>Link</span>
                        <input
                          type="url"
                          value={item.productLink}
                          onChange={(event) =>
                            updateRequestItem(index, 'productLink', event.target.value)
                          }
                          placeholder="https://"
                        />
                      </label>
                    </div>

                    <div className="form-grid form-grid--item-details">
                      <label>
                        <span>Obs</span>
                        <input
                          type="text"
                          value={item.notes}
                          onChange={(event) => updateRequestItem(index, 'notes', event.target.value)}
                          placeholder="Detalhes do item"
                        />
                      </label>

                      <label className="checkbox-field checkbox-field--inline-row">
                        <input
                          type="checkbox"
                          checked={Boolean(item.compraParaguai)}
                          onChange={(event) =>
                            updateRequestItem(index, 'compraParaguai', event.target.checked)
                          }
                        />
                        <span>Compra Paraguai</span>
                      </label>

                      <label>
                        <span>Qtd</span>
                        <input
                          type="text"
                          inputMode="numeric"
                          min="1"
                          max="9999"
                          value={item.quantity}
                          onChange={(event) => {
                            const value = event.target.value.replace(/[^0-9]/g, '');
                            updateRequestItem(index, 'quantity', value);
                          }}
                        />
                      </label>

                      <label>
                        <span>Valor do produto</span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.productValue}
                          onChange={(event) =>
                            updateRequestItem(index, 'productValue', event.target.value)
                          }
                          placeholder="0.00"
                        />
                      </label>

                      <label>
                        <span>Valor de venda</span>
                        <input type="text" value={item.saleValue} readOnly />
                      </label>
                    </div>

                    <div className="item-image-upload">
                      <label>
                        <span>Imagem do item (opcional)</span>
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/webp"
                          onChange={(event) =>
                            updateRequestItemImage(
                              index,
                              event.target.files && event.target.files[0]
                                ? event.target.files[0]
                                : null
                            )
                          }
                        />
                      </label>

                      {item.imagePreviewUrl ? (
                        <div className="item-image-preview">
                          <img src={item.imagePreviewUrl} alt={`Preview do item ${index + 1}`} />
                          <button
                            type="button"
                            className="button button--ghost"
                            onClick={() => updateRequestItemImage(index, null)}
                          >
                            Remover imagem
                          </button>
                        </div>
                      ) : null}
                    </div>
                    </article>
                  ))}
                </div>

                {requestMessage ? (
                  <p
                    className={`feedback ${
                      requestMessageType === 'error' ? 'feedback--error' : ''
                    }`}
                  >
                    {requestMessage}
                  </p>
                ) : null}

                <button type="submit" className="button button--green" disabled={isSubmittingRequest}>
                  {isSubmittingRequest ? 'Enviando...' : 'Enviar pedido'}
                </button>
              </form>
            </article>
          </section>
        ) : null}

        {activeTab === 'panel' && !passwordChangeRequired ? (
          <section className="request-layout">
            <article className="panel">
              {selectedOrder ? (
                <form className="order-actions" onSubmit={handleSaveSelectedOrder}>
                  <div className="section-header section-header--page">
                    <div>
                      <p className="eyebrow">Pedido #{selectedOrder.id}</p>
                      <h1 className="page-title">{selectedOrder.requestName}</h1>
                      <p className="description">
                        Acompanhe status, valores e Histórico deste pedido.
                      </p>
                    </div>

                    <aside className="order-actions-sidebar order-actions-sidebar--header">
                      <button
                        type="button"
                        className={`order-actions-nav-button ${
                          selectedOrderSection === 'order' ? 'order-actions-nav-button--active' : ''
                        }`}
                        onClick={() => setSelectedOrderSection('order')}
                      >
                        Pedido
                      </button>
                      <button
                        type="button"
                        className={`order-actions-nav-button ${
                          selectedOrderSection === 'comments' ? 'order-actions-nav-button--active' : ''
                        }`}
                        onClick={() => setSelectedOrderSection('comments')}
                      >
                        Comentarios
                      </button>
                      <button
                        type="button"
                        className={`order-actions-nav-button ${
                          selectedOrderSection === 'history' ? 'order-actions-nav-button--active' : ''
                        }`}
                        onClick={() => setSelectedOrderSection('history')}
                      >
                        Histórico
                      </button>
                    </aside>
                  </div>

                {selectedOrderError ? (
                  <p className="feedback feedback--error">{selectedOrderError}</p>
                ) : null}

                <div className="order-actions-layout">
                  <div className="order-actions-content">
                    <OrderDetailContent
                      currentSection={selectedOrderSection}
                      commentDraft={selectedOrderCommentDraft}
                      selectedOrder={selectedOrder}
                      selectedOrderCanEdit={selectedOrderCanEdit}
                      users={users}
                      openOrderItemImage={openOrderItemImage}
                      updateSelectedOrderCommentDraft={updateSelectedOrderCommentDraft}
                      updateSelectedOrderField={updateSelectedOrderField}
                      updateSelectedOrderItem={updateSelectedOrderItem}
                    />
                  </div>
                </div>

                {orderActionMessage ? <p className="feedback">{orderActionMessage}</p> : null}

                <div className="order-actions__top-buttons">
                  {selectedOrderCanEdit ? (
                    <button
                      type="submit"
                      className="button button--green"
                      disabled={isSavingSelectedOrder}
                    >
                      {isSavingSelectedOrder ? 'Salvando...' : 'Salvar alteracoes'}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="button button--ghost"
                    onClick={closeOrderActions}
                  >
                    Voltar
                  </button>
                  {selectedOrderCanDelete ? (
                    <button
                      type="button"
                      className="button button--danger"
                      onClick={handleDeleteSelectedOrder}
                      disabled={isDeletingSelectedOrder}
                    >
                      {isDeletingSelectedOrder ? 'Excluindo...' : 'Excluir'}
                    </button>
                  ) : null}
                </div>
                </form>
              ) : (
                <>
                  <div className="section-header section-header--page">
                    <div>
                      <p className="eyebrow">Painel de pedidos</p>
                      <h1 className="page-title">Lista de pedidos</h1>
                      <p className="description">
                        Consulte pedidos ativos, andamento de compras e movimentações recentes.
                      </p>
                    </div>
                  </div>

                <div className="panel-toolbar">
                  <label className="search-field">
                    <span>Filtrar por ID</span>
                    <input
                      type="text"
                      value={ordersFilters.id}
                      onChange={(event) => updateOrdersFilter('id', event.target.value)}
                      placeholder="Ex.: 12"
                    />
                  </label>

                  <label className="search-field">
                    <span>Filtrar por status</span>
                    <select
                      value={ordersFilters.status}
                      onChange={(event) => updateOrdersFilter('status', event.target.value)}
                    >
                      <option value="">Todos</option>
                      {availableStatusFilters.map((status) => (
                        <option key={status} value={status}>
                          {formatOrderStatus(status)}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="search-field">
                    <span>Filtrar por solicitante</span>
                    <select
                      value={ordersFilters.requesterId}
                      onChange={(event) => updateOrdersFilter('requesterId', event.target.value)}
                    >
                      <option value="">Todos</option>
                      {users.map((user) => (
                        <option key={user.id} value={user.id}>
                          {user.name} (@{user.username})
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                {isLoadingSelectedOrder ? <p>Carregando pedido...</p> : null}
                {isLoadingOrders ? <p>Carregando pedidos...</p> : null}
                {ordersError ? <p className="feedback feedback--error">{ordersError}</p> : null}

                {!isLoadingOrders && !ordersError ? (
                  <div className="orders-table">
                    <div className="orders-table__head">
                      <span>ID</span>
                      <span>Última atualização</span>
                      <span>Solicitante</span>
                      <span>Comprador</span>
                      <span>Descrição</span>
                      <span>Itens</span>
                      <span>urgência</span>
                      <span>Status</span>
                    </div>

                    <div className="orders-table__body">
                      {activeOrders.length === 0 ? (
                        <p className="empty-state">Nenhum pedido ativo encontrado.</p>
                      ) : (
                        activeOrders.map((order) => (
                          <article
                            key={order.id}
                            className="order-row order-row--clickable"
                            role="button"
                            tabIndex={0}
                            onClick={() => openOrderActions(order.id)}
                            onKeyDown={(event) => handleOrderRowKeyDown(event, order.id)}
                            aria-label={`Abrir pedido ${order.id}`}
                          >
                            <strong>#{order.id}</strong>
                            <span>{formatDateTime(order.updatedAt || order.createdAt)}</span>
                            <span>{order.requesterName || order.requesterUsername || '-'}</span>
                            <span>{order.buyerName || order.buyerUsername || '-'}</span>
                            <span>{order.requestName || '-'}</span>
                            <span>{order.itemsCount}</span>
                            <span
                              className={
                                order.urgency === 'priority' ? 'urgency-label urgency-label--priority' : 'urgency-label'
                              }
                            >
                              {order.urgency === 'priority' ? 'Prioridade' : 'Normal'}
                            </span>
                            <span className="status-chip">{formatOrderStatus(order.status)}</span>
                          </article>
                        ))
                      )}
                    </div>
                  </div>
                ) : null}
                </>
              )}
            </article>
          </section>
        ) : null}

        {activeTab === 'history' && !passwordChangeRequired ? (
          <section className="request-layout">
            <article className="panel">
              {selectedOrder ? (
                <form className="order-actions" onSubmit={handleSaveSelectedOrder}>
                  <div className="section-header section-header--page">
                    <div>
                      <p className="eyebrow">Histórico do pedido #{selectedOrder.id}</p>
                      <h1 className="page-title">{selectedOrder.requestName}</h1>
                      <p className="description">
                        Pedidos finalizados sao considerados encerrados e ficam arquivados aqui.
                      </p>
                    </div>

                    <aside className="order-actions-sidebar order-actions-sidebar--header">
                      <button
                        type="button"
                        className={`order-actions-nav-button ${
                          selectedOrderSection === 'order' ? 'order-actions-nav-button--active' : ''
                        }`}
                        onClick={() => setSelectedOrderSection('order')}
                      >
                        Pedido
                      </button>
                      <button
                        type="button"
                        className={`order-actions-nav-button ${
                          selectedOrderSection === 'comments' ? 'order-actions-nav-button--active' : ''
                        }`}
                        onClick={() => setSelectedOrderSection('comments')}
                      >
                        Comentarios
                      </button>
                      <button
                        type="button"
                        className={`order-actions-nav-button ${
                          selectedOrderSection === 'history' ? 'order-actions-nav-button--active' : ''
                        }`}
                        onClick={() => setSelectedOrderSection('history')}
                      >
                        Histórico
                      </button>
                    </aside>
                  </div>

                  {selectedOrderError ? (
                    <p className="feedback feedback--error">{selectedOrderError}</p>
                  ) : null}

                  <div className="order-actions-layout">
                    <div className="order-actions-content">
                      <OrderDetailContent
                        currentSection={selectedOrderSection}
                        commentDraft={selectedOrderCommentDraft}
                        selectedOrder={selectedOrder}
                        selectedOrderCanEdit={selectedOrderCanEdit}
                        users={users}
                        openOrderItemImage={openOrderItemImage}
                        updateSelectedOrderCommentDraft={updateSelectedOrderCommentDraft}
                        updateSelectedOrderField={updateSelectedOrderField}
                        updateSelectedOrderItem={updateSelectedOrderItem}
                      />
                    </div>
                  </div>

                  {orderActionMessage ? <p className="feedback">{orderActionMessage}</p> : null}

                  <div className="order-actions__top-buttons">
                    {selectedOrderCanEdit ? (
                      <button
                        type="submit"
                        className="button button--green"
                        disabled={isSavingSelectedOrder}
                      >
                        {isSavingSelectedOrder ? 'Salvando...' : 'Salvar alteracoes'}
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="button button--ghost"
                      onClick={closeOrderActions}
                    >
                      Voltar
                    </button>
                    {selectedOrderCanDelete ? (
                      <button
                        type="button"
                        className="button button--danger"
                        onClick={handleDeleteSelectedOrder}
                        disabled={isDeletingSelectedOrder}
                      >
                        {isDeletingSelectedOrder ? 'Excluindo...' : 'Excluir'}
                      </button>
                    ) : null}
                  </div>
                </form>
              ) : (
                <>
                  <div className="section-header section-header--page">
                    <div>
                      <p className="eyebrow">Histórico</p>
                      <h1 className="page-title">Pedidos finalizados</h1>
                      <p className="description">
                        Aqui ficam os pedidos finalizados, considerados concluidos.
                      </p>
                    </div>
                  </div>

                  <div className="panel-toolbar">
                    <label className="search-field">
                      <span>Filtrar por ID</span>
                      <input
                        type="text"
                        value={ordersFilters.id}
                        onChange={(event) => updateOrdersFilter('id', event.target.value)}
                        placeholder="Ex.: 12"
                      />
                    </label>

                    <label className="search-field">
                      <span>Filtrar por status</span>
                      <select
                        value={ordersFilters.status}
                        onChange={(event) => updateOrdersFilter('status', event.target.value)}
                      >
                        <option value="">Todos</option>
                        {historyFilterStatuses.map((status) => (
                          <option key={status} value={status}>
                            {formatOrderStatus(status)}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="search-field">
                      <span>Filtrar por solicitante</span>
                      <select
                        value={ordersFilters.requesterId}
                        onChange={(event) => updateOrdersFilter('requesterId', event.target.value)}
                      >
                        <option value="">Todos</option>
                        {users.map((user) => (
                          <option key={user.id} value={user.id}>
                            {user.name} (@{user.username})
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  {isLoadingSelectedOrder ? <p>Carregando pedido...</p> : null}
                  {isLoadingOrders ? <p>Carregando Histórico...</p> : null}
                  {ordersError ? <p className="feedback feedback--error">{ordersError}</p> : null}

                  {!isLoadingOrders && !ordersError ? (
                    <div className="orders-table">
                      <div className="orders-table__head">
                        <span>ID</span>
                        <span>Última atualização</span>
                        <span>Solicitante</span>
                        <span>Comprador</span>
                        <span>Descrição</span>
                        <span>Itens</span>
                        <span>urgência</span>
                        <span>Status</span>
                        <span>Acao</span>
                      </div>

                      <div className="orders-table__body">
                        {historicalOrders.length === 0 ? (
                          <p className="empty-state">Nenhum pedido finalizado encontrado.</p>
                        ) : (
                          historicalOrders.map((order) => (
                            <article
                              key={order.id}
                              className="order-row order-row--clickable"
                              role="button"
                              tabIndex={0}
                              onClick={() => openOrderActions(order.id)}
                              onKeyDown={(event) => handleOrderRowKeyDown(event, order.id)}
                              aria-label={`Abrir pedido ${order.id}`}
                            >
                              <strong>#{order.id}</strong>
                              <span>{formatDateTime(order.updatedAt || order.createdAt)}</span>
                              <span>{order.requesterName || order.requesterUsername || '-'}</span>
                              <span>{order.buyerName || order.buyerUsername || '-'}</span>
                              <span>{order.requestName || '-'}</span>
                              <span>{order.itemsCount}</span>
                              <span
                                className={
                                  order.urgency === 'priority' ? 'urgency-label urgency-label--priority' : 'urgency-label'
                                }
                              >
                                {order.urgency === 'priority' ? 'Prioridade' : 'Normal'}
                              </span>
                              <span className="status-chip">{formatOrderStatus(order.status)}</span>
                              <span>
                                {userCanReopenOrder ? (
                                  <button
                                    type="button"
                                    className="button button--ghost"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      handleReopenOrder(order);
                                    }}
                                    disabled={reopeningOrderId === order.id}
                                  >
                                    {reopeningOrderId === order.id ? 'Reabrindo...' : 'Reabrir'}
                                  </button>
                                ) : (
                                  '-'
                                )}
                              </span>
                            </article>
                          ))
                        )}
                      </div>
                    </div>
                  ) : null}
                </>
              )}
            </article>
          </section>
        ) : null}

        {activeTab === 'users' && canManageUsers(currentUser) && !passwordChangeRequired ? (
          <section className="dashboard-grid">
            <article className="panel">
              <div className="section-header section-header--page">
                <div>
                  <p className="eyebrow">Gerenciamento</p>
                  <h1 className="page-title">Usuários</h1>
                </div>

                <button type="button" className="button button--ghost" onClick={resetUserForm}>
                  Novo Usuário
                </button>
              </div>

              <form className="user-form" onSubmit={handleUserSubmit}>
              <label>
                <span>Nome</span>
                <input
                  type="text"
                  value={userForm.name}
                  onChange={(event) => updateUserField('name', event.target.value)}
                  placeholder="Nome completo"
                />
              </label>

              <label>
                <span>Usuario</span>
                <input
                  type="text"
                  value={userForm.username}
                  onChange={(event) => updateUserField('username', event.target.value)}
                  placeholder="nome.de.acesso"
                />
              </label>

              <label>
                <span>Senha {userForm.id ? '(preencha apenas para trocar)' : ''}</span>
                <input
                  type="password"
                  value={userForm.password}
                  onChange={(event) => updateUserField('password', event.target.value)}
                  placeholder={userForm.id ? 'Nova senha opcional' : 'Senha inicial'}
                />
              </label>

              <label>
                <span>E-mail</span>
                <input
                  type="email"
                  value={userForm.email}
                  onChange={(event) => updateUserField('email', event.target.value)}
                  placeholder="usuario@example.com"
                />
              </label>

              <label>
                <span>Perfil</span>
                <select
                  value={userForm.role}
                  onChange={(event) => updateUserField('role', event.target.value)}
                >
                  <option value="administrador">Administrador</option>
                  <option value="comprador">Comprador</option>
                  <option value="solicitante">Solicitante</option>
                </select>
              </label>

              {formMessage ? <p className="feedback">{formMessage}</p> : null}

              <button type="submit" className="button" disabled={isSavingUser}>
                {isSavingUser
                  ? 'Salvando...'
                  : userForm.id
                    ? 'Atualizar usuario'
                    : 'Criar usuário'}
              </button>
              </form>
            </article>

            <article className="panel">
              <div className="section-header">
                <div>
                  <p className="eyebrow">Base atual</p>
                  <h2>Lista de Usuários</h2>
                </div>
              </div>

            {isLoadingUsers ? <p>Carregando Usuários...</p> : null}
            {usersError ? <p className="feedback feedback--error">{usersError}</p> : null}

            {!isLoadingUsers && !usersError ? (
              <div className="users-list">
                {users.map((user) => (
                  <article key={user.id} className="user-card">
                    <div>
                      <h3>{user.name}</h3>
                      <p>@{user.username}</p>
                      <span className="pill">{formatRoleLabel(user.role)}</span>
                    </div>

                    <div className="user-card__actions">
                      <button
                        type="button"
                        className="button button--ghost"
                        onClick={() => handleEditUser(user)}
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        className="button button--danger"
                        onClick={() => handleDeleteUser(user.id)}
                        disabled={currentUser.id === user.id}
                      >
                        Excluir
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            ) : null}
            </article>
          </section>
        ) : null}
      </main>
    </div>
  );
}

export default App;
