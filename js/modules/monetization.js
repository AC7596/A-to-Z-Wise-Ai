// ========================================
// MONETIZATION & CHECKOUT MODULE
// ========================================
import { getCheckoutUrl } from '../checkout-config.js';

/**
 * Initializes pricing section triggers and checkout modal interactions.
 */
export function initMonetization() {
  const modal = document.getElementById('checkoutModal');
  const modalCloseBtns = document.querySelectorAll('[data-action="close-checkout-modal"]');
  const checkoutButtons = document.querySelectorAll('[data-action="checkout"]');

  function isConfiguredUrl(urlStr) {
    if (!urlStr || typeof urlStr !== 'string') return false;
    const trimmed = urlStr.trim();
    if (!trimmed) return false;
    try {
      const parsed = new URL(trimmed);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;
      if (parsed.hostname === 'example.com' || parsed.hostname.endsWith('.example.com')) return false;
      if (trimmed.toLowerCase().includes('your_payment_link') || trimmed.toLowerCase().includes('placeholder')) return false;
      return true;
    } catch {
      return false;
    }
  }

  function handleCheckout(e) {
    if (e) e.preventDefault();
    const checkoutUrl = getCheckoutUrl();

    const paymentLink = document.getElementById('openPayPalCheckout');
    const available = isConfiguredUrl(checkoutUrl);
    paymentLink.hidden = !available;
    if (available) paymentLink.href = checkoutUrl;
    document.getElementById('checkoutInstructions').textContent = available
      ? 'PayPal opens in a new tab. After paying $9.99 for your monthly membership, come back here to sign in with your PayPal email.'
      : 'Checkout is temporarily unavailable. If you already paid, open member access below.';
    openCheckoutModal();
  }

  function openCheckoutModal() {
    if (modal) {
      modal.hidden = false;
      modal.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
      const focusBtn = modal.querySelector('button, a');
      if (focusBtn) focusBtn.focus();
    }
  }

  function closeCheckoutModal() {
    if (modal) {
      modal.hidden = true;
      modal.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
    }
  }

  checkoutButtons.forEach(btn => {
    btn.addEventListener('click', handleCheckout);
  });

  modalCloseBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      closeCheckoutModal();
    });
  });

  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal || e.target.classList.contains('checkout-modal-backdrop')) {
        closeCheckoutModal();
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !modal.hidden) {
        closeCheckoutModal();
      }
    });
  }
}
