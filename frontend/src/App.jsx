import { useEffect, useState } from 'react';

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || '/api';
const tokenStorageKey = 'compras-auth-token';

const emptyUserForm = {
  id: null,
  name: '',
  username: '',
  password: '',
  role: 'user'
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

function formatCurrencyValue(value) {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return '0.00';
  }

  return numericValue.toFixed(2);
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
  const [users, setUsers] = useState([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [usersError, setUsersError] = useState('');
  const [userForm, setUserForm] = useState(emptyUserForm);
  const [isSavingUser, setIsSavingUser] = useState(false);
  const [formMessage, setFormMessage] = useState('');

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
    if (currentUser?.role === 'admin') {
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
        throw new Error('Nao foi possivel carregar os usuarios.');
      }

      const data = await response.json();
      setUsers(data.users);
    } catch (error) {
      setUsersError(error.message);
    } finally {
      setIsLoadingUsers(false);
    }
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
      'Existem alteracoes nao salvas nesta solicitacao. Deseja sair mesmo assim?'
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
      return;
    }

    if (!confirmDiscardUnsavedRequest()) {
      return;
    }

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
        throw new Error(data.error || 'Nao foi possivel enviar a solicitacao.');
      }

      setRequestForm(createEmptyRequestForm());
      setRequestMessageType('success');
      setRequestMessage('Solicitacao enviada com sucesso.');
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

  function resetUserForm() {
    setFormMessage('');
    setUserForm(emptyUserForm);
  }

  if (isBootstrapping) {
    return (
      <main className="page">
        <section className="panel panel--centered">
          <p className="eyebrow">Sistema de Compras</p>
          <h1>Validando sessao...</h1>
        </section>
      </main>
    );
  }

  if (!currentUser) {
    return (
      <main className="page">
        <section className="panel intro">
          <div>
            <p className="eyebrow">Sistema de Compras</p>
            <h1>Acesso administrativo</h1>
            <p className="description">
              Entre com seu usuario para acessar o painel e gerenciar contas.
            </p>
          </div>

          <form className="auth-form" onSubmit={handleLogin}>
            <label>
              <span>Usuario</span>
              <input
                type="text"
                value={loginForm.username}
                onChange={(event) => updateLoginField('username', event.target.value)}
                placeholder="admin"
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

            <p className="hint">
              Usuario inicial: <strong>admin</strong>
            </p>
          </form>
        </section>
      </main>
    );
  }

  return (
    <main className="page page--dashboard">
      <section className="panel topbar">
        <div>
          <p className="eyebrow">Sistema de Compras</p>
          <h1>Painel de solicitacoes</h1>
          <p className="description">
            Bem-vindo, <strong>{currentUser.name}</strong>. Perfil atual:{' '}
            <strong>{currentUser.role}</strong>.
          </p>
        </div>

        <button type="button" className="button button--ghost" onClick={handleLogout}>
          Sair
        </button>
      </section>

      <section className="panel tabbar">
        <button
          type="button"
          className={`tab-button ${activeTab === 'request' ? 'tab-button--active' : ''}`}
          onClick={() => changeTab('request')}
        >
          Nova solicitacao
        </button>
        {currentUser.role === 'admin' ? (
          <button
            type="button"
            className={`tab-button ${activeTab === 'users' ? 'tab-button--active' : ''}`}
            onClick={() => changeTab('users')}
          >
            Usuarios
          </button>
        ) : null}
      </section>

      {activeTab === 'request' ? (
        <section className="request-layout">
          <article className="panel">
            <div className="section-header">
              <div>
                <p className="eyebrow">Nova solicitacao</p>
                <h2>Preencha os dados do pedido</h2>
              </div>
            </div>

            <form className="request-form" onSubmit={handleRequestSubmit}>
              <div className="form-grid">
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
                  <span>Urgencia</span>
                  <select
                    value={requestForm.urgency}
                    onChange={(event) => updateRequestField('urgency', event.target.value)}
                  >
                    <option value="normal">Normal</option>
                      <option value="priority">Prioridade</option>
                  </select>
                </label>

              </div>

              <div className="form-grid form-grid--os">

                <label>
                  <span>OS relacionada</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={requestForm.relatedOs}
                    onChange={(event) =>
                      updateRequestField(
                        'relatedOs',
                        event.target.value.replace(/\D+/g, '')
                      )
                    }
                    placeholder="Somente numeros"
                    disabled={requestForm.withoutOs}
                  />
                </label>

                <label className="checkbox-field">
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
                  <h2>Produtos da solicitacao</h2>
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

                    <label>
                      <span>Obs</span>
                      <input
                        type="text"
                        value={item.notes}
                        onChange={(event) => updateRequestItem(index, 'notes', event.target.value)}
                        placeholder="Detalhes do item"
                      />
                    </label>

                    <div className="form-grid form-grid--values">
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

              <button type="submit" className="button" disabled={isSubmittingRequest}>
                {isSubmittingRequest ? 'Enviando...' : 'Enviar solicitacao'}
              </button>
            </form>
          </article>
        </section>
      ) : null}

      {activeTab === 'users' && currentUser.role === 'admin' ? (
        <section className="dashboard-grid">
          <article className="panel">
            <div className="section-header">
              <div>
                <p className="eyebrow">Gerenciamento</p>
                <h2>Usuarios</h2>
              </div>

              <button type="button" className="button button--ghost" onClick={resetUserForm}>
                Novo usuario
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
                  <option value="user">Usuario</option>
                  <option value="admin">Administrador</option>
                </select>
              </label>

              {formMessage ? <p className="feedback">{formMessage}</p> : null}

              <button type="submit" className="button" disabled={isSavingUser}>
                {isSavingUser
                  ? 'Salvando...'
                  : userForm.id
                    ? 'Atualizar usuario'
                    : 'Criar usuario'}
              </button>
            </form>
          </article>

          <article className="panel">
            <div className="section-header">
              <div>
                <p className="eyebrow">Base atual</p>
                <h2>Lista de usuarios</h2>
              </div>
            </div>

            {isLoadingUsers ? <p>Carregando usuarios...</p> : null}
            {usersError ? <p className="feedback feedback--error">{usersError}</p> : null}

            {!isLoadingUsers && !usersError ? (
              <div className="users-list">
                {users.map((user) => (
                  <article key={user.id} className="user-card">
                    <div>
                      <h3>{user.name}</h3>
                      <p>@{user.username}</p>
                      <span className="pill">{user.role}</span>
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
  );
}

export default App;
