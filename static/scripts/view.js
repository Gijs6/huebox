function slugify(name) {
    return name
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9-]/g, "");
}

document.querySelectorAll(".palette-strip__swatch").forEach((swatch) => {
    swatch.addEventListener("click", async () => {
        if (await copyText(swatch.dataset.hex)) {
            window.toast("Copied " + swatch.dataset.hex, { type: "success" });
        }
    });
});

document.getElementById("copyLinkButton").addEventListener("click", async () => {
    if (await copyText(window.location.href)) {
        window.toast("Link copied", { type: "success" });
    }
});

document.getElementById("copyCssButton").addEventListener("click", async () => {
    const slug = slugify(paletteName);
    const vars = paletteColors.map((hex, index) => `  --color-${slug}-${index + 1}: ${hex};`).join("\n");
    if (await copyText(`:root {\n${vars}\n}`)) {
        window.toast("CSS copied", { type: "success" });
    }
});

document.getElementById("copyJsonButton").addEventListener("click", async () => {
    const payload = JSON.stringify({ name: paletteName, colors: paletteColors }, null, 2);
    if (await copyText(payload)) {
        window.toast("JSON copied", { type: "success" });
    }
});
