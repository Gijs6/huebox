(function () {
    const container = document.getElementById("messages-container");
    container.querySelectorAll("[data-flash]").forEach((el) => {
        setTimeout(() => {
            el.classList.remove("toast--visible");
            setTimeout(() => el.remove(), 200);
        }, 4000);
    });
    window.showToast = function (msg, type) {
        const el = document.createElement("div");
        el.className = "toast" + (type ? " toast--" + type : "");
        el.textContent = msg;
        container.appendChild(el);
        requestAnimationFrame(() => el.classList.add("toast--visible"));
        setTimeout(() => {
            el.classList.remove("toast--visible");
            setTimeout(() => el.remove(), 200);
        }, 1600);
    };
})();
