/**
 * script.js - Capa 3: Presentación
 * Interfaz Gráfica para Evidenciar el Consumo de la API REST de Productos
 */

const API_BASE_URL = 'http://localhost:5050/api/v1';

// Estado global de la vista
const state = {
  page: 1,
  limit: 12,
  search: '',
  totalPages: 1,
  totalItems: 0,
  rawApiResponse: null,
};

// Referencias al DOM
const elements = {
  apiStatusPill: document.getElementById('apiStatusPill'),
  apiStatusText: document.getElementById('apiStatusText'),
  metricEndpoint: document.getElementById('metricEndpoint'),
  metricStatus: document.getElementById('metricStatus'),
  metricTime: document.getElementById('metricTime'),
  metricTotal: document.getElementById('metricTotal'),
  searchInput: document.getElementById('searchInput'),
  clearSearchBtn: document.getElementById('clearSearchBtn'),
  limitSelect: document.getElementById('limitSelect'),
  productsGrid: document.getElementById('productsGrid'),
  paginationControls: document.getElementById('paginationControls'),
  btnViewCards: document.getElementById('btnViewCards'),
  btnViewJson: document.getElementById('btnViewJson'),
  cardsViewSection: document.getElementById('cardsViewSection'),
  jsonViewSection: document.getElementById('jsonViewSection'),
  jsonCodeOutput: document.getElementById('jsonCodeOutput'),
  btnCopyJson: document.getElementById('btnCopyJson'),
  btnOpenCreate: document.getElementById('btnOpenCreate'),
  createModal: document.getElementById('createModal'),
  createProductForm: document.getElementById('createProductForm'),
  toast: document.getElementById('toast'),
};

// Utilidad simple de escape HTML (Anti-XSS)
const escapeHTML = (str) => {
  if (typeof str !== 'string') return str;
  return str.replace(/[&<>'"]/g, (tag) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;',
  }[tag] || tag));
};

// Notificación Toast flotante
function notify(msg) {
  elements.toast.textContent = msg;
  elements.toast.classList.add('show');
  setTimeout(() => elements.toast.classList.remove('show'), 3500);
}

// 1. COMPROBACIÓN DE SALUD DE LA API (GET /health)
async function verifyApiHealth() {
  try {
    const res = await fetch(`${API_BASE_URL}/health`);
    if (res.ok) {
      elements.apiStatusPill.className = 'status-pill online';
      elements.apiStatusText.textContent = 'API Online (Puerto 5050)';
    } else {
      throw new Error();
    }
  } catch {
    elements.apiStatusPill.className = 'status-pill offline';
    elements.apiStatusText.textContent = 'API Offline (Verifica backend)';
  }
}

// 2. OBTENER PRODUCTOS (GET /api/v1/productos)
async function fetchProducts() {
  const queryParams = new URLSearchParams({
    page: state.page,
    limit: state.limit,
  });
  if (state.search.trim()) {
    queryParams.append('search', state.search.trim());
  }

  const endpointText = `GET /api/v1/productos?${queryParams.toString()}`;
  elements.metricEndpoint.textContent = endpointText;
  elements.productsGrid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 3rem;">Consultando la API y PostgreSQL...</div>';

  const startTime = performance.now();

  try {
    const response = await fetch(`${API_BASE_URL}/productos?${queryParams.toString()}`);
    const duration = Math.round(performance.now() - startTime);
    const data = await response.json();

    state.rawApiResponse = data;

    // Actualizar métricas del monitor
    elements.metricStatus.textContent = `${response.status} ${response.statusText || 'OK'}`;
    elements.metricStatus.className = 'metric-value badge-status success';
    elements.metricTime.textContent = `${duration} ms`;

    if (data.success && data.data) {
      state.totalItems = data.pagination.totalItems;
      state.totalPages = data.pagination.totalPages;
      elements.metricTotal.textContent = `${state.totalItems.toLocaleString()} productos`;

      renderGrid(data.data);
      renderPagination(data.pagination);
      renderRawJson(data);
    } else {
      throw new Error(data.error?.message || 'Error en la respuesta de la API');
    }
  } catch (err) {
    const duration = Math.round(performance.now() - startTime);
    elements.metricStatus.textContent = 'ERROR';
    elements.metricStatus.className = 'metric-value badge-status error';
    elements.metricTime.textContent = `${duration} ms`;

    elements.productsGrid.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; padding: 3rem; color: var(--danger);">
        <i class="bi bi-exclamation-octagon" style="font-size: 2.5rem;"></i>
        <h3 style="margin-top: 0.5rem;">No se pudo consultar la API de productos</h3>
        <p style="color: var(--text-muted);">${escapeHTML(err.message)}</p>
      </div>
    `;
  }
}

// 3. RENDERIZAR REJILLA DE TARJETAS
function renderGrid(products) {
  if (products.length === 0) {
    elements.productsGrid.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; padding: 4rem 1rem;">
        <i class="bi bi-search" style="font-size: 2.5rem; color: var(--text-muted);"></i>
        <p style="margin-top: 0.75rem; color: var(--text-muted);">No se encontraron productos que coincidan con la búsqueda.</p>
      </div>
    `;
    return;
  }

  elements.productsGrid.innerHTML = products.map((item) => `
    <article class="product-item">
      <div class="item-thumb">
        <span class="item-badge-id">ID: #${item.id}</span>
        <span class="item-badge-stock">Stock: ${item.stock}</span>
        <img 
          src="${escapeHTML(item.urlimagen)}" 
          alt="${escapeHTML(item.nombre)}"
          loading="lazy"
          onerror="this.src='https://images.unsplash.com/photo-1581783342308-f792dbdd27c5?w=500&q=80'"
        >
      </div>
      <div class="item-body">
        <h3 class="item-title">${escapeHTML(item.nombre)}</h3>
        <p class="item-desc">${escapeHTML(item.descripcion)}</p>
        <div class="item-footer">
          <span class="item-pvp">$${Number(item.pvp).toFixed(2)}</span>
          <button class="btn-delete-card" onclick="deleteProduct(${item.id})" title="Probar DELETE /api/v1/productos/${item.id}">
            <i class="bi bi-trash-fill"></i> DELETE
          </button>
        </div>
      </div>
    </article>
  `).join('');
}

// 4. RENDERIZAR PAGINACIÓN
function renderPagination({ currentPage, totalPages }) {
  if (totalPages <= 1) {
    elements.paginationControls.innerHTML = '';
    return;
  }

  // Ajuste según el ancho de la ventana
  const isSmallScreen = window.innerWidth < 640;
  const delta = isSmallScreen ? 1 : 2;

  let start = Math.max(1, currentPage - delta);
  let end = Math.min(totalPages, currentPage + delta);

  let html = `
    <button class="p-btn" ${currentPage === 1 ? 'disabled' : ''} onclick="changePage(1)" title="Primera página">
      <i class="bi bi-chevron-double-left"></i>
    </button>
    <button class="p-btn" ${currentPage === 1 ? 'disabled' : ''} onclick="changePage(${currentPage - 1})" title="Página anterior">
      <i class="bi bi-chevron-left"></i>
    </button>
  `;

  for (let i = start; i <= end; i++) {
    html += `
      <button class="p-btn ${i === currentPage ? 'active' : ''}" onclick="changePage(${i})">
        ${i}
      </button>
    `;
  }

  html += `
    <button class="p-btn" ${currentPage === totalPages ? 'disabled' : ''} onclick="changePage(${currentPage + 1})" title="Página siguiente">
      <i class="bi bi-chevron-right"></i>
    </button>
    <button class="p-btn" ${currentPage === totalPages ? 'disabled' : ''} onclick="changePage(${totalPages})" title="Última página (${totalPages})">
      <i class="bi bi-chevron-double-right"></i>
    </button>
  `;

  elements.paginationControls.innerHTML = html;
}

// 5. RENDERIZAR INSPECTOR JSON
function renderRawJson(data) {
  elements.jsonCodeOutput.textContent = JSON.stringify(data, null, 2);
}

// Cambiar de página
window.changePage = (p) => {
  state.page = p;
  fetchProducts();
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

// 6. PROBAR ELIMINAR (DELETE /api/v1/productos/:id)
window.deleteProduct = async (id) => {
  if (!confirm(`¿Deseas probar la acción DELETE en el backend para el producto ID #${id}?`)) return;

  const endpointText = `DELETE /api/v1/productos/${id}`;
  elements.metricEndpoint.textContent = endpointText;

  const startTime = performance.now();
  try {
    const res = await fetch(`${API_BASE_URL}/productos/${id}`, { method: 'DELETE' });
    const duration = Math.round(performance.now() - startTime);

    elements.metricStatus.textContent = `${res.status} No Content`;
    elements.metricStatus.className = 'metric-value badge-status success';
    elements.metricTime.textContent = `${duration} ms`;

    notify(`✅ Producto #${id} eliminado con éxito (HTTP 204 No Content).`);
    fetchProducts();
  } catch (err) {
    notify(`❌ Error al eliminar producto #${id}`);
  }
};

// 7. PROBAR CREAR (POST /api/v1/productos)
elements.createProductForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const newProduct = {
    nombre: document.getElementById('newNombre').value.trim(),
    descripcion: document.getElementById('newDescripcion').value.trim(),
    pvp: parseFloat(document.getElementById('newPvp').value),
    stock: parseInt(document.getElementById('newStock').value, 10),
    urlimagen: document.getElementById('newImagen').value.trim(),
  };

  const endpointText = `POST /api/v1/productos`;
  elements.metricEndpoint.textContent = endpointText;

  const startTime = performance.now();

  try {
    const res = await fetch(`${API_BASE_URL}/productos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newProduct),
    });

    const duration = Math.round(performance.now() - startTime);
    const data = await res.json();

    elements.metricStatus.textContent = `${res.status} Created`;
    elements.metricStatus.className = 'metric-value badge-status success';
    elements.metricTime.textContent = `${duration} ms`;

    if (res.ok) {
      notify(`🎉 Producto creado con éxito con nuevo ID: #${data.data.id} (HTTP 201 Created)`);
      elements.createModal.close();
      elements.createProductForm.reset();
      state.page = 1;
      fetchProducts();
    } else {
      throw new Error(data.error?.message || 'Error de validación al crear');
    }
  } catch (err) {
    notify(`❌ ${err.message}`);
  }
});

// 8. EVENTOS DE CONTROL (BÚSQUEDA Y LÍMITE)
let searchTimer = null;
elements.searchInput.addEventListener('input', (e) => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    state.search = e.target.value.trim();
    state.page = 1;
    elements.clearSearchBtn.hidden = state.search === '';
    fetchProducts();
  }, 350);
});

elements.clearSearchBtn.addEventListener('click', () => {
  elements.searchInput.value = '';
  state.search = '';
  elements.clearSearchBtn.hidden = true;
  state.page = 1;
  fetchProducts();
});

elements.limitSelect.addEventListener('change', (e) => {
  state.limit = parseInt(e.target.value, 10);
  state.page = 1;
  fetchProducts();
});

// Pestañas: Alternar Vista Gráfica vs Vista JSON Crudo
elements.btnViewCards.addEventListener('click', () => {
  elements.btnViewCards.classList.add('active');
  elements.btnViewJson.classList.remove('active');
  elements.cardsViewSection.hidden = false;
  elements.jsonViewSection.hidden = true;
});

elements.btnViewJson.addEventListener('click', () => {
  elements.btnViewJson.classList.add('active');
  elements.btnViewCards.classList.remove('active');
  elements.cardsViewSection.hidden = true;
  elements.jsonViewSection.hidden = false;
});

// Copiar JSON
elements.btnCopyJson.addEventListener('click', () => {
  if (state.rawApiResponse) {
    navigator.clipboard.writeText(JSON.stringify(state.rawApiResponse, null, 2));
    notify('📋 JSON copiado al portapapeles');
  }
});

// Modal Crear
elements.btnOpenCreate.addEventListener('click', () => {
  elements.createModal.showModal();
});

// Ajuste al tamaño de ventana (Resize)
window.addEventListener('resize', () => {
  renderPagination({
    currentPage: state.page,
    totalPages: state.totalPages,
  });
});

// 9. INICIALIZACIÓN
document.addEventListener('DOMContentLoaded', () => {
  verifyApiHealth();
  fetchProducts();
});
