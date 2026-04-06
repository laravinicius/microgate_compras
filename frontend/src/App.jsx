import { useEffect, useState } from 'react';
import microgateLogo from './assets/microgate2.png';

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || '/api';
const tokenStorageKey = 'compras-auth-token';
const orderStatuses = [
  'pendente',
  'comprado',
  'aguardando entrega',
  'entregue',
  'cancelado'
];
const panelFilterStatuses = ['pendente', 'comprado', 'aguardando entrega'];
const historyFilterStatuses = ['entregue', 'cancelado'];

const orderStatusLabels = {
  pending: 'pendente',
  purchased: 'comprado',
  waiting_delivery: 'aguardando entrega',
  delivered: 'entregue',
  cancelled: 'cancelado',
  pendente: 'pendente',
  comprado: 'comprado',
  'aguardando entrega': 'aguardando entrega',
  entregue: 'entregue',
  cancelado: 'cancelado'
};

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
  role: 'solicitante'
};

const createEmptyRequestItem = () => ({
  productName: '',
  productLink: '',
  notes: '',
  quantity: 1,
  productValue: '',
  saleValue: '0.00'
});

const createEmptyRequestForm = () => ({
  requestName: '',
  urgency: 'normal',
  relatedOs: '',
  withoutOs: false,
  items: [createEmptyRequestItem()]
});

const isFinishedStatus = (status) =>
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

function formatDateTime(value) {
  if (!value) {
    return '-';
  }

  return new Date(value).toLocaleString('pt-BR');
}

function normalizeDateInputValue(value) {
  if (!value) {
    return '';
  }

  return String(value).slice(0, 10);
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

function canEditOrder(user, order) {
  if (!user || !order) {
    return false;
  }

  return (
    isAdministrator(user) ||
    isBuyer(user) ||
    (isRequester(user) && Number(order.userId) === Number(user.id))
  );
}

function canDeleteOrder(user) {
  return isAdministrator(user);
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
  updateSelectedOrderCommentDraft,
  updateSelectedOrderField,
  updateSelectedOrderItem
}) {
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
            <span>Data da Solicitação</span>
            <input type="text" value={formatDateTime(selectedOrder.createdAt)} readOnly />
          </label>

          <label>
            <span>OS</span>
            <input
              type="text"
              value={selectedOrder.withoutOs ? 'Sem OS' : selectedOrder.relatedOs || '-'}
              readOnly
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
            <span>Previsão de entrega</span>
            <input
              type="date"
              value={normalizeDateInputValue(selectedOrder.estimatedDelivery)}
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
            <span>Detalhes</span>
            <span>Obs</span>
            <span>Valor do produto</span>
            <span>Valor da venda</span>
            <span>Valor repassado</span>
          </div>

          <div className="order-items-table__body">
            {selectedOrder.items.map((item) => (
              <article key={item.id} className="order-item-row">
                <strong>{item.productName}</strong>
                <span>{item.quantity}</span>
                <button
                  type="button"
                  className="button button--ghost"
                  onClick={() => window.open(item.productLink, '_blank', 'noopener,noreferrer')}
                  disabled={!item.productLink}
                >
                  Abrir link
                </button>
                <span>{item.notes || '-'}</span>
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
  const [selectedOrderSection, setSelectedOrderSection] = useState('order');
  const [selectedOrderCommentDraft, setSelectedOrderCommentDraft] = useState('');
  const [users, setUsers] = useState([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [usersError, setUsersError] = useState('');
  const [userForm, setUserForm] = useState(emptyUserForm);
  const [isSavingUser, setIsSavingUser] = useState(false);
  const [formMessage, setFormMessage] = useState('');
  const [popup, setPopup] = useState(null);

  const activeOrders = orders.filter((order) => !isFinishedStatus(order.status));
  const historicalOrders = orders.filter((order) => isFinishedStatus(order.status));
  const selectedOrderCanEdit = canEditOrder(currentUser, selectedOrder);
  const selectedOrderCanDelete = canDeleteOrder(currentUser);
  const availableStatusFilters =
    activeTab === 'history' ? historyFilterStatuses : panelFilterStatuses;

  useEffect(() => {
    if (!popup) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      setPopup(null);
    }, 5000);

    return () => window.clearTimeout(timeoutId);
  }, [popup]);

  const hasUnsavedRequestChanges =
    Boolean(requestForm.requestName.trim()) ||
    (!requestForm.withoutOs && Boolean(requestForm.relatedOs.trim())) ||
    requestForm.items.some(
      (item) =>
        item.productName.trim() ||
        item.productLink.trim() ||
        item.notes.trim() ||
        String(item.quantity) !== '1' ||
        String(item.productValue).trim()
    );

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
    if (!currentUser) {
      setOrders([]);
      return;
    }

    loadOrders(token, ordersFilters);
  }, [currentUser, token, ordersFilters]);

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
    if (currentUser) {
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
        throw new Error('Nao foi possivel carregar as Requisições.');
      }

      const data = await response.json();
      setOrders(data.orders);
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

      setSelectedOrder({
        ...data.order,
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
    setSelectedOrder((current) => ({
      ...current,
      [field]: value
    }));
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

        if (field === 'productValue') {
          updatedItem.saleValue = Number(formatCurrencyValue(Number(value || 0) * 1.7));
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
  }

  function confirmDiscardUnsavedRequest() {
    if (!hasUnsavedRequestChanges) {
      return true;
    }

    return window.confirm(
      'Existem alteracoes nao salvas nesta Solicitação. Deseja sair mesmo assim?'
    );
  }

  function updateLoginField(field, value) {
    setLoginForm((current) => ({
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

        if (field === 'productValue') {
          updatedItem.saleValue = formatCurrencyValue(Number(value || 0) * 1.7);
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
        return {
          ...current,
          items: [createEmptyRequestItem()]
        };
      }

      return {
        ...current,
        items: current.items.filter((_, itemIndex) => itemIndex !== index)
      };
    });
  }

  function changeTab(nextTab) {
    if (nextTab === activeTab) {
      closeOrderActions();
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
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Falha ao autenticar.');
      }

      localStorage.setItem(tokenStorageKey, data.token);
      setToken(data.token);
      setCurrentUser(data.user);
      setActiveTab('request');
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
    setRequestForm(createEmptyRequestForm());
    setRequestMessage('');
  }

  async function handleRequestSubmit(event) {
    event.preventDefault();
    setIsSubmittingRequest(true);
    setRequestMessage('');

    try {
      const response = await fetch(`${apiBaseUrl}/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          requestName: requestForm.requestName,
          urgency: requestForm.urgency,
          relatedOs: requestForm.relatedOs,
          withoutOs: requestForm.withoutOs,
          items: requestForm.items.map((item) => ({
            productName: item.productName,
            productLink: item.productLink,
            notes: item.notes,
            quantity: Number(item.quantity),
            productValue: Number(item.productValue || 0)
          }))
        })
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Nao foi possivel enviar a Solicitação.');
      }

      setRequestForm(createEmptyRequestForm());
      setRequestMessageType('success');
      setRequestMessage('Solicitação enviada com sucesso.');
      setPopup({
        type: 'success',
        message: 'Solicitação enviada com sucesso.'
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
          status: selectedOrder.status,
          estimatedDelivery: selectedOrder.estimatedDelivery || '',
          comments: commentToSave,
          items: selectedOrder.items.map((item) => ({
            id: item.id,
            productValue: Number(item.productValue || 0),
            passedValue: Number(item.passedValue || 0)
          }))
        })
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Nao foi possivel salvar o pedido.');
      }

      setSelectedOrder({
        ...data.order,
        comments: commentToSave,
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

  async function handleDeleteSelectedOrder() {
    if (!selectedOrder || !canDeleteOrder(currentUser)) {
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
              <button
                type="button"
                className={`tab-button tab-button--green ${activeTab === 'request' ? 'tab-button--active' : ''}`}
                onClick={() => changeTab('request')}
              >
                Nova Solicitação
              </button>
              <button
                type="button"
                className={`tab-button ${activeTab === 'panel' ? 'tab-button--active' : ''}`}
                onClick={() => changeTab('panel')}
              >
                Painel de compras
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
            </nav>

            <button type="button" className="button button--danger" onClick={handleLogout}>
              Sair
            </button>
          </div>
        </div>
      </header>

      <main className="page page--dashboard">
        {popup ? (
          <div className="popup-overlay" role="status" aria-live="polite" aria-atomic="true">
            <div className={`popup popup--${popup.type}`}>
              <p>{popup.message}</p>
              <button type="button" className="button button--ghost" onClick={() => setPopup(null)}>
                OK
              </button>
            </div>
          </div>
        ) : null}

        {activeTab === 'request' ? (
          <section className="request-layout">
            <article className="panel">
              <div className="section-header section-header--page">
                <div>
                  <p className="eyebrow">Nova Solicitação</p>
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
                    inputMode="numeric"
                    maxLength={5}
                    value={requestForm.relatedOs}
                    onChange={(event) =>
                      updateRequestField(
                        'relatedOs',
                        event.target.value.replace(/\D+/g, '').slice(0, 5)
                      )
                    }
                    placeholder="Numero da OS"
                    disabled={requestForm.withoutOs}
                  />
                </label>

                <label className="checkbox-field checkbox-field--inline-row">
                  <input
                    type="checkbox"
                    checked={requestForm.withoutOs}
                    onChange={(event) =>
                      setRequestForm((current) => ({
                        ...current,
                        withoutOs: event.target.checked,
                        relatedOs: event.target.checked ? '' : current.relatedOs
                      }))
                    }
                  />
                  <span>Sem OS</span>
                </label>
              </div>

                <div className="items-header">
                  <div>
                    <p className="eyebrow">Itens</p>
                    <h2>Produtos da Solicitação</h2>
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

                      <label>
                        <span>Qtd</span>
                        <input
                          type="number"
                          min="1"
                          step="1"
                          value={item.quantity}
                          onChange={(event) =>
                            updateRequestItem(index, 'quantity', event.target.value)
                          }
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
                  {isSubmittingRequest ? 'Enviando...' : 'Enviar Solicitação'}
                </button>
              </form>
            </article>
          </section>
        ) : null}

        {activeTab === 'panel' ? (
          <section className="request-layout">
            <article className="panel">
              {selectedOrder ? (
                <form className="order-actions" onSubmit={handleSaveSelectedOrder}>
                  <div className="section-header section-header--page">
                    <div>
                      <p className="eyebrow">Pedido #{selectedOrder.id}</p>
                      <h1 className="page-title">{selectedOrder.requestName}</h1>
                      <p className="description">
                        Acompanhe status, valores e Histórico desta Solicitação.
                      </p>
                    </div>

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
                  </div>

                {selectedOrderError ? (
                  <p className="feedback feedback--error">{selectedOrderError}</p>
                ) : null}

                <div className="order-actions-layout">
                  <aside className="order-actions-sidebar">
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

                  <div className="order-actions-content">
                    <OrderDetailContent
                      currentSection={selectedOrderSection}
                      commentDraft={selectedOrderCommentDraft}
                      selectedOrder={selectedOrder}
                      selectedOrderCanEdit={selectedOrderCanEdit}
                      updateSelectedOrderCommentDraft={updateSelectedOrderCommentDraft}
                      updateSelectedOrderField={updateSelectedOrderField}
                      updateSelectedOrderItem={updateSelectedOrderItem}
                    />
                  </div>
                </div>

                {orderActionMessage ? <p className="feedback">{orderActionMessage}</p> : null}
                </form>
              ) : (
                <>
                  <div className="section-header section-header--page">
                    <div>
                      <p className="eyebrow">Painel de compras</p>
                      <h1 className="page-title">Lista das Requisições</h1>
                      <p className="description">
                        Consulte pedidos ativos, andamento de compras e movimentacoes recentes.
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
                {isLoadingOrders ? <p>Carregando Requisições...</p> : null}
                {ordersError ? <p className="feedback feedback--error">{ordersError}</p> : null}

                {!isLoadingOrders && !ordersError ? (
                  <div className="orders-table">
                    <div className="orders-table__head">
                      <span>ID</span>
                      <span>Última atualização</span>
                      <span>Solicitante</span>
                      <span>Descrição</span>
                      <span>Itens</span>
                      <span>urgência</span>
                      <span>Status</span>
                      <span>Ações</span>
                    </div>

                    <div className="orders-table__body">
                      {activeOrders.length === 0 ? (
                        <p className="empty-state">Nenhuma requisicao ativa encontrada.</p>
                      ) : (
                        activeOrders.map((order) => (
                          <article key={order.id} className="order-row">
                            <strong>#{order.id}</strong>
                            <span>{formatDateTime(order.updatedAt || order.createdAt)}</span>
                            <span>{order.requesterName || order.requesterUsername || '-'}</span>
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
                            <button
                              type="button"
                              className="button button--blue"
                              onClick={() => openOrderActions(order.id)}
                            >
                              Ações
                            </button>
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

        {activeTab === 'history' ? (
          <section className="request-layout">
            <article className="panel">
              {selectedOrder ? (
                <form className="order-actions" onSubmit={handleSaveSelectedOrder}>
                  <div className="section-header section-header--page">
                    <div>
                      <p className="eyebrow">Histórico do pedido #{selectedOrder.id}</p>
                      <h1 className="page-title">{selectedOrder.requestName}</h1>
                      <p className="description">
                        Requisições entregues sao consideradas finalizadas e ficam arquivadas aqui.
                      </p>
                    </div>

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
                  </div>

                  {selectedOrderError ? (
                    <p className="feedback feedback--error">{selectedOrderError}</p>
                  ) : null}

                  <div className="order-actions-layout">
                    <aside className="order-actions-sidebar">
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

                    <div className="order-actions-content">
                      <OrderDetailContent
                        currentSection={selectedOrderSection}
                        commentDraft={selectedOrderCommentDraft}
                        selectedOrder={selectedOrder}
                        selectedOrderCanEdit={selectedOrderCanEdit}
                        updateSelectedOrderCommentDraft={updateSelectedOrderCommentDraft}
                        updateSelectedOrderField={updateSelectedOrderField}
                        updateSelectedOrderItem={updateSelectedOrderItem}
                      />
                    </div>
                  </div>

                  {orderActionMessage ? <p className="feedback">{orderActionMessage}</p> : null}
                </form>
              ) : (
                <>
                  <div className="section-header section-header--page">
                    <div>
                      <p className="eyebrow">Histórico</p>
                      <h1 className="page-title">Requisições finalizadas</h1>
                      <p className="description">
                        Aqui ficam os pedidos entregues, considerados concluidos.
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
                        <span>Descrição</span>
                        <span>Itens</span>
                        <span>urgência</span>
                        <span>Status</span>
                        <span>Ações</span>
                      </div>

                      <div className="orders-table__body">
                        {historicalOrders.length === 0 ? (
                          <p className="empty-state">Nenhuma requisicao finalizada encontrada.</p>
                        ) : (
                          historicalOrders.map((order) => (
                            <article key={order.id} className="order-row">
                              <strong>#{order.id}</strong>
                              <span>{formatDateTime(order.updatedAt || order.createdAt)}</span>
                              <span>{order.requesterName || order.requesterUsername || '-'}</span>
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
                              <button
                                type="button"
                                className="button button--blue"
                                onClick={() => openOrderActions(order.id)}
                              >
                                Ações
                              </button>
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

        {activeTab === 'users' && canManageUsers(currentUser) ? (
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
