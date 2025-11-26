// Main application logic
const kanbanDB = new KanbanDB();
let columns = [];
let draggedCard = null;
let draggedColumn = null;

// Touch drag support
let touchStartTime = 0;
let touchStartX = 0;
let touchStartY = 0;
let longPressTimer = null;
let isDraggingTouch = false;
let touchDragElement = null;

// Initialize the app
async function init() {
    await kanbanDB.init();
    await loadBoard();
    setupEventListeners();
}

// Setup event listeners
function setupEventListeners() {
    document.getElementById('addColumnBtn').addEventListener('click', showAddColumnModal);
    
    // View toggle buttons
    const horizontalViewBtn = document.getElementById('horizontalViewBtn');
    const stackedViewBtn = document.getElementById('stackedViewBtn');
    const board = document.getElementById('board');
    
    horizontalViewBtn.addEventListener('click', () => {
        board.classList.remove('stacked');
        horizontalViewBtn.classList.add('active');
        stackedViewBtn.classList.remove('active');
        localStorage.setItem('boardView', 'horizontal');
        loadBoard(); // Reload to update menus
    });
    
    stackedViewBtn.addEventListener('click', () => {
        board.classList.add('stacked');
        stackedViewBtn.classList.add('active');
        horizontalViewBtn.classList.remove('active');
        localStorage.setItem('boardView', 'stacked');
        loadBoard(); // Reload to update menus
    });
    
    // Restore saved view preference
    const savedView = localStorage.getItem('boardView');
    if (savedView === 'stacked') {
        board.classList.add('stacked');
        stackedViewBtn.classList.add('active');
        horizontalViewBtn.classList.remove('active');
    }
    
    // Close menus when clicking outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.menu-container')) {
            document.querySelectorAll('.dropdown-menu.active').forEach(menu => {
                menu.classList.remove('active');
            });
        }
    });
}

// Load the entire board
async function loadBoard() {
    columns = await kanbanDB.getAllColumns();
    
    // If no columns exist, create default ones
    if (columns.length === 0) {
        await createDefaultColumns();
        columns = await kanbanDB.getAllColumns();
    }
    
    renderBoard();
}

// Create default columns
async function createDefaultColumns() {
    const defaultColumns = [
        { title: 'To Do', order: 0 },
        { title: 'In Progress', order: 1 },
        { title: 'Done', order: 2 }
    ];
    
    for (const col of defaultColumns) {
        await kanbanDB.addColumn(col);
    }
}

// Render the board
async function renderBoard() {
    const board = document.getElementById('board');
    board.innerHTML = '';
    
    for (const column of columns) {
        const cards = await kanbanDB.getCardsByColumn(column.id);
        const columnEl = createColumnElement(column, cards);
        board.appendChild(columnEl);
    }
}

// Create a column element
function createColumnElement(column, cards) {
    const columnEl = document.createElement('div');
    columnEl.className = 'column';
    columnEl.dataset.columnId = column.id;
    columnEl.draggable = true;
    
    // Check if we're in stacked mode
    const isStacked = document.getElementById('board').classList.contains('stacked');
    
    // Build menu items
    let menuItems = `<button class="menu-item rename-column" data-column-id="${column.id}">✏️ Rename</button>`;
    
    // Add move up/down buttons in stacked mode
    if (isStacked) {
        menuItems += `
            <button class="menu-item move-column-up" data-column-id="${column.id}">⬆️ Move Up</button>
            <button class="menu-item move-column-down" data-column-id="${column.id}">⬇️ Move Down</button>
        `;
    }
    
    menuItems += `<button class="menu-item danger delete-column" data-column-id="${column.id}">🗑️ Delete</button>`;
    
    columnEl.innerHTML = `
        <div class="column-header">
            <div class="column-title" data-column-id="${column.id}">${escapeHtml(column.title)}</div>
            <div class="column-actions">
                <div class="menu-container">
                    <button class="menu-btn column-menu-btn" data-column-id="${column.id}" title="Column menu">⋯</button>
                    <div class="dropdown-menu">
                        ${menuItems}
                    </div>
                </div>
            </div>
        </div>
        <div class="cards" data-column-id="${column.id}"></div>
        <button class="add-card-btn" data-column-id="${column.id}">+ Add Card</button>
    `;
    
    // Add cards
    const cardsContainer = columnEl.querySelector('.cards');
    cards.forEach(card => {
        const cardEl = createCardElement(card);
        cardsContainer.appendChild(cardEl);
    });
    
    // Column title double-click to edit
    const titleEl = columnEl.querySelector('.column-title');
    titleEl.addEventListener('dblclick', () => editColumnTitle(column.id, titleEl));
    
    // Column menu toggle
    const menuBtn = columnEl.querySelector('.column-menu-btn');
    const menu = columnEl.querySelector('.dropdown-menu');
    menuBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        // Close other menus
        document.querySelectorAll('.dropdown-menu.active').forEach(m => {
            if (m !== menu) m.classList.remove('active');
        });
        menu.classList.toggle('active');
    });
    
    // Rename column menu item
    const renameBtn = columnEl.querySelector('.rename-column');
    renameBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        menu.classList.remove('active');
        editColumnTitle(column.id, titleEl);
    });
    
    // Move up/down buttons in stacked mode
    if (isStacked) {
        const moveUpBtn = columnEl.querySelector('.move-column-up');
        const moveDownBtn = columnEl.querySelector('.move-column-down');
        
        if (moveUpBtn) {
            moveUpBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                menu.classList.remove('active');
                await moveColumn(column.id, 'up');
            });
        }
        
        if (moveDownBtn) {
            moveDownBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                menu.classList.remove('active');
                await moveColumn(column.id, 'down');
            });
        }
    }
    
    // Delete column menu item
    const deleteBtn = columnEl.querySelector('.delete-column');
    deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        menu.classList.remove('active');
        deleteColumn(column.id);
    });
    
    // Add card button
    const addCardBtn = columnEl.querySelector('.add-card-btn');
    addCardBtn.addEventListener('click', () => showAddCardModal(column.id));
    
    // Setup drag and drop for cards container
    setupDropZone(cardsContainer, column.id);
    
    // Setup drag and drop for columns
    setupColumnDragDrop(columnEl, column.id);
    
    return columnEl;
}

// Create a card element
function createCardElement(card) {
    const cardEl = document.createElement('div');
    cardEl.className = 'card';
    cardEl.draggable = true;
    cardEl.dataset.cardId = card.id;
    cardEl.dataset.columnId = card.columnId;
    
    let cardHTML = `<div class="card-title">${escapeHtml(card.title)}</div>`;
    if (card.link) {
        cardHTML += `<a href="${escapeHtml(card.link)}" class="card-link" target="_blank" rel="noopener noreferrer">${escapeHtml(card.link)}</a>`;
    }
    cardHTML += `
        <div class="card-actions">
            <div class="menu-container">
                <button class="menu-btn card-menu-btn" data-card-id="${card.id}" title="Card menu">⋯</button>
                <div class="dropdown-menu">
                    <button class="menu-item edit-card" data-card-id="${card.id}">✏️ Edit</button>
                    <button class="menu-item move-card" data-card-id="${card.id}">➡️ Move</button>
                    <button class="menu-item danger delete-card" data-card-id="${card.id}">🗑️ Delete</button>
                </div>
            </div>
        </div>
    `;
    
    cardEl.innerHTML = cardHTML;
    
    // Double-click to edit
    cardEl.addEventListener('dblclick', (e) => {
        if (!e.target.closest('.menu-container') && !e.target.classList.contains('card-link')) {
            editCard(card);
        }
    });
    
    // Card menu toggle
    const menuBtn = cardEl.querySelector('.card-menu-btn');
    const menu = cardEl.querySelector('.dropdown-menu');
    menuBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        // Close other menus
        document.querySelectorAll('.dropdown-menu.active').forEach(m => {
            if (m !== menu) m.classList.remove('active');
        });
        menu.classList.toggle('active');
    });
    
    // Edit card menu item
    const editBtn = cardEl.querySelector('.edit-card');
    editBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        menu.classList.remove('active');
        editCard(card);
    });
    
    // Move card menu item
    const moveBtn = cardEl.querySelector('.move-card');
    moveBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        menu.classList.remove('active');
        showMoveCardModal(card);
    });
    
    // Delete card menu item
    const deleteBtn = cardEl.querySelector('.delete-card');
    deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        menu.classList.remove('active');
        deleteCard(card.id);
    });
    
    // Drag events
    cardEl.addEventListener('dragstart', handleDragStart);
    cardEl.addEventListener('dragend', handleDragEnd);
    
    // Touch events for mobile drag and drop
    cardEl.addEventListener('touchstart', handleTouchStart, { passive: false });
    cardEl.addEventListener('touchmove', handleTouchMove, { passive: false });
    cardEl.addEventListener('touchend', handleTouchEnd);
    
    return cardEl;
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Drag and drop handlers
function handleDragStart(e) {
    const cardId = parseInt(e.target.dataset.cardId);
    const columnId = parseInt(e.target.dataset.columnId);
    
    if (isNaN(cardId) || isNaN(columnId)) {
        return;
    }
    
    draggedCard = {
        id: cardId,
        columnId: columnId
    };
    e.target.classList.add('dragging');
}

function handleDragEnd(e) {
    e.target.classList.remove('dragging');
    draggedCard = null;
}

function setupDropZone(cardsContainer, columnId) {
    cardsContainer.addEventListener('dragover', (e) => {
        e.preventDefault();
        const afterElement = getDragAfterElement(cardsContainer, e.clientY);
        const dragging = document.querySelector('.dragging');
        
        if (afterElement == null) {
            cardsContainer.appendChild(dragging);
        } else {
            cardsContainer.insertBefore(dragging, afterElement);
        }
    });
    
    cardsContainer.addEventListener('drop', async (e) => {
        e.preventDefault();
        if (draggedCard) {
            await moveCard(draggedCard.id, columnId, cardsContainer);
        }
    });
}

function getDragAfterElement(container, y) {
    const draggableElements = [...container.querySelectorAll('.card:not(.dragging)')];
    
    return draggableElements.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;
        
        if (offset < 0 && offset > closest.offset) {
            return { offset: offset, element: child };
        } else {
            return closest;
        }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
}

// Move card to new column or position
async function moveCard(cardId, newColumnId, cardsContainer) {
    if (!draggedCard) {
        return;
    }
    
    const oldColumnId = draggedCard.columnId;
    
    const cards = await kanbanDB.getCardsByColumn(oldColumnId);
    const card = cards.find(c => c.id === cardId);
    
    if (!card) {
        return;
    }
    
    // Update column if changed
    card.columnId = newColumnId;
    
    // Update order based on position in DOM
    const cardElements = [...cardsContainer.querySelectorAll('.card')];
    const newOrder = cardElements.findIndex(el => parseInt(el.dataset.cardId) === cardId);
    card.order = newOrder >= 0 ? newOrder : 0;
    
    await kanbanDB.updateCard(card);
    
    // Reorder other cards in the new column
    // Note: This performs individual updates which is acceptable for typical Kanban boards.
    // For boards with hundreds of cards per column, consider implementing batch updates.
    const columnCards = await kanbanDB.getCardsByColumn(newColumnId);
    for (let i = 0; i < columnCards.length; i++) {
        const c = columnCards[i];
        if (c.id !== cardId && c.order !== i) {
            c.order = i;
            await kanbanDB.updateCard(c);
        }
    }
    
    await loadBoard();
}

// Column drag and drop
function setupColumnDragDrop(columnEl, columnId) {
    columnEl.addEventListener('dragstart', (e) => {
        // Only drag if not dragging from a card
        if (e.target.classList.contains('column')) {
            draggedColumn = columnId;
            columnEl.classList.add('dragging');
            e.dataTransfer.effectAllowed = 'move';
        }
    });
    
    columnEl.addEventListener('dragend', async (e) => {
        if (e.target.classList.contains('column')) {
            columnEl.classList.remove('dragging');
            if (draggedColumn !== null) {
                await reorderColumns();
            }
            draggedColumn = null;
        }
    });
    
    columnEl.addEventListener('dragover', (e) => {
        if (draggedColumn !== null && draggedColumn !== columnId) {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            
            const board = document.getElementById('board');
            const draggingColumn = document.querySelector('.column.dragging');
            
            if (!draggingColumn) return;
            
            const afterElement = getColumnDragAfterElement(board, e.clientX);
            
            if (afterElement == null) {
                board.appendChild(draggingColumn);
            } else {
                board.insertBefore(draggingColumn, afterElement);
            }
        }
    });
    
    columnEl.addEventListener('drop', (e) => {
        if (draggedColumn !== null) {
            e.preventDefault();
            // reorderColumns() is called in dragend to avoid duplicate calls
        }
    });
    
    // Touch events for mobile drag and drop
    columnEl.addEventListener('touchstart', handleTouchStart, { passive: false });
    columnEl.addEventListener('touchmove', handleTouchMove, { passive: false });
    columnEl.addEventListener('touchend', handleTouchEnd);
}

function getColumnDragAfterElement(container, x) {
    const draggableElements = [...container.querySelectorAll('.column:not(.dragging)')];
    
    return draggableElements.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = x - box.left - box.width / 2;
        
        if (offset < 0 && offset > closest.offset) {
            return { offset: offset, element: child };
        } else {
            return closest;
        }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
}

async function reorderColumns() {
    const board = document.getElementById('board');
    const columnElements = [...board.querySelectorAll('.column')];
    
    // Update order for all columns based on DOM position
    for (let i = 0; i < columnElements.length; i++) {
        const columnId = parseInt(columnElements[i].dataset.columnId);
        const column = columns.find(c => c.id === columnId);
        if (column) {
            column.order = i;
            await kanbanDB.updateColumn(column);
        }
    }
    
    await loadBoard();
}

// Move column up or down (for stacked mode)
async function moveColumn(columnId, direction) {
    const columnIndex = columns.findIndex(c => c.id === columnId);
    if (columnIndex === -1) return;
    
    let targetIndex;
    if (direction === 'up') {
        if (columnIndex === 0) return; // Already at top
        targetIndex = columnIndex - 1;
    } else { // down
        if (columnIndex === columns.length - 1) return; // Already at bottom
        targetIndex = columnIndex + 1;
    }
    
    // Swap orders
    const tempOrder = columns[columnIndex].order;
    columns[columnIndex].order = columns[targetIndex].order;
    columns[targetIndex].order = tempOrder;
    
    await kanbanDB.updateColumn(columns[columnIndex]);
    await kanbanDB.updateColumn(columns[targetIndex]);
    
    await loadBoard();
}

// Touch event handlers for drag and drop support
function handleTouchStart(e) {
    const target = e.currentTarget;
    touchStartTime = Date.now();
    const touch = e.touches[0];
    touchStartX = touch.clientX;
    touchStartY = touch.clientY;
    
    // Start long press timer (500ms)
    longPressTimer = setTimeout(() => {
        isDraggingTouch = true;
        touchDragElement = target;
        
        // Determine if it's a card or column
        if (target.classList.contains('card')) {
            const cardId = parseInt(target.dataset.cardId);
            const columnId = parseInt(target.dataset.columnId);
            
            if (!isNaN(cardId) && !isNaN(columnId)) {
                draggedCard = { id: cardId, columnId: columnId };
                target.classList.add('dragging');
                // Provide haptic feedback if available
                if (navigator.vibrate) {
                    navigator.vibrate(50);
                }
            }
        } else if (target.classList.contains('column')) {
            const columnId = parseInt(target.dataset.columnId);
            if (!isNaN(columnId)) {
                draggedColumn = columnId;
                target.classList.add('dragging');
                // Provide haptic feedback if available
                if (navigator.vibrate) {
                    navigator.vibrate(50);
                }
            }
        }
    }, 500);
}

function handleTouchMove(e) {
    if (!isDraggingTouch) {
        // Cancel long press if moved too much before timer expires
        const touch = e.touches[0];
        const deltaX = Math.abs(touch.clientX - touchStartX);
        const deltaY = Math.abs(touch.clientY - touchStartY);
        
        if (deltaX > 10 || deltaY > 10) {
            clearTimeout(longPressTimer);
        }
        return;
    }
    
    e.preventDefault();
    const touch = e.touches[0];
    
    if (touchDragElement && touchDragElement.classList.contains('card')) {
        // Handle card drag
        const cardsContainer = document.elementFromPoint(touch.clientX, touch.clientY);
        if (cardsContainer && cardsContainer.classList.contains('cards')) {
            const afterElement = getDragAfterElement(cardsContainer, touch.clientY);
            
            if (afterElement == null) {
                cardsContainer.appendChild(touchDragElement);
            } else {
                cardsContainer.insertBefore(touchDragElement, afterElement);
            }
        }
    } else if (touchDragElement && touchDragElement.classList.contains('column')) {
        // Handle column drag
        const board = document.getElementById('board');
        const afterElement = getColumnDragAfterElement(board, touch.clientX);
        
        if (afterElement == null) {
            board.appendChild(touchDragElement);
        } else {
            board.insertBefore(touchDragElement, afterElement);
        }
    }
}

async function handleTouchEnd(e) {
    clearTimeout(longPressTimer);
    
    if (isDraggingTouch && touchDragElement) {
        if (touchDragElement.classList.contains('card') && draggedCard) {
            // Handle card drop
            const cardsContainer = touchDragElement.closest('.cards');
            if (cardsContainer) {
                const newColumnId = parseInt(cardsContainer.dataset.columnId);
                if (!isNaN(newColumnId)) {
                    await moveCard(draggedCard.id, newColumnId, cardsContainer);
                }
            }
        } else if (touchDragElement.classList.contains('column') && draggedColumn !== null) {
            // Handle column drop
            await reorderColumns();
        }
        
        touchDragElement.classList.remove('dragging');
    }
    
    // Reset touch drag state
    isDraggingTouch = false;
    touchDragElement = null;
    draggedCard = null;
    draggedColumn = null;
    touchStartTime = 0;
}

// Edit column title inline
function editColumnTitle(columnId, titleElement) {
    const currentTitle = titleElement.textContent;
    const input = document.createElement('input');
    input.type = 'text';
    input.value = currentTitle;
    input.className = 'editable-input';
    
    titleElement.replaceWith(input);
    input.focus();
    input.select();
    
    const saveEdit = async () => {
        const newTitle = input.value.trim();
        if (newTitle && newTitle !== currentTitle) {
            const column = columns.find(c => c.id === columnId);
            column.title = newTitle;
            await kanbanDB.updateColumn(column);
            await loadBoard();
        } else {
            await loadBoard();
        }
    };
    
    input.addEventListener('blur', saveEdit);
    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            saveEdit();
        }
    });
}

// Show add column modal
function showAddColumnModal() {
    const modal = createModal('Add Column', [
        { label: 'Column Title', name: 'title', type: 'text', required: true }
    ], async (formData) => {
        const column = {
            title: formData.title,
            order: columns.length
        };
        await kanbanDB.addColumn(column);
        await loadBoard();
    });
    
    document.body.appendChild(modal);
}

// Show add card modal
function showAddCardModal(columnId) {
    const modal = createModal('Add Card', [
        { label: 'Card Title', name: 'title', type: 'text', required: true },
        { label: 'Link (optional)', name: 'link', type: 'url', required: false }
    ], async (formData) => {
        const cards = await kanbanDB.getCardsByColumn(columnId);
        const card = {
            title: formData.title,
            link: formData.link || '',
            columnId: columnId,
            order: cards.length
        };
        await kanbanDB.addCard(card);
        await loadBoard();
    });
    
    document.body.appendChild(modal);
    
    // Focus on title field after modal is rendered
    setTimeout(() => {
        const titleInput = modal.querySelector('input[name="title"]');
        if (titleInput) {
            titleInput.focus();
        }
    }, 10);
}

// Edit card
function editCard(card) {
    const modal = createModal('Edit Card', [
        { label: 'Card Title', name: 'title', type: 'text', required: true, value: card.title },
        { label: 'Link (optional)', name: 'link', type: 'url', required: false, value: card.link }
    ], async (formData) => {
        card.title = formData.title;
        card.link = formData.link || '';
        await kanbanDB.updateCard(card);
        await loadBoard();
    });
    
    document.body.appendChild(modal);
    
    // Focus on title field and select all text after modal is rendered
    setTimeout(() => {
        const titleInput = modal.querySelector('input[name="title"]');
        if (titleInput) {
            titleInput.focus();
            titleInput.select();
        }
    }, 10);
}

// Show move card modal
async function showMoveCardModal(card) {
    // Get all columns for the dropdown
    const allColumns = await kanbanDB.getAllColumns();
    const currentColumn = allColumns.find(col => col.id === card.columnId);
    
    const modal = document.createElement('div');
    modal.className = 'modal active';
    
    let columnOptions = '';
    allColumns.forEach(col => {
        const selected = col.id === card.columnId ? 'selected' : '';
        columnOptions += `<option value="${col.id}" ${selected}>${escapeHtml(col.title)}</option>`;
    });
    
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">Move Card</div>
            <form id="modalForm">
                <div class="form-group">
                    <label for="targetColumn">Move to column:</label>
                    <select id="targetColumn" name="targetColumn" class="form-select">
                        ${columnOptions}
                    </select>
                </div>
                <div class="modal-actions">
                    <button type="button" class="btn btn-secondary cancel-btn">Cancel</button>
                    <button type="submit" class="btn btn-primary">Move</button>
                </div>
            </form>
        </div>
    `;
    
    const form = modal.querySelector('#modalForm');
    const cancelBtn = modal.querySelector('.cancel-btn');
    
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const targetColumnId = parseInt(form.elements.targetColumn.value);
        
        // Validate the target column ID
        if (isNaN(targetColumnId)) {
            console.error('Invalid target column ID');
            modal.remove();
            return;
        }
        
        if (targetColumnId !== card.columnId) {
            // Get cards in target column to set the order
            const targetCards = await kanbanDB.getCardsByColumn(targetColumnId);
            
            // Create updated card object to avoid mutating parameter
            const updatedCard = {
                ...card,
                columnId: targetColumnId,
                order: targetCards.length
            };
            
            await kanbanDB.updateCard(updatedCard);
            await loadBoard();
        }
        
        modal.remove();
    });
    
    cancelBtn.addEventListener('click', () => modal.remove());
    
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.remove();
        }
    });
    
    document.body.appendChild(modal);
}

// Delete column
async function deleteColumn(columnId) {
    if (confirm('Are you sure you want to delete this column and all its cards?')) {
        await kanbanDB.deleteCardsByColumn(columnId);
        await kanbanDB.deleteColumn(columnId);
        await loadBoard();
    }
}

// Delete card
async function deleteCard(cardId) {
    if (confirm('Are you sure you want to delete this card?')) {
        await kanbanDB.deleteCard(cardId);
        await loadBoard();
    }
}

// Create a generic modal
function createModal(title, fields, onSubmit) {
    const modal = document.createElement('div');
    modal.className = 'modal active';
    
    let fieldsHTML = '';
    fields.forEach(field => {
        const value = field.value || '';
        fieldsHTML += `
            <div class="form-group">
                <label for="${field.name}">${field.label}</label>
                <input 
                    type="${field.type}" 
                    id="${field.name}" 
                    name="${field.name}" 
                    ${field.required ? 'required' : ''}
                    value="${escapeHtml(value)}"
                >
            </div>
        `;
    });
    
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">${title}</div>
            <form id="modalForm">
                ${fieldsHTML}
                <div class="modal-actions">
                    <button type="button" class="btn btn-secondary cancel-btn">Cancel</button>
                    <button type="submit" class="btn btn-primary">Save</button>
                </div>
            </form>
        </div>
    `;
    
    const form = modal.querySelector('#modalForm');
    const cancelBtn = modal.querySelector('.cancel-btn');
    
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = {};
        fields.forEach(field => {
            formData[field.name] = form.elements[field.name].value;
        });
        await onSubmit(formData);
        modal.remove();
    });
    
    cancelBtn.addEventListener('click', () => modal.remove());
    
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.remove();
        }
    });
    
    return modal;
}

// Initialize the app when DOM is ready
document.addEventListener('DOMContentLoaded', init);
