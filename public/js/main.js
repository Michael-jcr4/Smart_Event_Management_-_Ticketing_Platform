// Small progressive enhancements. Kept in a separate file (not inline handlers)
// so the Content-Security-Policy can block inline scripts.

document.addEventListener("click", (e) => {
  const button = e.target.closest("[data-toggle-password]");
  if (!button) return;
  const input = document.getElementById(button.dataset.togglePassword);
  if (!input) return;
  const show = input.type === "password";
  input.type = show ? "text" : "password";
  button.textContent = show ? "Hide" : "Show";
  button.setAttribute("aria-label", show ? "Hide password" : "Show password");
});

document.addEventListener("submit", (e) => {
  const form = e.target.closest("form[data-confirm]");
  if (form && !window.confirm(form.dataset.confirm)) {
    e.preventDefault();
  }
});
