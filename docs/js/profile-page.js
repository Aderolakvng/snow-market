import { auth, db } from './firebase.js';
import { onAuthStateChanged, updateProfile } from 'https://www.gstatic.com/firebasejs/10.13.1/firebase-auth.js';
import { doc, getDoc, setDoc, updateDoc } from 'https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js';

function val(id) {
  return (document.getElementById(id)?.value || '').trim();
}

function setVal(id, v) {
  const el = document.getElementById(id);
  if (el) el.value = v == null ? '' : String(v);
}

function showMsg(id, text) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = text || '';
  el.style.display = text ? 'block' : 'none';
}

async function ensureUserDoc(user) {
  const ref = doc(db, 'users', user.uid);
  const snap = await getDoc(ref);
  if (snap.exists()) {
    const data = snap.data() || {};
    const hasName = String(data.firstName || '').trim() || String(data.lastName || '').trim();
    const displayName = String(user.displayName || '').trim();
    if (!hasName && displayName) {
      const parts = displayName ? displayName.split(' ') : [];
      const firstName = parts[0] || '';
      const lastName = parts.slice(1).join(' ') || '';
      try {
        await updateDoc(ref, { firstName, lastName, updatedAt: new Date() });
        return { ...data, firstName, lastName };
      } catch (e) {
        return { ...data, firstName, lastName };
      }
    }
    return data;
  }

  const displayName = String(user.displayName || '').trim();
  const parts = displayName ? displayName.split(' ') : [];
  const firstName = parts[0] || '';
  const lastName = parts.slice(1).join(' ') || '';

  const data = {
    uid: user.uid,
    email: user.email || '',
    firstName,
    lastName,
    phone: '',
    address: '',
    city: '',
    state: '',
    country: '',
    createdAt: new Date(),
    updatedAt: new Date()
  };

  await setDoc(ref, data);
  return data;
}

function renderProfile(data, user) {
  setVal('firstName', data.firstName || '');
  setVal('lastName', data.lastName || '');
  setVal('email', (data.email || user.email || ''));
  setVal('phone', data.phone || '');
  setVal('address', data.address || '');
  setVal('city', data.city || '');
  setVal('state', data.state || '');
  setVal('country', data.country || '');
}

async function saveProfile(user) {
  showMsg('error-message', '');
  showMsg('success-message', '');

  const firstName = val('firstName');
  const lastName = val('lastName');
  const phone = val('phone');
  const address = val('address');
  const city = val('city');
  const state = val('state');
  const country = val('country');

  const ref = doc(db, 'users', user.uid);
  await updateDoc(ref, {
    firstName,
    lastName,
    phone,
    address,
    city,
    state,
    country,
    updatedAt: new Date()
  });

  const displayName = `${firstName} ${lastName}`.trim();
  if (displayName && displayName !== (user.displayName || '')) {
    await updateProfile(user, { displayName });
  }

  showMsg('success-message', 'Profile updated successfully.');
}

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('profile-form');
  const logoutBtn = document.getElementById('logout-btn');

  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      if (window.logout) window.logout();
    });
  }

  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      window.location.href = `login.html?redirect=${encodeURIComponent('profile.html')}`;
      return;
    }

    const data = await ensureUserDoc(user);
    renderProfile(data, user);

    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = document.getElementById('save-profile-btn');
        if (btn) {
          btn.disabled = true;
          btn.textContent = 'Saving...';
        }

        try {
          await saveProfile(user);
        } catch (err) {
          console.error('Profile save error:', err);
          showMsg('error-message', 'Could not save profile. Please try again.');
        } finally {
          if (btn) {
            btn.disabled = false;
            btn.textContent = 'Save Changes';
          }
        }
      });
    }
  });
});
