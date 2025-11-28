// User management module

export let currentUser = localStorage.getItem('currentUser');

export function getCurrentUser() {
    return currentUser;
}

export function setUser(user, callbacks = {}) {
    localStorage.setItem('currentUser', user);
    currentUser = user;

    const modalEl = document.getElementById('userSelectModal');
    const modal = bootstrap.Modal.getInstance(modalEl);
    if (modal) modal.hide();

    resetEasterEgg();

    // Callbacks to refresh data
    if (callbacks.onUserChange) callbacks.onUserChange();
}

export function trocarUsuario() {
    localStorage.removeItem('currentUser');
    currentUser = null;
    resetEasterEgg();
    new bootstrap.Modal('#userSelectModal').show();
}

export function updateUserUI() {
    const badge = document.getElementById('currentUserBadge');
    const switcher = document.getElementById('userSwitcher');
    const messageToLabel = document.getElementById('messageToLabel');
    const toUser = document.getElementById('toUser');

    if (badge) badge.textContent = currentUser;

    if (switcher) {
        switcher.classList.remove('btn-outline-secondary', 'btn-gabriela', 'btn-thomas');
        if (currentUser === 'Thomas') switcher.classList.add('btn-thomas');
        if (currentUser === 'Gabriela') switcher.classList.add('btn-gabriela');
    }

    if (toUser && messageToLabel) {
        const otherUser = currentUser === 'Thomas' ? 'Gabriela' : 'Thomas';
        toUser.value = otherUser;

        messageToLabel.textContent = otherUser;

        messageToLabel.classList.remove('text-thomas', 'text-gabriela');
        if (otherUser === 'Thomas') {
            messageToLabel.classList.add('text-thomas');
        } else if (otherUser === 'Gabriela') {
            messageToLabel.classList.add('text-gabriela');
        }
    }
}

function resetEasterEgg() {
    const easterEggForm = document.getElementById('easterEggForm');
    easterEggForm?.classList.add('d-none');
}

export function initUserSystem(callbacks) {
    const easterEggTrigger = document.getElementById('easterEggTrigger');
    const easterEggForm = document.getElementById('easterEggForm');

    easterEggTrigger?.addEventListener('click', () => {
        easterEggForm?.classList.toggle('d-none');
    });

    // Expose setUser globally for the onclick in HTML (or better, attach listeners in main.js)
    // Since the HTML has onclick="setUser('Thomas')", we need to attach it to window or change HTML.
    // I will change HTML to remove inline handlers in a later step or attach to window here.
    window.setUser = (u) => setUser(u, callbacks);
    window.trocarUsuario = trocarUsuario;
}
