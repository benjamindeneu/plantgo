// Extracted from index.html (menu + beforeunload)
window.addEventListener('beforeunload', function (e) {
      e.preventDefault();
      e.returnValue = '';
    });
    const userBtn = document.getElementById("userBtn");
    const userMenu = document.getElementById("userMenu");

    userBtn.addEventListener("click", function() {
      const open = userMenu.style.display === "block";
      userMenu.style.display = open ? "none" : "block";
      userBtn.setAttribute("aria-expanded", String(!open));
    });

    document.addEventListener("click", function(event) {
      if (!userBtn.contains(event.target) && !userMenu.contains(event.target)) {
        userMenu.style.display = "none";
        userBtn.setAttribute("aria-expanded", "false");
      }
    });