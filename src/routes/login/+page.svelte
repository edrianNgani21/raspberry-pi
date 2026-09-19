<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';

  let email = $state('');
  let loading = $state(false);
  let error = $state('');

  async function handleLogin(e: Event) {
    e.preventDefault();
    if (!email) return;

    loading = true;
    error = '';

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });

      if (res.ok) {
        // Redirect to OTP page with email in query param
        goto(`/otp?email=${encodeURIComponent(email)}`);
      } else {
        const data = await res.json();
        error = data.error || 'Failed to send login link';
      }
    } catch (err) {
      error = 'A network error occurred. Please try again.';
    } finally {
      loading = false;
    }
  }
</script>

<svelte:head>
  <title>Sign In — GateQR | Liceo de Cagayan University</title>
  <meta name="description" content="Sign in to GateQR to manage your vehicle parking sticker application at Liceo de Cagayan University." />
</svelte:head>

<div class="login-page">
  <div class="bg-glow"></div>

  <div class="login-card">
    <div class="login-brand">
      <div class="login-logo">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="3" width="7" height="7" rx="1"/>
          <rect x="14" y="3" width="7" height="7" rx="1"/>
          <rect x="3" y="14" width="7" height="7" rx="1"/>
          <circle cx="17.5" cy="17.5" r="2.5"/>
        </svg>
      </div>
      <div>
        <h1 class="login-title">GateQR</h1>
        <p class="login-university">Liceo de Cagayan University</p>
      </div>
    </div>

    <div class="login-divider"></div>

    <form class="login-form" onsubmit={handleLogin}>
      <p class="login-desc">
        Enter your Liceo email address to sign in. Visitors may use a personal email.
        A secure login code will be sent to your inbox.
      </p>

      {#if error}
        <div class="error-msg">{error}</div>
      {/if}

      <div class="field-group">
        <label class="field-label" for="email">Email address</label>
        <div class="input-wrap">
          <svg class="input-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
            <polyline points="22,6 12,13 2,6"/>
          </svg>
          <input
            id="email"
            type="email"
            bind:value={email}
            placeholder="email@liceo.edu.ph"
            autocomplete="email"
            required
            disabled={loading}
          />
        </div>
      </div>

      <button type="submit" class="login-btn" disabled={loading}>
        <span>{loading ? 'Sending...' : 'Send Login Code'}</span>
        {#if !loading}
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
        {/if}
      </button>
    </form>

    <p class="login-footer">
      Having trouble? Contact
      <a href="mailto:osa@liceo.edu.ph" class="footer-link">osa@liceo.edu.ph</a>
    </p>
  </div>
</div>

<style>
  .login-page {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 2rem 1.25rem;
    background: linear-gradient(135deg, var(--maroon-deep) 0%, var(--maroon-dark) 50%, var(--maroon) 100%);
    position: relative;
    overflow: hidden;
  }

  .bg-glow {
    position: absolute;
    width: 500px;
    height: 500px;
    background: radial-gradient(circle, rgba(201,162,39,0.12) 0%, transparent 70%);
    top: -100px;
    right: -100px;
    pointer-events: none;
  }

  .login-card {
    background: var(--surface);
    border-radius: var(--radius-lg);
    padding: 2.5rem 2rem;
    width: 100%;
    max-width: 420px;
    box-shadow: var(--shadow-lg), 0 0 0 1px rgba(255,255,255,0.05);
    position: relative;
    z-index: 1;
  }

  .login-brand {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin-bottom: 0.25rem;
  }

  .login-logo {
    width: 52px;
    height: 52px;
    background: linear-gradient(135deg, var(--maroon-dark), var(--maroon));
    border-radius: var(--radius-md);
    display: flex;
    align-items: center;
    justify-content: center;
    color: #fff;
    box-shadow: 0 4px 12px rgba(107,26,42,0.35);
    flex-shrink: 0;
  }

  .login-title {
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--maroon);
    letter-spacing: -0.03em;
    margin: 0;
    line-height: 1;
  }

  .login-university {
    font-size: 0.72rem;
    color: var(--text-muted);
    margin: 0.2rem 0 0;
    font-weight: 500;
  }

  .login-divider {
    height: 1px;
    background: var(--border-light);
    margin: 1.5rem 0;
  }

  .login-form {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }

  .login-desc {
    font-size: 0.82rem;
    color: var(--text-secondary);
    line-height: 1.6;
    margin: 0;
  }

  .error-msg {
    color: #b91c1c;
    background: #fef2f2;
    border: 1px solid #fca5a5;
    padding: 0.5rem;
    border-radius: var(--radius-sm);
    font-size: 0.8rem;
  }

  .field-group {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }

  .field-label {
    font-size: 0.78rem;
    font-weight: 600;
    color: var(--text-secondary);
    letter-spacing: 0.02em;
  }

  .input-wrap {
    position: relative;
  }

  .input-icon {
    position: absolute;
    left: 0.75rem;
    top: 50%;
    transform: translateY(-50%);
    color: var(--text-muted);
    pointer-events: none;
  }

  .input-wrap input {
    padding-left: 2.5rem;
  }

  .login-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 0.875rem 1.5rem;
    background: linear-gradient(135deg, var(--maroon-dark), var(--maroon));
    color: #fff;
    font-size: 0.875rem;
    font-weight: 600;
    border-radius: var(--radius-sm);
    text-decoration: none;
    box-shadow: 0 4px 14px rgba(107,26,42,0.35);
    transition: opacity 0.2s, transform 0.2s, box-shadow 0.2s;
    border: none;
    cursor: pointer;
  }

  .login-btn:hover:not(:disabled) {
    opacity: 0.9;
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(107,26,42,0.4);
  }

  .login-btn:active:not(:disabled) {
    transform: translateY(0);
  }
  
  .login-btn:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }

  .login-footer {
    margin-top: 1.5rem;
    font-size: 0.75rem;
    color: var(--text-muted);
    text-align: center;
  }

  .footer-link {
    color: var(--maroon);
    font-weight: 600;
    text-decoration: none;
  }

  .footer-link:hover {
    text-decoration: underline;
  }
</style>