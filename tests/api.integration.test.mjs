import assert from 'node:assert/strict';
import test from 'node:test';

const apiBaseUrl = process.env.API_BASE_URL || 'http://127.0.0.1:5050/api/v1';
const jsonHeaders = { 'Content-Type': 'application/json' };

test('versioned products API supports health, validation, pagination, and CRUD', async () => {
  const allowedOrigin = 'https://frontend.example.test';
  const healthResponse = await fetch(`${apiBaseUrl}/health`, {
    headers: { Origin: allowedOrigin },
  });
  assert.equal(healthResponse.status, 200);
  assert.equal((await healthResponse.json()).success, true);
  assert.equal(healthResponse.headers.get('x-api-version'), 'v1');
  assert.equal(healthResponse.headers.get('access-control-allow-origin'), allowedOrigin);
  assert.equal(healthResponse.headers.get('access-control-allow-credentials'), 'true');

  const preflightResponse = await fetch(`${apiBaseUrl}/productos`, {
    method: 'OPTIONS',
    headers: {
      Origin: allowedOrigin,
      'Access-Control-Request-Method': 'POST',
      'Access-Control-Request-Headers': 'content-type',
    },
  });
  assert.equal(preflightResponse.status, 204);
  assert.match(preflightResponse.headers.get('access-control-allow-methods'), /\bPOST\b/);

  const blockedOriginResponse = await fetch(`${apiBaseUrl}/health`, {
    headers: { Origin: 'https://untrusted.example.test' },
  });
  assert.equal(blockedOriginResponse.status, 403);

  const malformedJsonResponse = await fetch(`${apiBaseUrl}/productos`, {
    method: 'POST',
    headers: jsonHeaders,
    body: '{"nombre":',
  });
  assert.equal(malformedJsonResponse.status, 400);
  assert.equal((await malformedJsonResponse.json()).error.code, 'INVALID_JSON_PAYLOAD');

  const oversizedJsonResponse = await fetch(`${apiBaseUrl}/productos`, {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify({ nombre: 'x'.repeat(51 * 1024) }),
  });
  assert.equal(oversizedJsonResponse.status, 413);

  const listResponse = await fetch(`${apiBaseUrl}/productos?page=1&limit=2`);
  assert.equal(listResponse.status, 200);
  const list = await listResponse.json();
  assert.equal(list.success, true);
  assert.ok(Array.isArray(list.data));
  assert.equal(list.pagination.currentPage, 1);
  assert.equal(list.pagination.itemsPerPage, 2);

  const invalidCreateResponse = await fetch(`${apiBaseUrl}/productos`, {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify({}),
  });
  assert.equal(invalidCreateResponse.status, 422);
  assert.equal((await invalidCreateResponse.json()).error.code, 'VALIDATION_FAILED');

  const suffix = Date.now();
  const product = {
    nombre: `CI API ${suffix}`,
    descripcion: `Producto temporal de integración ${suffix}`,
    urlimagen: 'https://example.com/ci-product.png',
    pvp: 12.34,
    stock: 5,
  };
  const createResponse = await fetch(`${apiBaseUrl}/productos`, {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify(product),
  });
  assert.equal(createResponse.status, 201);
  const created = (await createResponse.json()).data;
  assert.ok(Number.isSafeInteger(created.id) && created.id > 0);
  assert.equal(created.nombre, product.nombre);

  const invalidIdResponse = await fetch(`${apiBaseUrl}/productos/not-an-id`);
  assert.equal(invalidIdResponse.status, 400);

  const getResponse = await fetch(`${apiBaseUrl}/productos/${created.id}`);
  assert.equal(getResponse.status, 200);
  assert.equal((await getResponse.json()).data.id, created.id);

  const searchResponse = await fetch(
    `${apiBaseUrl}/productos?search=${encodeURIComponent(product.nombre)}`
  );
  assert.equal(searchResponse.status, 200);
  assert.ok((await searchResponse.json()).data.some((item) => item.id === created.id));

  const patchResponse = await fetch(`${apiBaseUrl}/productos/${created.id}`, {
    method: 'PATCH',
    headers: jsonHeaders,
    body: JSON.stringify({ stock: 7 }),
  });
  assert.equal(patchResponse.status, 200);
  assert.equal((await patchResponse.json()).data.stock, 7);

  const replacement = {
    ...product,
    nombre: `CI API actualizado ${suffix}`,
    pvp: 15.5,
    stock: 9,
  };
  const putResponse = await fetch(`${apiBaseUrl}/productos/${created.id}`, {
    method: 'PUT',
    headers: jsonHeaders,
    body: JSON.stringify(replacement),
  });
  assert.equal(putResponse.status, 200);
  assert.equal((await putResponse.json()).data.nombre, replacement.nombre);

  const deleteResponse = await fetch(`${apiBaseUrl}/productos/${created.id}`, {
    method: 'DELETE',
  });
  assert.equal(deleteResponse.status, 204);

  const deletedResponse = await fetch(`${apiBaseUrl}/productos/${created.id}`);
  assert.equal(deletedResponse.status, 404);
});
