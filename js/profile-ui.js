// Controls the HTML profile overlay (name + avatar picker).

import { AVATARS, drawAvatar } from './avatars.js';
import { t, getLanguage } from './i18n.js';
import { characterName } from './character-names.js';

export function createProfileUI(profile, { onDone, onBack, isUnlocked = () => true }) {
  const overlay = document.getElementById('profile-overlay');
  const form = document.getElementById('profile-form');
  const nameInput = document.getElementById('profile-name');
  const grid = document.getElementById('avatar-grid');
  const backBtn = document.getElementById('profile-back');
  const selectedName = document.getElementById('avatar-selected-name');
  const submitBtn = document.getElementById('profile-submit');

  let selectedAvatar = profile.getAvatarId();

  function renderAvatars() {
    grid.innerHTML = '';
    for (const avatar of AVATARS.filter(a => isUnlocked(a.id))) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'avatar-option';
      btn.setAttribute('role', 'radio');
      btn.setAttribute('aria-checked', String(avatar.id === selectedAvatar));
      btn.dataset.id = avatar.id;
      const preview = document.createElement('canvas');
      preview.className = 'avatar-preview';
      const size = 80;
      const dpr = Math.min(window.devicePixelRatio || 1, 3);
      preview.width = size * dpr;
      preview.height = size * dpr;
      const pctx = preview.getContext('2d');
      pctx.scale(dpr, dpr);
      pctx.translate(size / 2, size / 2 + 2);
      drawAvatar(pctx, avatar.id, 24, 0.6);
      const label = document.createElement('span');
      label.className = 'avatar-label';
      const displayName = characterName(avatar, getLanguage());
      label.textContent = displayName;
      btn.title = displayName;
      avatar.displayName = displayName;
      btn.appendChild(preview);
      btn.appendChild(label);
      btn.addEventListener('click', () => {
        selectedAvatar = avatar.id;
        for (const el of grid.children) {
          el.setAttribute('aria-checked', String(el.dataset.id === selectedAvatar));
        }
        updateSelectedName();
      });
      grid.appendChild(btn);
    }
  }

  function updateSelectedName() {
    const current = [...grid.children].find(el => el.dataset.id === selectedAvatar);
    selectedName.textContent = current ? current.title : '';
  }

  function applyTranslations() {
    document.getElementById('profile-title').textContent = t('whoIsPlaying');
    document.getElementById('profile-name-label').textContent = t('yourName');
    document.getElementById('profile-avatar-label').textContent = t('pickAvatar');
    nameInput.placeholder = t('namePlaceholder');
    backBtn.textContent = t('back');
    submitBtn.textContent = t('letsGo');
  }

  function updateSubmit() {
    submitBtn.disabled = nameInput.value.trim().length === 0;
  }

  nameInput.addEventListener('input', updateSubmit);

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = nameInput.value.trim();
    if (!name) return;
    profile.setName(name);
    profile.setAvatar(selectedAvatar);
    hide();
    onDone();
  });

  backBtn.addEventListener('click', () => {
    hide();
    onBack();
  });

  // Keep game keyboard shortcuts from firing while typing
  overlay.addEventListener('keydown', (e) => e.stopPropagation());

  function show({ allowBack }) {
    selectedAvatar = profile.getAvatarId();
    applyTranslations();
    renderAvatars();
    updateSelectedName();
    nameInput.value = profile.getName();
    backBtn.hidden = !allowBack;
    updateSubmit();
    overlay.hidden = false;
    // Focus the field on desktop only; on touch devices the keyboard would cover the avatars
    if (!('ontouchstart' in window)) {
      setTimeout(() => nameInput.focus(), 50);
    }
  }

  function hide() {
    overlay.hidden = true;
    nameInput.blur();
  }

  return { show, hide, isVisible: () => !overlay.hidden };
}
