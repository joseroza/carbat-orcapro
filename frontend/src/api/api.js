const BASE = "/api";

const req = async (method, path, body) => {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Erro ${res.status}`);
  }
  return res.json();
};

export const api = {
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
