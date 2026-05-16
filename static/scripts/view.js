document.querySelectorAll(".palette-view__swatch-name").forEach((el) => {
    el.textContent = colorName(el.dataset.hex);
});

document.querySelectorAll(".palette-view__swatch").forEach((el) => {
    el.addEventListener("click", async () => {
        if (await copyText(el.dataset.hex)) window.showToast("Copied " + el.dataset.hex);
    });
});

document.getElementById("copyLinkBtn").addEventListener("click", async () => {
    if (await copyText(window.location.href)) window.showToast("Link copied");
});

document.getElementById("viewCssBtn").addEventListener("click", async () => {
    const slug = paletteName
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9-]/g, "");
    const vars = colors.map((c, i) => `  --color-${slug}-${i + 1}: ${c};`).join("\n");
    if (await copyText(`:root {\n${vars}\n}`)) window.showToast("CSS copied");
});

document.getElementById("viewJsonBtn").addEventListener("click", async () => {
    if (await copyText(JSON.stringify({ name: paletteName, colors }, null, 2))) window.showToast("JSON copied");
});
