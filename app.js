// Main application logic
const kanbanDB = new KanbanDB();
let columns = [];
let draggedCard = null;

// Initialize the app
async function init() {
    await kanbanDB.init();
    await loadBoard();
    setupEventListeners();
}

// Setup event listeners
function setupEventListeners() {
    document.getElementById('addColumnBtn').addEventListener('click', showAddColumnModal);
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
    
    columnEl.innerHTML = `
        <div class="column-header">
            <div class="column-title" data-column-id="${column.id}">${column.title}</div>
            <div class="column-actions">
                <button class="icon-btn delete-column" data-column-id="${column.id}" title="Delete column">🗑️</button>
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
    
    // Delete column button
    const deleteBtn = columnEl.querySelector('.delete-column');
    deleteBtn.addEventListener('click', () => deleteColumn(column.id));
    
    // Add card button
    const addCardBtn = columnEl.querySelector('.add-card-btn');
    addCardBtn.addEventListener('click', () => showAddCardModal(column.id));
    
    // Setup drag and drop for cards container
    setupDropZone(cardsContainer, column.id);
    
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
            <button class="icon-btn delete-card" data-card-id="${card.id}" title="Delete card">🗑️</button>
        </div>
    `;
    
    cardEl.innerHTML = cardHTML;
    
    // Double-click to edit
    cardEl.addEventListener('dblclick', (e) => {
        if (!e.target.classList.contains('delete-card') && !e.target.classList.contains('card-link')) {
            editCard(card);
        }
    });
    
    // Delete card button
    const deleteBtn = cardEl.querySelector('.delete-card');
    deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        deleteCard(card.id);
    });
    
    // Drag events
    cardEl.addEventListener('dragstart', handleDragStart);
    cardEl.addEventListener('dragend', handleDragEnd);
    
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
