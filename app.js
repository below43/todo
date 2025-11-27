// Main application logic
const kanbanDB = new KanbanDB();
let columns = [];
let currentListId = null;
let lists = [];
let draggedCard = null;
let draggedColumn = null;
let isViewOnlyMode = false;
let sharedListData = null;

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
    
    // Check for shared list in URL fragment
    const sharedData = parseUrlFragment();
    if (sharedData) {
        sharedListData = sharedData;
        isViewOnlyMode = true;
        await loadSharedList(sharedData);
        setupEventListeners();
        enableViewOnlyMode();
    } else {
        await loadLists();
        setupEventListeners();
    }
}

// Load all lists and set current list
async function loadLists() {
    lists = await kanbanDB.getAllLists();
    
    // If no lists exist, create a default one
    if (lists.length === 0) {
        const defaultListId = await kanbanDB.addList({ title: 'TODO', order: 0 });
        lists = await kanbanDB.getAllLists();
        currentListId = defaultListId;
        await createDefaultColumns();
    } else {
        // Load saved current list or use first one
        const savedListId = localStorage.getItem('currentListId');
        if (savedListId && lists.some(l => l.id === parseInt(savedListId))) {
            currentListId = parseInt(savedListId);
        } else {
            currentListId = lists[0].id;
        }
    }
    
    updateListTitle();
    await loadBoard();
}

// Setup event listeners
function setupEventListeners() {
    // Settings menu
    const settingsMenuBtn = document.getElementById('settingsMenuBtn');
    const settingsDropdownMenu = document.getElementById('settingsDropdownMenu');
    const settingsAddListBtn = document.getElementById('settingsAddListBtn');
    const settingsAddColumnBtn = document.getElementById('settingsAddColumnBtn');
    const settingsShareListBtn = document.getElementById('settingsShareListBtn');
    const settingsThemeToggleBtn = document.getElementById('settingsThemeToggleBtn');
    const themeToggleBtn = document.getElementById('themeToggleBtn');
    const editSharedListBtn = document.getElementById('editSharedListBtn');
    
    // List title click to edit
    const listTitle = document.getElementById('listTitle');
    listTitle.addEventListener('click', () => editListTitle());
    
    // List selector button
    const listSelectorBtn = document.getElementById('listSelectorBtn');
    listSelectorBtn.addEventListener('click', () => showListSelectorModal());
    
    settingsMenuBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        settingsDropdownMenu.classList.toggle('active');
    });
    
    settingsAddListBtn.addEventListener('click', () => {
        settingsDropdownMenu.classList.remove('active');
        showAddListModal();
    });
    
    settingsAddColumnBtn.addEventListener('click', () => {
        settingsDropdownMenu.classList.remove('active');
        showAddColumnModal();
    });
    
    settingsShareListBtn.addEventListener('click', () => {
        settingsDropdownMenu.classList.remove('active');
        showShareModal();
    });
    
    // Edit shared list button (for view-only mode)
    editSharedListBtn.addEventListener('click', () => {
        handleEditSharedList();
    });
    
    settingsThemeToggleBtn.addEventListener('click', () => {
        settingsDropdownMenu.classList.remove('active');
        toggleTheme();
    });
    
    themeToggleBtn.addEventListener('click', () => {
        toggleTheme();
    });
    
    // Apply saved theme on load
    applySavedTheme();
    
    // View toggle buttons (side by side toggle)
    const kanbanViewBtn = document.getElementById('kanbanViewBtn');
    const stackedViewBtn = document.getElementById('stackedViewBtn');
    const board = document.getElementById('board');
    
    kanbanViewBtn.addEventListener('click', () => {
        board.classList.remove('stacked');
        kanbanViewBtn.classList.add('active');
        stackedViewBtn.classList.remove('active');
        localStorage.setItem('boardView', 'horizontal');
        loadBoard(); // Reload to update menus
    });
    
    stackedViewBtn.addEventListener('click', () => {
        board.classList.add('stacked');
        stackedViewBtn.classList.add('active');
        kanbanViewBtn.classList.remove('active');
        localStorage.setItem('boardView', 'stacked');
        loadBoard(); // Reload to update menus
    });
    
    // Restore saved view preference
    const savedView = localStorage.getItem('boardView');
    if (savedView === 'stacked') {
        board.classList.add('stacked');
        stackedViewBtn.classList.add('active');
        kanbanViewBtn.classList.remove('active');
    }
    
    // Close menus when clicking outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.menu-container')) {
            document.querySelectorAll('.dropdown-menu.active').forEach(menu => {
                menu.classList.remove('active');
            });
        }
        if (!e.target.closest('.settings-menu-container')) {
            document.querySelectorAll('.settings-dropdown-menu.active').forEach(menu => {
                menu.classList.remove('active');
            });
        }
    });
}

// Theme toggle functions
function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
}

function applySavedTheme() {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
        document.documentElement.setAttribute('data-theme', savedTheme);
    } else {
        // Check for system preference
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
            document.documentElement.setAttribute('data-theme', 'dark');
        }
    }
}

// Load the entire board
async function loadBoard() {
    columns = await kanbanDB.getColumnsByList(currentListId);
    
    // If no columns exist for this list, create default ones
    if (columns.length === 0) {
        await createDefaultColumns();
        columns = await kanbanDB.getColumnsByList(currentListId);
    }
    
    renderBoard();
}

// Create default columns
async function createDefaultColumns() {
    const defaultColumns = [
        { title: 'To Do', order: 0, listId: currentListId },
        { title: 'In Progress', order: 1, listId: currentListId },
        { title: 'Done', order: 2, listId: currentListId }
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
    
    // Check if column is collapsed
    const isCollapsed = isColumnCollapsed(column.id);
    if (isCollapsed) {
        columnEl.classList.add('collapsed');
    }
    
    // Check if we're in stacked mode
    const isStacked = document.getElementById('board').classList.contains('stacked');
    
    // Build menu items
    let menuItems = `<button class="menu-item rename-column" data-column-id="${column.id}"><span class="material-icons">edit</span>Rename</button>`;
    
    // Add move up/down buttons in stacked mode
    if (isStacked) {
        menuItems += `
            <button class="menu-item move-column-up" data-column-id="${column.id}"><span class="material-icons">arrow_upward</span>Move Up</button>
            <button class="menu-item move-column-down" data-column-id="${column.id}"><span class="material-icons">arrow_downward</span>Move Down</button>
        `;
    }
    
    menuItems += `<button class="menu-item danger delete-column" data-column-id="${column.id}"><span class="material-icons">delete</span>Delete</button>`;
    
    const cardCount = cards.length;
    const collapseIcon = getCollapseIcon(isStacked, isCollapsed);
    const collapseTitle = isCollapsed ? 'Expand column' : 'Collapse column';
    
    columnEl.innerHTML = `
        <div class="column-header">
            <button class="collapse-btn" data-column-id="${column.id}" title="${collapseTitle}"><span class="material-icons">${collapseIcon}</span></button>
            <div class="column-header-left">
                <div class="column-title" data-column-id="${column.id}">${escapeHtml(column.title)}</div>
                <span class="card-count">${cardCount}</span>
            </div>
            <div class="column-actions">
                <button class="add-card-icon-btn" data-column-id="${column.id}" title="Add Card">
                    <span class="material-icons">add</span>
                </button>
                <div class="menu-container">
                    <button class="menu-btn column-menu-btn" data-column-id="${column.id}" title="Column menu"><span class="material-icons">more_vert</span></button>
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
    
    // Collapse button event listener
    const collapseBtn = columnEl.querySelector('.collapse-btn');
    collapseBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleColumnCollapse(column.id);
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
    
    // Add card button (in header)
    const addCardIconBtn = columnEl.querySelector('.add-card-icon-btn');
    addCardIconBtn.addEventListener('click', () => showAddCardModal(column.id));
    
    // Add card button (at bottom)
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
    cardHTML += `<div class="card-footer">`;
    if (card.link) {
        cardHTML += `<a href="${escapeHtml(card.link)}" class="card-link-icon" target="_blank" rel="noopener noreferrer" title="${escapeHtml(card.link)}"><span class="material-icons">link</span></a>`;
    } else {
        cardHTML += `<div class="card-link-placeholder"></div>`;
    }
    cardHTML += `
            <div class="menu-container">
                <button class="menu-btn card-menu-btn" data-card-id="${card.id}" title="Card menu"><span class="material-icons">more_vert</span></button>
                <div class="dropdown-menu">
                    <button class="menu-item edit-card" data-card-id="${card.id}"><span class="material-icons">edit</span>Edit</button>
                    <button class="menu-item move-card" data-card-id="${card.id}"><span class="material-icons">arrow_forward</span>Move</button>
                    <button class="menu-item danger delete-card" data-card-id="${card.id}"><span class="material-icons">delete</span>Delete</button>
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

// Column collapse functions
function getCollapseIcon(isStacked, isCollapsed) {
    // In column mode (horizontal), use chevron_left/chevron_right
    // In stacked mode (vertical), use expand_less/expand_more
    return isStacked
        ? (isCollapsed ? 'expand_more' : 'expand_less')
        : (isCollapsed ? 'chevron_right' : 'chevron_left');
}

function getCollapsedColumns() {
    try {
        const stored = localStorage.getItem('collapsedColumns');
        return stored ? JSON.parse(stored) : [];
    } catch (e) {
        return [];
    }
}

function isColumnCollapsed(columnId) {
    const collapsed = getCollapsedColumns();
    return collapsed.includes(columnId);
}

function toggleColumnCollapse(columnId) {
    const collapsed = getCollapsedColumns();
    const index = collapsed.indexOf(columnId);
    
    if (index === -1) {
        collapsed.push(columnId);
    } else {
        collapsed.splice(index, 1);
    }
    
    try {
        localStorage.setItem('collapsedColumns', JSON.stringify(collapsed));
    } catch (e) {
        // Ignore storage errors (quota exceeded, etc.)
    }
    
    // Update the DOM directly without full reload
    const columnEl = document.querySelector(`.column[data-column-id="${columnId}"]`);
    if (columnEl) {
        columnEl.classList.toggle('collapsed');
        const collapseBtn = columnEl.querySelector('.collapse-btn');
        if (collapseBtn) {
            const isCollapsed = columnEl.classList.contains('collapsed');
            const isStacked = document.getElementById('board').classList.contains('stacked');
            const iconSpan = collapseBtn.querySelector('.material-icons');
            if (iconSpan) {
                iconSpan.textContent = getCollapseIcon(isStacked, isCollapsed);
            }
            collapseBtn.title = isCollapsed ? 'Expand column' : 'Collapse column';
        }
    }
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

// Update list title in header
function updateListTitle() {
    const listTitleEl = document.getElementById('listTitle');
    const currentList = lists.find(l => l.id === currentListId);
    if (currentList && listTitleEl) {
        listTitleEl.textContent = currentList.title;
    }
}

// Edit list title inline
function editListTitle() {
    const titleElement = document.getElementById('listTitle');
    const currentList = lists.find(l => l.id === currentListId);
    if (!currentList) return;
    
    const currentTitle = currentList.title;
    const input = document.createElement('input');
    input.type = 'text';
    input.value = currentTitle;
    input.className = 'list-title-input';
    
    titleElement.replaceWith(input);
    input.focus();
    input.select();
    
    const saveEdit = async () => {
        const newTitle = input.value.trim();
        if (newTitle && newTitle !== currentTitle) {
            // Check for unique name
            const existingList = lists.find(l => l.id !== currentListId && l.title.toLowerCase() === newTitle.toLowerCase());
            if (existingList) {
                alert('A list with this name already exists. Please choose a different name.');
                input.focus();
                input.select();
                return;
            }
            
            currentList.title = newTitle;
            await kanbanDB.updateList(currentList);
            lists = await kanbanDB.getAllLists();
        }
        
        // Restore the h1 element
        const newTitleEl = document.createElement('h1');
        newTitleEl.id = 'listTitle';
        newTitleEl.className = 'list-title';
        newTitleEl.title = 'Click to edit list name';
        newTitleEl.textContent = currentList.title;
        newTitleEl.addEventListener('click', () => editListTitle());
        input.replaceWith(newTitleEl);
    };
    
    input.addEventListener('blur', saveEdit);
    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            saveEdit();
        }
    });
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            // Cancel editing
            const newTitleEl = document.createElement('h1');
            newTitleEl.id = 'listTitle';
            newTitleEl.className = 'list-title';
            newTitleEl.title = 'Click to edit list name';
            newTitleEl.textContent = currentTitle;
            newTitleEl.addEventListener('click', () => editListTitle());
            input.replaceWith(newTitleEl);
        }
    });
}

// Show list selector modal
function showListSelectorModal() {
    const modal = document.createElement('div');
    modal.className = 'list-selector-modal active';
    
    let listItemsHTML = '';
    lists.forEach(list => {
        const isActive = list.id === currentListId ? 'active' : '';
        listItemsHTML += `
            <div class="list-item ${isActive}" data-list-id="${list.id}">
                <span class="list-item-name">${escapeHtml(list.title)}</span>
                <button class="list-item-delete" data-list-id="${list.id}" title="Delete list">
                    <span class="material-icons">delete</span>
                </button>
            </div>
        `;
    });
    
    modal.innerHTML = `
        <div class="list-selector-content">
            <div class="list-selector-header">
                <span>Select List</span>
                <button class="list-add-btn" title="Add new list">
                    <span class="material-icons">add</span>
                </button>
            </div>
            <div class="list-items">
                ${listItemsHTML}
            </div>
        </div>
    `;
    
    // Add event listeners to list items
    modal.querySelectorAll('.list-item').forEach(item => {
        item.addEventListener('click', async (e) => {
            // Don't switch list if clicking delete button
            if (e.target.closest('.list-item-delete')) return;
            
            const listId = parseInt(item.dataset.listId);
            if (!isNaN(listId) && listId !== currentListId) {
                currentListId = listId;
                localStorage.setItem('currentListId', currentListId);
                updateListTitle();
                await loadBoard();
            }
            modal.remove();
        });
    });
    
    // Add event listeners to delete buttons
    modal.querySelectorAll('.list-item-delete').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const listId = parseInt(btn.dataset.listId);
            if (!isNaN(listId)) {
                await deleteList(listId, modal);
            }
        });
    });
    
    // Add event listener for add list button
    const addListBtn = modal.querySelector('.list-add-btn');
    if (addListBtn) {
        addListBtn.addEventListener('click', () => {
            modal.remove();
            showAddListModal();
        });
    }
    
    // Close modal when clicking outside
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.remove();
        }
    });
    
    document.body.appendChild(modal);
}

// Show add list modal
function showAddListModal() {
    const modal = createModal('Add New List', [
        { label: 'List Name', name: 'title', type: 'text', required: true }
    ], async (formData) => {
        const newTitle = formData.title.trim();
        
        // Check for unique name
        const existingList = lists.find(l => l.title.toLowerCase() === newTitle.toLowerCase());
        if (existingList) {
            alert('A list with this name already exists. Please choose a different name.');
            return;
        }
        
        const list = {
            title: newTitle,
            order: lists.length
        };
        const newListId = await kanbanDB.addList(list);
        lists = await kanbanDB.getAllLists();
        
        // Switch to the new list
        currentListId = newListId;
        localStorage.setItem('currentListId', currentListId);
        updateListTitle();
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

// Delete a list
async function deleteList(listId, modal) {
    const list = lists.find(l => l.id === listId);
    if (!list) return;
    
    // Don't allow deleting the last list
    if (lists.length === 1) {
        alert('Cannot delete the last list. You must have at least one list.');
        return;
    }
    
    if (confirm(`Are you sure you want to delete the list "${list.title}" and all its columns and cards?`)) {
        // Delete all columns and cards in this list
        await kanbanDB.deleteColumnsByList(listId);
        // Delete the list
        await kanbanDB.deleteList(listId);
        lists = await kanbanDB.getAllLists();
        
        // If we deleted the current list, switch to another one
        if (listId === currentListId) {
            currentListId = lists[0].id;
            localStorage.setItem('currentListId', currentListId);
            updateListTitle();
            await loadBoard();
        }
        
        // Update the modal if it's still open
        if (modal && document.body.contains(modal)) {
            modal.remove();
            showListSelectorModal();
        }
    }
}

// Show add column modal
function showAddColumnModal() {
    const modal = createModal('Add Column', [
        { label: 'Column Title', name: 'title', type: 'text', required: true }
    ], async (formData) => {
        const column = {
            title: formData.title,
            order: columns.length,
            listId: currentListId
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

// ==========================================
// SHARE FUNCTIONALITY
// ==========================================

// Encode list data to base64
function encodeListData(listTitle, columnsData, cardsData) {
    const data = {
        title: listTitle,
        columns: columnsData.map(col => ({
            title: col.title,
            order: col.order
        })),
        cards: cardsData.map(card => ({
            title: card.title,
            link: card.link || '',
            columnIndex: columnsData.findIndex(col => col.id === card.columnId),
            order: card.order
        }))
    };
    
    const jsonString = JSON.stringify(data);
    // Use encodeURIComponent to handle unicode characters before base64 encoding
    const base64 = btoa(encodeURIComponent(jsonString).replace(/%([0-9A-F]{2})/g, (match, p1) => {
        return String.fromCharCode(parseInt(p1, 16));
    }));
    
    return base64;
}

// Decode base64 to list data
function decodeListData(base64) {
    try {
        // Decode base64 and handle unicode characters
        const jsonString = decodeURIComponent(
            Array.from(atob(base64), c => 
                '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)
            ).join('')
        );
        return JSON.parse(jsonString);
    } catch (e) {
        console.error('Failed to decode shared list data:', e);
        return null;
    }
}

// Parse URL fragment for shared list data
function parseUrlFragment() {
    const hash = window.location.hash;
    if (!hash || hash.length <= 1) {
        return null;
    }
    
    const base64Data = hash.substring(1); // Remove the '#'
    return decodeListData(base64Data);
}

// Load shared list in view-only mode
async function loadSharedList(data) {
    if (!data || !data.title || !data.columns) {
        console.error('Invalid shared list data');
        return;
    }
    
    // Load existing lists for later comparison when saving
    lists = await kanbanDB.getAllLists();
    
    // Create temporary in-memory structure for rendering
    const tempColumns = data.columns.map((col, index) => ({
        id: index,
        title: col.title,
        order: col.order
    }));
    
    columns = tempColumns;
    
    // Update the title display
    const listTitleEl = document.getElementById('listTitle');
    if (listTitleEl) {
        listTitleEl.textContent = data.title + ' (View Only)';
    }
    
    // Render the board with shared data
    await renderSharedBoard(data);
}

// Render board with shared data (view-only)
async function renderSharedBoard(data) {
    const board = document.getElementById('board');
    board.innerHTML = '';
    
    for (let colIndex = 0; colIndex < data.columns.length; colIndex++) {
        const column = {
            id: colIndex,
            title: data.columns[colIndex].title,
            order: data.columns[colIndex].order
        };
        
        // Get cards for this column
        const cards = data.cards
            .filter(card => card.columnIndex === colIndex)
            .map((card, cardIndex) => ({
                id: cardIndex,
                title: card.title,
                link: card.link,
                columnId: colIndex,
                order: card.order
            }))
            .sort((a, b) => a.order - b.order);
        
        const columnEl = createViewOnlyColumnElement(column, cards);
        board.appendChild(columnEl);
    }
}

// Create a view-only column element
function createViewOnlyColumnElement(column, cards) {
    const columnEl = document.createElement('div');
    columnEl.className = 'column';
    columnEl.dataset.columnId = column.id;
    
    const cardCount = cards.length;
    
    columnEl.innerHTML = `
        <div class="column-header">
            <div class="column-header-left">
                <div class="column-title">${escapeHtml(column.title)}</div>
                <span class="card-count">${cardCount}</span>
            </div>
        </div>
        <div class="cards" data-column-id="${column.id}"></div>
    `;
    
    // Add cards
    const cardsContainer = columnEl.querySelector('.cards');
    cards.forEach(card => {
        const cardEl = createViewOnlyCardElement(card);
        cardsContainer.appendChild(cardEl);
    });
    
    return columnEl;
}

// Create a view-only card element
function createViewOnlyCardElement(card) {
    const cardEl = document.createElement('div');
    cardEl.className = 'card';
    cardEl.dataset.cardId = card.id;
    cardEl.dataset.columnId = card.columnId;
    
    let cardHTML = `<div class="card-title">${escapeHtml(card.title)}</div>`;
    if (card.link) {
        cardHTML += `<div class="card-footer">`;
        cardHTML += `<a href="${escapeHtml(card.link)}" class="card-link-icon" target="_blank" rel="noopener noreferrer" title="${escapeHtml(card.link)}"><span class="material-icons">link</span></a>`;
        cardHTML += `</div>`;
    }
    
    cardEl.innerHTML = cardHTML;
    return cardEl;
}

// Enable view-only mode
function enableViewOnlyMode() {
    document.body.classList.add('view-only');
    
    // Show the edit button
    const editBtn = document.getElementById('editSharedListBtn');
    if (editBtn) {
        editBtn.style.display = 'flex';
    }
    
    // Add view-only banner
    const container = document.querySelector('.container');
    if (container) {
        const banner = document.createElement('div');
        banner.className = 'view-only-banner';
        banner.textContent = 'You are viewing a shared list. Click "Edit" to save it locally.';
        container.insertBefore(banner, container.firstChild);
    }
}

// Disable view-only mode
function disableViewOnlyMode() {
    document.body.classList.remove('view-only');
    isViewOnlyMode = false;
    sharedListData = null;
    
    // Hide the edit button
    const editBtn = document.getElementById('editSharedListBtn');
    if (editBtn) {
        editBtn.style.display = 'none';
    }
    
    // Remove view-only banner
    const banner = document.querySelector('.view-only-banner');
    if (banner) {
        banner.remove();
    }
    
    // Remove URL fragment
    history.replaceState(null, '', window.location.pathname + window.location.search);
}

// Handle edit button click for shared list
async function handleEditSharedList() {
    if (!sharedListData) {
        return;
    }
    
    const listTitle = sharedListData.title;
    
    // Check if a list with this name already exists
    const existingList = lists.find(l => l.title.toLowerCase() === listTitle.toLowerCase());
    
    if (existingList) {
        // Show modal to choose: overwrite existing or create new
        showOverwriteOrNewModal(existingList);
    } else {
        // No existing list with this name, directly save as new
        await saveSharedListAsNew(listTitle);
    }
}

// Show modal to choose between overwrite or new list
function showOverwriteOrNewModal(existingList) {
    const modal = document.createElement('div');
    modal.className = 'modal active';
    
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">List Already Exists</div>
            <p style="margin-bottom: 20px;">A list named "${escapeHtml(existingList.title)}" already exists. What would you like to do?</p>
            <div class="modal-actions" style="flex-direction: column; gap: 10px;">
                <button type="button" class="btn btn-primary overwrite-btn" style="width: 100%;">
                    <span class="material-icons" style="margin-right: 8px;">save</span>
                    Overwrite Existing List
                </button>
                <button type="button" class="btn btn-secondary new-btn" style="width: 100%;">
                    <span class="material-icons" style="margin-right: 8px;">add</span>
                    Create New List
                </button>
                <button type="button" class="btn btn-secondary cancel-btn" style="width: 100%;">
                    Cancel
                </button>
            </div>
        </div>
    `;
    
    const overwriteBtn = modal.querySelector('.overwrite-btn');
    const newBtn = modal.querySelector('.new-btn');
    const cancelBtn = modal.querySelector('.cancel-btn');
    
    overwriteBtn.addEventListener('click', async () => {
        modal.remove();
        await overwriteExistingList(existingList);
    });
    
    newBtn.addEventListener('click', async () => {
        modal.remove();
        const uniqueTitle = await generateUniqueListTitle(sharedListData.title);
        await saveSharedListAsNew(uniqueTitle);
    });
    
    cancelBtn.addEventListener('click', () => modal.remove());
    
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.remove();
        }
    });
    
    document.body.appendChild(modal);
}

// Generate a unique list title by appending a number
async function generateUniqueListTitle(baseTitle) {
    let counter = 1;
    let newTitle = `${baseTitle} (${counter})`;
    
    while (lists.some(l => l.title.toLowerCase() === newTitle.toLowerCase())) {
        counter++;
        newTitle = `${baseTitle} (${counter})`;
    }
    
    return newTitle;
}

// Overwrite an existing list with shared data
async function overwriteExistingList(existingList) {
    if (!sharedListData) return;
    
    // Delete existing columns and cards
    await kanbanDB.deleteColumnsByList(existingList.id);
    
    // Create new columns
    const columnIdMap = {};
    for (let i = 0; i < sharedListData.columns.length; i++) {
        const col = sharedListData.columns[i];
        const newColId = await kanbanDB.addColumn({
            title: col.title,
            order: col.order,
            listId: existingList.id
        });
        columnIdMap[i] = newColId;
    }
    
    // Create new cards
    for (const card of sharedListData.cards) {
        const columnId = columnIdMap[card.columnIndex];
        if (columnId !== undefined) {
            await kanbanDB.addCard({
                title: card.title,
                link: card.link || '',
                columnId: columnId,
                order: card.order
            });
        }
    }
    
    // Switch to this list and exit view-only mode
    currentListId = existingList.id;
    localStorage.setItem('currentListId', currentListId);
    
    disableViewOnlyMode();
    await loadLists();
}

// Save shared list as a new list
async function saveSharedListAsNew(title) {
    if (!sharedListData) return;
    
    // Create new list
    const newListId = await kanbanDB.addList({
        title: title,
        order: lists.length
    });
    
    // Create columns
    const columnIdMap = {};
    for (let i = 0; i < sharedListData.columns.length; i++) {
        const col = sharedListData.columns[i];
        const newColId = await kanbanDB.addColumn({
            title: col.title,
            order: col.order,
            listId: newListId
        });
        columnIdMap[i] = newColId;
    }
    
    // Create cards
    for (const card of sharedListData.cards) {
        const columnId = columnIdMap[card.columnIndex];
        if (columnId !== undefined) {
            await kanbanDB.addCard({
                title: card.title,
                link: card.link || '',
                columnId: columnId,
                order: card.order
            });
        }
    }
    
    // Switch to the new list and exit view-only mode
    currentListId = newListId;
    localStorage.setItem('currentListId', currentListId);
    
    disableViewOnlyMode();
    await loadLists();
}

// Show share modal
async function showShareModal() {
    if (isViewOnlyMode) {
        alert('Cannot share a view-only list. Please save it first.');
        return;
    }
    
    const currentList = lists.find(l => l.id === currentListId);
    if (!currentList) {
        alert('No list selected to share.');
        return;
    }
    
    // Get all columns and cards for the current list
    const columnsData = await kanbanDB.getColumnsByList(currentListId);
    let allCards = [];
    for (const col of columnsData) {
        const cards = await kanbanDB.getCardsByColumn(col.id);
        allCards = allCards.concat(cards);
    }
    
    // Encode the list data
    const base64Data = encodeListData(currentList.title, columnsData, allCards);
    const shareUrl = window.location.origin + window.location.pathname + '#' + base64Data;
    
    const modal = document.createElement('div');
    modal.className = 'modal active';
    
    // Check if Navigator.share is available
    const canShare = navigator.share !== undefined;
    
    modal.innerHTML = `
        <div class="share-modal-content">
            <div class="modal-header">Share List: ${escapeHtml(currentList.title)}</div>
            <p style="margin-bottom: 15px; color: var(--text-secondary);">
                Share this URL with others. They will be able to view and optionally save a copy of your list.
            </p>
            <div class="share-url-preview">${escapeHtml(shareUrl)}</div>
            <div class="share-actions">
                <button type="button" class="btn btn-secondary cancel-btn">Close</button>
                <button type="button" class="btn btn-primary copy-btn">
                    <span class="material-icons">content_copy</span>
                    Copy URL
                </button>
                ${canShare ? `
                    <button type="button" class="btn btn-primary share-btn">
                        <span class="material-icons">share</span>
                        Share
                    </button>
                ` : ''}
            </div>
        </div>
    `;
    
    const cancelBtn = modal.querySelector('.cancel-btn');
    const copyBtn = modal.querySelector('.copy-btn');
    const shareBtn = modal.querySelector('.share-btn');
    
    cancelBtn.addEventListener('click', () => modal.remove());
    
    copyBtn.addEventListener('click', async () => {
        try {
            await navigator.clipboard.writeText(shareUrl);
            copyBtn.innerHTML = '<span class="material-icons">check</span> Copied!';
            setTimeout(() => {
                copyBtn.innerHTML = '<span class="material-icons">content_copy</span> Copy URL';
            }, 2000);
        } catch (err) {
            // Fallback for older browsers
            const textArea = document.createElement('textarea');
            textArea.value = shareUrl;
            textArea.style.position = 'fixed';
            textArea.style.left = '-9999px';
            document.body.appendChild(textArea);
            textArea.select();
            try {
                document.execCommand('copy');
                copyBtn.innerHTML = '<span class="material-icons">check</span> Copied!';
                setTimeout(() => {
                    copyBtn.innerHTML = '<span class="material-icons">content_copy</span> Copy URL';
                }, 2000);
            } catch (execErr) {
                alert('Failed to copy URL. Please select and copy manually.');
            }
            document.body.removeChild(textArea);
        }
    });
    
    if (shareBtn) {
        shareBtn.addEventListener('click', async () => {
            try {
                await navigator.share({
                    title: `TODO List: ${currentList.title}`,
                    text: `Check out my TODO list: ${currentList.title}`,
                    url: shareUrl
                });
            } catch (err) {
                if (err.name !== 'AbortError') {
                    console.error('Share failed:', err);
                }
            }
        });
    }
    
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.remove();
        }
    });
    
    document.body.appendChild(modal);
}

// Initialize the app when DOM is ready
document.addEventListener('DOMContentLoaded', init);
