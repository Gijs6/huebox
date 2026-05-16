const addBtn = document.getElementById("addColorBtn");
const list = document.getElementById("colorList");

let saveDraft = () => {};

function relLum(hex) {
    return [1, 3, 5].reduce((acc, i, j) => {
        let v = parseInt(hex.slice(i, i + 2), 16) / 255;
        v = v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
        return acc + v * [0.2126, 0.7152, 0.0722][j];
    }, 0);
}

function contrastRatio(a, b) {
    const [l1, l2] = [relLum(a), relLum(b)].sort((x, y) => y - x);
    return (l1 + 0.05) / (l2 + 0.05);
}

const picker = (() => {
    const el = document.createElement("div");
    el.className = "color-picker";
    el.hidden = true;

    const svEl = document.createElement("div");
    svEl.className = "color-picker__sv";
    const canvas = document.createElement("canvas");
    canvas.className = "color-picker__canvas";
    const thumb = document.createElement("div");
    thumb.className = "color-picker__sv-thumb";
    svEl.append(canvas, thumb);

    const hueEl = document.createElement("input");
    hueEl.type = "range";
    hueEl.className = "color-picker__hue";
    hueEl.min = "0";
    hueEl.max = "359";
    hueEl.value = "0";
    hueEl.step = "1";

    const hexIn = document.createElement("input");
    hexIn.type = "text";
    hexIn.className = "color-picker__hex";
    hexIn.placeholder = "#000000";
    hexIn.maxLength = 7;

    el.append(svEl, hueEl, hexIn);
    document.body.appendChild(el);

    const ctx = canvas.getContext("2d");
    const SIZE = 192;
    canvas.width = SIZE;
    canvas.height = SIZE;

    let activeSlot = null;
    let h = 0, s = 1, v = 1;

    function drawSV() {
        const gH = ctx.createLinearGradient(0, 0, SIZE, 0);
        gH.addColorStop(0, "white");
        gH.addColorStop(1, `hsl(${h},100%,50%)`);
        ctx.fillStyle = gH;
        ctx.fillRect(0, 0, SIZE, SIZE);
        const gV = ctx.createLinearGradient(0, 0, 0, SIZE);
        gV.addColorStop(0, "rgba(0,0,0,0)");
        gV.addColorStop(1, "rgba(0,0,0,1)");
        ctx.fillStyle = gV;
        ctx.fillRect(0, 0, SIZE, SIZE);
    }

    function posThumb() {
        const r = svEl.getBoundingClientRect();
        thumb.style.left = `${s * r.width}px`;
        thumb.style.top = `${(1 - v) * r.height}px`;
    }

    function hsv2hex(hh, ss, vv) {
        const i = Math.floor(hh / 60) % 6;
        const f = (hh / 60) - Math.floor(hh / 60);
        const p = vv * (1 - ss);
        const q = vv * (1 - f * ss);
        const t = vv * (1 - (1 - f) * ss);
        const m = [
            [vv, t, p], [q, vv, p], [p, vv, t],
            [p, q, vv], [t, p, vv], [vv, p, q]
        ][i];
        return "#" + m.map(x => Math.round(x * 255).toString(16).padStart(2, "0")).join("");
    }

    function hex2hsv(hex) {
        const r = parseInt(hex.slice(1, 3), 16) / 255;
        const g = parseInt(hex.slice(3, 5), 16) / 255;
        const b = parseInt(hex.slice(5, 7), 16) / 255;
        const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
        let hh = 0;
        if (d) {
            if (max === r) hh = ((g - b) / d + 6) % 6;
            else if (max === g) hh = (b - r) / d + 2;
            else hh = (r - g) / d + 4;
            hh *= 60;
        }
        return { h: hh, s: max ? d / max : 0, v: max };
    }

    function commit() {
        const hex = hsv2hex(h, s, v);
        hexIn.value = hex;
        if (activeSlot) {
            activeSlot.querySelector(".color-slot__input").value = hex;
            activeSlot.querySelector(".color-slot__hex").textContent = hex;
            activeSlot.querySelector(".color-slot__name").textContent = colorName(hex);
            activeSlot.style.setProperty("--color", hex);
        }
        saveDraft();
    }

    hueEl.addEventListener("input", () => {
        h = +hueEl.value;
        drawSV();
        commit();
    });

    hexIn.addEventListener("input", () => {
        let val = hexIn.value.trim();
        if (!val.startsWith("#")) val = "#" + val;
        if (/^#[0-9a-f]{6}$/i.test(val)) {
            ({ h, s, v } = hex2hsv(val));
            hueEl.value = Math.round(h);
            drawSV();
            posThumb();
            commit();
        }
    });

    let dragging = false;

    function pickAt(e) {
        const r = svEl.getBoundingClientRect();
        s = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
        v = Math.max(0, Math.min(1, 1 - (e.clientY - r.top) / r.height));
        posThumb();
        commit();
    }
    svEl.addEventListener("mousedown", e => { dragging = true; pickAt(e); e.preventDefault(); });
    document.addEventListener("mousemove", e => { if (dragging) pickAt(e); });
    document.addEventListener("mouseup", () => { dragging = false; });

    function open(slot) {
        activeSlot = slot;
        const hex = slot.querySelector(".color-slot__input").value;
        ({ h, s, v } = hex2hsv(hex));
        hueEl.value = Math.round(h);
        el.hidden = false;
        drawSV();

        const sr = slot.getBoundingClientRect();
        const pw = el.offsetWidth || 208;
        const ph = el.offsetHeight || 260;
        let left = sr.left;
        let top = sr.bottom + 6;
        if (left + pw > window.innerWidth - 8) left = window.innerWidth - pw - 8;
        if (top + ph > window.innerHeight - 8) top = sr.top - ph - 6;
        el.style.left = left + "px";
        el.style.top = top + "px";

        requestAnimationFrame(posThumb);
    }

    function close() {
        el.hidden = true;
        activeSlot = null;
    }

    function closeIfActive(slot) {
        if (activeSlot === slot) close();
    }

    document.addEventListener("click", e => {
        if (!el.hidden && !el.contains(e.target) && !e.target.closest(".color-slot__swatch")) {
            close();
        }
    });

    return { open, close, closeIfActive };
})();

function createSlot(hex) {
    const li = document.createElement("li");
    li.className = "color-slot";
    li.setAttribute("draggable", "true");
    li.style.setProperty("--color", hex);

    const swatch = document.createElement("div");
    swatch.className = "color-slot__swatch";

    const input = document.createElement("input");
    input.type = "hidden";
    input.name = "colors";
    input.value = hex;
    input.className = "color-slot__input";

    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "color-slot__remove";
    removeBtn.setAttribute("aria-label", "Remove");
    const xIcon = document.createElement("i");
    xIcon.className = "fa-solid fa-xmark";
    removeBtn.appendChild(xIcon);

    swatch.append(input, removeBtn);

    const hexBtn = document.createElement("button");
    hexBtn.type = "button";
    hexBtn.className = "color-slot__hex";
    hexBtn.title = "Copy hex value";
    hexBtn.textContent = hex;

    const nameEl = document.createElement("span");
    nameEl.className = "color-slot__name";
    nameEl.textContent = colorName(hex);

    li.append(swatch, hexBtn, nameEl);
    return li;
}

function wireSlot(li) {
    const input = li.querySelector(".color-slot__input");
    const hexBtn = li.querySelector(".color-slot__hex");
    const remove = li.querySelector(".color-slot__remove");
    const swatch = li.querySelector(".color-slot__swatch");
    const nameEl = li.querySelector(".color-slot__name");

    if (!nameEl.textContent) nameEl.textContent = colorName(input.value);

    swatch.addEventListener("click", e => {
        if (remove.contains(e.target)) return;
        picker.open(li);
    });

    hexBtn.addEventListener("click", async () => {
        if (await copyText(input.value)) window.showToast("Copied " + input.value);
    });

    remove.addEventListener("click", () => {
        picker.closeIfActive(li);
        li.remove();
        saveDraft();
    });
}

list.querySelectorAll(".color-slot").forEach(wireSlot);

addBtn.addEventListener("click", () => {
    const hex = "#" + Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, "0");
    const li = createSlot(hex);
    list.appendChild(li);
    wireSlot(li);
    wireDrag(li);
    picker.open(li);
    saveDraft();
});

let dragged = null;

function wireDrag(li) {
    li.addEventListener("dragstart", e => {
        dragged = li;
        e.dataTransfer.effectAllowed = "move";
        setTimeout(() => li.classList.add("color-slot--dragging"), 0);
    });

    li.addEventListener("dragend", () => {
        li.classList.remove("color-slot--dragging");
        list.querySelectorAll(".color-slot--over").forEach(el =>
            el.classList.remove("color-slot--over")
        );
        dragged = null;
        saveDraft();
    });

    li.addEventListener("dragover", e => {
        e.preventDefault();
        if (!dragged || dragged === li) return;
        list.querySelectorAll(".color-slot--over").forEach(el =>
            el.classList.remove("color-slot--over")
        );
        li.classList.add("color-slot--over");
        const rect = li.getBoundingClientRect();
        if (e.clientX < rect.left + rect.width / 2) {
            list.insertBefore(dragged, li);
        } else {
            list.insertBefore(dragged, li.nextSibling);
        }
    });
}

list.querySelectorAll(".color-slot").forEach(wireDrag);

function getColors() {
    return [...list.querySelectorAll(".color-slot__input")].map(p => p.value);
}

function getPaletteName() {
    return document.querySelector(".palette-editor__name").value || "palette";
}

const exportCssBtn = document.getElementById("exportCssBtn");
const exportJsonBtn = document.getElementById("exportJsonBtn");

exportCssBtn?.addEventListener("click", async () => {
    const slug = getPaletteName().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
    const vars = getColors().map((c, i) => `  --color-${slug}-${i + 1}: ${c};`).join("\n");
    if (await copyText(`:root {\n${vars}\n}`)) window.showToast("CSS copied");
});

exportJsonBtn?.addEventListener("click", async () => {
    const obj = { name: getPaletteName(), colors: getColors() };
    if (await copyText(JSON.stringify(obj, null, 2))) window.showToast("JSON copied");
});

const contrastBtn = document.getElementById("contrastBtn");
const contrastPanel = document.getElementById("contrastPanel");
const contrastInner = document.getElementById("contrastInner");

function makeContrastHeader(color, label) {
    const th = document.createElement("th");
    const swatch = document.createElement("span");
    swatch.className = "contrast-swatch";
    swatch.style.background = color;
    const hexSpan = document.createElement("span");
    hexSpan.className = "contrast-hex";
    hexSpan.textContent = label;
    th.append(swatch, document.createElement("br"), hexSpan);
    return th;
}

function buildContrastTable() {
    const palette = getColors();
    contrastInner.textContent = "";

    if (!palette.length) {
        const p = document.createElement("p");
        p.className = "contrast-empty";
        p.textContent = "No colors yet.";
        contrastInner.appendChild(p);
        return;
    }

    const cols = [...palette, "#000000", "#ffffff"];
    const labels = [...palette, "Black", "White"];
    const BADGE = { aaa: "AAA", aa: "AA", large: "AA+", fail: "✗" };

    const table = document.createElement("table");
    table.className = "contrast-table";

    const thead = document.createElement("thead");
    const headerRow = document.createElement("tr");
    headerRow.appendChild(document.createElement("th"));
    for (let j = 0; j < cols.length; j++) {
        headerRow.appendChild(makeContrastHeader(cols[j], labels[j]));
    }
    thead.appendChild(headerRow);
    table.appendChild(thead);

    const tbody = document.createElement("tbody");
    for (let i = 0; i < cols.length; i++) {
        const row = document.createElement("tr");
        row.appendChild(makeContrastHeader(cols[i], labels[i]));

        for (let j = 0; j < cols.length; j++) {
            const td = document.createElement("td");
            if (i === j) {
                td.className = "contrast-cell--skip";
                td.textContent = "—";
            } else {
                const ratio = contrastRatio(cols[i], cols[j]);
                let cls = "fail";
                if (ratio >= 7) cls = "aaa";
                else if (ratio >= 4.5) cls = "aa";
                else if (ratio >= 3) cls = "large";
                td.className = `contrast-cell contrast-cell--${cls}`;
                td.title = `${ratio.toFixed(2)}:1`;
                td.textContent = ratio.toFixed(2);
                const badge = document.createElement("span");
                badge.className = "contrast-badge";
                badge.textContent = BADGE[cls];
                td.append(document.createElement("br"), badge);
            }
            row.appendChild(td);
        }
        tbody.appendChild(row);
    }
    table.appendChild(tbody);
    contrastInner.appendChild(table);
}

contrastBtn.addEventListener("click", () => {
    contrastPanel.hidden = !contrastPanel.hidden;
    if (!contrastPanel.hidden) buildContrastTable();
});

if (isNewPalette) {
    const DRAFT_KEY = "huebox-draft";

    saveDraft = function() {
        localStorage.setItem(DRAFT_KEY, JSON.stringify({
            name: document.querySelector(".palette-editor__name").value,
            colors: getColors(),
        }));
    };

    (function() {
        const raw = localStorage.getItem(DRAFT_KEY);
        if (!raw) return;
        try {
            const { name, colors } = JSON.parse(raw);
            if (name) document.querySelector(".palette-editor__name").value = name;
            if (colors?.length) {
                list.innerHTML = "";
                for (const hex of colors) {
                    const li = createSlot(hex);
                    list.appendChild(li);
                    wireSlot(li);
                    wireDrag(li);
                }
            }
        } catch {}
    })();

    document.querySelector(".palette-editor__name").addEventListener("input", saveDraft);

    document.getElementById("palette-editor").addEventListener("submit", () => {
        localStorage.removeItem(DRAFT_KEY);
    });
}

const isPublicInput = document.querySelector("[name='is_public']");
const visIcon = document.querySelector(".toggle__vis-icon");
const visText = document.querySelector(".toggle__vis-text");

function updateVisibility() {
    const pub = isPublicInput.checked;
    visIcon.classList.remove("fa-globe", "fa-lock");
    visIcon.classList.add(pub ? "fa-globe" : "fa-lock");
    visText.textContent = pub ? "Public" : "Private";
}
updateVisibility();
isPublicInput.addEventListener("change", updateVisibility);
