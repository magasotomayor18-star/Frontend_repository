import assert from 'node:assert/strict';
import test from 'node:test';

const apiBaseUrl = process.env.API_BASE_URL || 'http://127.0.0.1:5050/api/v1';
const jsonHeaders = { 'Content-Type': 'application/json' };

test('versioned products API supports health, validation, pagination, and CRUD', async () => {
  const healthResponse = await fetch(`${apiBaseUrl}/health`);
  assert.equal(healthResponse.status, 200);
  assert.equal((await healthResponse.json()).success, true);

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
