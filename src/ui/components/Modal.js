export function Modal({ title = "", content = "" }) {
  const overlay = document.createElement("div");
  overlay.className = "modal show";
  overlay.setAttribute("role", "dialog");
  overlay.innerHTML = `
    <div class="modal-content">
      <h2>${title}</h2>
      <div class="body">${content}</div>
      <div class="result-actions">
        <button class="primary" id="doneBtn" type="button">OK</button>
      </div>
    </div>`;

  document.body.style.overflow = "hidden";

  function close() {
    overlay.remove();
    // Restore scroll only if no other modals remain open
    if (!document.querySelector(".modal.show")) {
      document.body.style.overflow = "";
    }
  }

  overlay.querySelector("#doneBtn").addEventListener("click", close);
  return overlay;
}
