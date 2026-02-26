const BASE = "/api";

const req = async (method, path, body) => {
  // Inclui o token JWT em todas as requisições automaticamente
  const token = localStorage.getItem('orcapro_token')
  const headers = { "Content-Type": "application/json" }
  if (token) headers["Authorization"] = `Bearer ${token}`

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  // Token expirado — força logout redirecionando para o login
  if (res.status === 401) {
    localStorage.removeItem('orcapro_token')
    localStorage.removeItem('orcapro_usuario')
    window.location.href = '/login'
    return
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Erro ${res.status}`);
  }
  return res.json();
};

export const api = {
  auth: {
    login:          (d)       => req("POST",  "/auth/login", d),
    me:             ()        => req("GET",   "/auth/me"),
    // Gerenciamento de usuários (admin)
    listarUsuarios: ()        => req("GET",   "/auth/usuarios"),
    criarUsuario:   (d)       => req("POST",  "/auth/usuarios", d),
    atualizarUsuario:(id, d)  => req("PUT",   `/auth/usuarios/${id}`, d),
    excluirUsuario: (id)      => req("DELETE",`/auth/usuarios/${id}`),
  },
  clientes: {
    list:   ()        => req("GET",    "/clientes"),
    get:    (id)      => req("GET",    `/clientes/${id}`),
    create: (d)       => req("POST",   "/clientes", d),
    update: (id, d)   => req("PUT",    `/clientes/${id}`, d),
    delete: (id)      => req("DELETE", `/clientes/${id}`),
  },
  propostas: {
    list:   ()        => req("GET",    "/propostas"),
    get:    (id)      => req("GET",    `/propostas/${id}`),
    create: (d)       => req("POST",   "/propostas", d),
    update: (id, d)   => req("PUT",    `/propostas/${id}`, d),
    delete: (id)      => req("DELETE", `/propostas/${id}`),
  },
  romaneios: {
    list:   ()        => req("GET",    "/romaneios"),
    get:    (id)      => req("GET",    `/romaneios/${id}`),
    create: (d)       => req("POST",   "/romaneios", d),
    update: (id, d)   => req("PUT",    `/romaneios/${id}`, d),
    delete: (id)      => req("DELETE", `/romaneios/${id}`),
  },
};
