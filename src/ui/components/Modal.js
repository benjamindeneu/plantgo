export function Modal({ title = "", content = "" }) {
  const overlay = document.createElement("div");
  overlay.className = "modal show";
  overlay.setAttribute("role", "dialog");
  overlay.innerHTML = `
    <div class="modal-content">
      ${title ? `<h2>${title}</h2>` : ""}
      <div class="body"></div>
      <div class="result-actions">
        <button class="primary" id="doneBtn" type="button">OK</button>
      </div>
    </div>`;

  const bodyEl = overlay.querySelector(".body");
  if (content instanceof Element || content instanceof DocumentFragment) {
    bodyEl.appendChild(content);
  } else {
    bodyEl.innerHTML = content;
  }

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
