// auth.js — Firebase Authentication for Login and Signup

import { auth, db } from './firebase.js';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile
} from 'https://www.gstatic.com/firebasejs/10.13.1/firebase-auth.js';
import { doc, setDoc } from 'https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js';
import { sendLoginOtpEmail } from './email.js';

function generateOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function otpKeyForUid(uid) {
  return `login_otp:${String(uid || '')}`;
}

function otpVerifiedKeyForUid(uid) {
  return `login_otp_verified:${String(uid || '')}`;
}

function setOtpVerified(uid, ok) {
  const key = otpVerifiedKeyForUid(uid);
  if (ok) sessionStorage.setItem(key, '1');
  else sessionStorage.removeItem(key);
}

function setOtp(uid, otp, ttlMs) {
  const payload = {
    otp: String(otp || ''),
    exp: Date.now() + (Number(ttlMs) || 0)
  };
  sessionStorage.setItem(otpKeyForUid(uid), JSON.stringify(payload));
}

function getOtp(uid) {
  const raw = sessionStorage.getItem(otpKeyForUid(uid));
  if (!raw) return null;
  try {
    const json = JSON.parse(raw);
    if (!json || !json.otp || !json.exp) return null;
    if (Date.now() > Number(json.exp)) return null;
    return { otp: String(json.otp), exp: Number(json.exp) };
  } catch (e) {
    return null;
  }
}

function isOtpVerified(uid) {
  return sessionStorage.getItem(otpVerifiedKeyForUid(uid)) === '1';
}

function isOtpPending(uid) {
  return !!sessionStorage.getItem(otpKeyForUid(uid));
}

function clearOtp(uid) {
  sessionStorage.removeItem(otpKeyForUid(uid));
}

function show(el, on) {
  if (!el) return;
  el.style.display = on ? 'block' : 'none';
}

function getHomeHref() {
  const isPages = location.pathname.includes('/pages/');
  return isPages ? '../index.html' : 'index.html';
}

function getPageHref(page) {
  const isPages = location.pathname.includes('/pages/');
  const p = isPages ? page : `pages/${page}`;
  return window.resolveRoot ? window.resolveRoot(p) : p;
}

function applyNavAuthUI(user) {
  const ready = !!user && (!isOtpPending(user.uid) || isOtpVerified(user.uid));

  const ordersLi = document.getElementById('nav-orders-li');
  const profileLi = document.getElementById('nav-profile-li');
  const loginLi = document.getElementById('nav-login-li');
  const signupLi = document.getElementById('nav-signup-li');
  const logoutLi = document.getElementById('nav-logout-li');

  if (ordersLi) ordersLi.style.display = ready ? '' : 'none';
  if (profileLi) profileLi.style.display = ready ? '' : 'none';
  if (logoutLi) logoutLi.style.display = ready ? '' : 'none';
  if (loginLi) loginLi.style.display = ready ? 'none' : '';
  if (signupLi) signupLi.style.display = ready ? 'none' : '';

  const ordersLink = document.getElementById('nav-orders-link');
  const profileLink = document.getElementById('nav-profile-link');
  const profileName = document.getElementById('nav-profile-name');
  const loginLink = document.getElementById('nav-login-link');
  const signupLink = document.getElementById('nav-signup-link');

  if (ordersLink) ordersLink.href = getPageHref('orders.html');
  if (profileLink) profileLink.href = getPageHref('profile.html');

  if (profileName) {
    const label = ready ? String(user.displayName || '').trim() : '';
    const fallback = ready ? String(user.email || '').trim() : '';
    profileName.textContent = label || fallback || '';
  }

  if (loginLink) loginLink.href = getPageHref('login.html');
  if (signupLink) signupLink.href = getPageHref('signup.html');
}

function initNavAuthUI() {
  let lastUser = null;

  function apply() {
    applyNavAuthUI(lastUser);
    const logoutLink = document.getElementById('nav-logout-link');
    if (logoutLink && !logoutLink.dataset.bound) {
      logoutLink.dataset.bound = '1';
      logoutLink.addEventListener('click', (e) => {
        e.preventDefault();
        if (window.logout) window.logout();
      });
    }
  }

  onAuthStateChanged(auth, (user) => {
    lastUser = user;
    apply();
  });

  if (!document.getElementById('navMenu')) {
    try {
      const mo = new MutationObserver(() => {
        if (document.getElementById('navMenu')) {
          mo.disconnect();
          apply();
        }
      });
      mo.observe(document.body, { childList: true, subtree: true });
      setTimeout(() => { try { mo.disconnect(); } catch (e) {} apply(); }, 8000);
    } catch (e) {
      setTimeout(apply, 0);
    }
  }
}

// Login functionality
function initLogin() {
  const loginForm = document.getElementById('login-form');
  if (!loginForm) return;

  const otpForm = document.getElementById('otp-form');
  const resendLink = document.getElementById('resend-otp-link');
  const verifyBtn = document.getElementById('verify-otp-btn');

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    const errorMessage = document.getElementById('error-message');
    const successMessage = document.getElementById('success-message');

    // Hide previous messages
    errorMessage.style.display = 'none';
    successMessage.style.display = 'none';

    // Inline button loading spinner
    const submitBtn = loginForm.querySelector('button[type="submit"]');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.classList.add('loading');
      const spinner = document.createElement('span'); spinner.className = 'btn-spinner'; spinner.setAttribute('aria-hidden','true');
      submitBtn.appendChild(spinner);
    }

    try {
      // Show global overlay loader
      if (window.showLoader) window.showLoader('Signing in...', 'Authenticating');

      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // OTP flow disabled: consider the user verified and redirect
      setOtpVerified(user.uid, true);
      try { clearOtp(user.uid); } catch(e) {}

      successMessage.textContent = 'Login successful! Redirecting...';
      successMessage.style.display = 'block';

      // Convert button to success state (remove spinner, show check)
      if (submitBtn) {
        const sp = submitBtn.querySelector('.btn-spinner'); if (sp) sp.remove();
        submitBtn.classList.add('success');
        const check = document.createElement('span'); check.className = 'btn-check'; check.textContent = '✓'; check.setAttribute('aria-hidden','true');
        submitBtn.appendChild(check);
      }

      // Wait briefly to show success animation and then redirect
      await new Promise(r => setTimeout(r, 800));
      if (window.hideLoader) window.hideLoader();
      const urlParams = new URLSearchParams(window.location.search);
      const redirect = urlParams.get('redirect') || '../pages/checkout.html';
      window.location.href = redirect;

    } catch (error) {
      if (window.hideLoader) window.hideLoader();

      let errorMsg = 'Login failed. Please try again.';

      switch (error.code) {
        case 'auth/user-not-found':
          errorMsg = 'No account found with this email address.';
          break;
        case 'auth/wrong-password':
          errorMsg = 'Incorrect password. Please try again.';
          break;
        case 'auth/invalid-email':
          errorMsg = 'Please enter a valid email address.';
          break;
        case 'auth/user-disabled':
          errorMsg = 'This account has been disabled.';
          break;
        case 'auth/too-many-requests':
          errorMsg = 'Too many failed login attempts. Please try again later.';
          break;
      }

      errorMessage.textContent = errorMsg;
      errorMessage.style.display = 'block';
    } finally {
      try { if (submitBtn) { submitBtn.disabled = false; submitBtn.classList.remove('loading'); const sp = submitBtn.querySelector('.btn-spinner'); if (sp) sp.remove(); const chk = submitBtn.querySelector('.btn-check'); if (chk) chk.remove(); submitBtn.classList.remove('success'); } } catch(e) {}
      if (window.hideLoader) window.hideLoader();
    }
  });

  if (otpForm) {
    // OTP form present but OTP flow is disabled — keep hidden for backward compatibility
    try { show(otpForm, false); } catch(e) {}
  }

  if (resendLink) {
    // OTP flow disabled — no-op
  }
}

// Signup functionality
function initSignup() {
  const signupForm = document.getElementById('signup-form');
  if (!signupForm) return;

  signupForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const firstName = (document.getElementById('firstName').value || '').trim();
    const lastName = (document.getElementById('lastName').value || '').trim();
    const email = (document.getElementById('email').value || '').trim();
    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirmPassword').value;

    const errorMessage = document.getElementById('error-message');
    const successMessage = document.getElementById('success-message');

    // Hide previous messages
    errorMessage.style.display = 'none';
    successMessage.style.display = 'none';

    // Validate passwords match
    if (password !== confirmPassword) {
      errorMessage.textContent = 'Passwords do not match.';
      errorMessage.style.display = 'block';
      return;
    }

    // Validate password length
    if (password.length < 6) {
      errorMessage.textContent = 'Password must be at least 6 characters long.';
      errorMessage.style.display = 'block';
      return;
    }

    // Inline button loading spinner
    const submitBtn = signupForm.querySelector('button[type="submit"]');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.classList.add('loading');
      const spinner = document.createElement('span'); spinner.className = 'btn-spinner'; spinner.setAttribute('aria-hidden','true');
      submitBtn.appendChild(spinner);
    }

    try {
      if (window.showLoader) window.showLoader('Creating account...', 'Finishing up');

      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Update display name
      await updateProfile(user, {
        displayName: `${firstName} ${lastName}`
      });

      // Create user document in Firestore
      await setDoc(doc(db, 'users', user.uid), {
        firstName,
        lastName,
        email,
        createdAt: new Date(),
        uid: user.uid
      });

      successMessage.textContent = 'Account created successfully! Redirecting...';
      successMessage.style.display = 'block';

      // Button success state
      if (submitBtn) {
        const sp = submitBtn.querySelector('.btn-spinner'); if (sp) sp.remove();
        submitBtn.classList.add('success');
        const check = document.createElement('span'); check.className = 'btn-check'; check.textContent = '✓'; check.setAttribute('aria-hidden','true');
        submitBtn.appendChild(check);
      }

      // Wait briefly, hide loader, then redirect
      await new Promise(r => setTimeout(r, 900));
      if (window.hideLoader) window.hideLoader();

      setTimeout(() => {
        const urlParams = new URLSearchParams(window.location.search);
        const redirect = urlParams.get('redirect') || '../pages/checkout.html';
        window.location.href = redirect;
      }, 400);

    } catch (error) {
      if (window.hideLoader) window.hideLoader();
      console.error('Signup error:', error);
      const code = (error && error.code) ? String(error.code) : '';
      const msg = (error && error.message) ? String(error.message) : '';
      let errorMsg = 'Account creation failed. Please try again.';

      switch (code) {
        case 'auth/email-already-in-use':
          errorMsg = 'An account with this email already exists.';
          break;
        case 'auth/invalid-email':
          errorMsg = 'Please enter a valid email address.';
          break;
        case 'auth/weak-password':
          errorMsg = 'Password is too weak. Please choose a stronger password.';
          break;
        case 'auth/configuration-not-found':
          errorMsg = 'Signup is not configured for this Firebase project. In Firebase Console → Authentication, click “Get started” and enable Email/Password. If you restricted your API key, allow Identity Toolkit API and add your domain (e.g. localhost) to allowed referrers.';
          break;
        case 'auth/operation-not-allowed':
          errorMsg = 'Email/password signup is disabled in Firebase Auth.';
          break;
        case 'auth/unauthorized-domain':
          errorMsg = 'This domain is not authorized for Firebase Auth. Add it in Firebase Console → Authentication → Settings → Authorized domains.';
          break;
        case 'auth/invalid-api-key':
          errorMsg = 'Invalid Firebase API key. Please check your Firebase config.';
          break;
        case 'auth/network-request-failed':
          errorMsg = 'Network error. Check your internet connection and try again.';
          break;
        default:
          if (code) errorMsg = `${errorMsg} (${code})`;
          else if (msg) errorMsg = msg;
          break;
      }

      errorMessage.textContent = errorMsg;
      errorMessage.style.display = 'block';
    } finally {
      try { if (submitBtn) { submitBtn.disabled = false; submitBtn.classList.remove('loading'); const sp = submitBtn.querySelector('.btn-spinner'); if (sp) sp.remove(); const chk = submitBtn.querySelector('.btn-check'); if (chk) chk.remove(); submitBtn.classList.remove('success'); } } catch(e) {}
      if (window.hideLoader) window.hideLoader();
    }
  });
}

// Logout functionality
function logout() {
  const u = auth.currentUser;
  try {
    if (u) {
      setOtpVerified(u.uid, false);
      clearOtp(u.uid);
    }
  } catch (e) {}

  signOut(auth).then(() => {
    window.location.href = getHomeHref();
  }).catch((error) => {
    console.error('Logout error:', error);
  });
}

// Check authentication state
function checkAuthState(callback) {
  onAuthStateChanged(auth, (user) => {
    callback(user);
  });
}

// Initialize auth functionality based on current page
document.addEventListener('DOMContentLoaded', () => {
  initNavAuthUI();
  if (window.location.pathname.includes('login.html')) {
    initLogin();
  } else if (window.location.pathname.includes('signup.html')) {
    initSignup();
  }
});

// Export functions for global use
window.logout = logout;
window.checkAuthState = checkAuthState;