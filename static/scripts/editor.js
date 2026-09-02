const addColorButton = document.getElementById("addColorButton");
const list = document.getElementById("colorList");
const nameInput = document.querySelector(".editor__name");

let saveDraft = () => {};
let rebuildContrast = () => {};

function relativeLuminance(hex) {
    return [1, 3, 5].reduce((acc, offset, channel) => {
        let value = parseInt(hex.slice(offset, offset + 2), 16) / 255;
        value = value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
        return acc + value * [0.2126, 0.7152, 0.0722][channel];
    }, 0);
}

function contrastRatio(a, b) {
    const [lighter, darker] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
    return (lighter + 0.05) / (darker + 0.05);
}

function removeIcon() {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("class", "icon");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("stroke-width", "2");
    svg.setAttribute("stroke-linecap", "round");
    svg.setAttribute("stroke-linejoin", "round");
    svg.setAttribute("aria-hidden", "true");
    for (const definition of ["M18 6 6 18", "m6 6 12 12"]) {
        const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        path.setAttribute("d", definition);
        svg.appendChild(path);
    }
    return svg;
}

function randomHex() {
    return (
        "#" +
        Math.floor(Math.random() * 0xffffff)
            .toString(16)
            .padStart(6, "0")
    );
}

const picker = (() => {
    const element = document.createElement("div");
    element.className = "color-picker";
    element.hidden = true;

    const area = document.createElement("div");
    area.className = "color-picker__area";
    const canvas = document.createElement("canvas");
    canvas.className = "color-picker__canvas";
    const thumb = document.createElement("div");
    thumb.className = "color-picker__thumb";
    area.append(canvas, thumb);

    const hueInput = document.createElement("input");
    hueInput.type = "range";
    hueInput.className = "color-picker__hue";
    hueInput.min = "0";
    hueInput.max = "359";
    hueInput.value = "0";
    hueInput.step = "1";
    hueInput.setAttribute("aria-label", "Hue");

    const hexInput = document.createElement("input");
    hexInput.type = "text";
    hexInput.className = "color-picker__hex";
    hexInput.placeholder = "#000000";
    hexInput.maxLength = 7;
    hexInput.setAttribute("aria-label", "Hex value");

    element.append(area, hueInput, hexInput);
    document.body.appendChild(element);

    const context = canvas.getContext("2d");
    const size = 192;
    canvas.width = size;
    canvas.height = size;

    let activeSlot = null;
    let hue = 0;
    let saturation = 1;
    let brightness = 1;

    function drawArea() {
        const horizontal = context.createLinearGradient(0, 0, size, 0);
        horizontal.addColorStop(0, "white");
        horizontal.addColorStop(1, `hsl(${hue}, 100%, 50%)`);
        context.fillStyle = horizontal;
        context.fillRect(0, 0, size, size);
        const vertical = context.createLinearGradient(0, 0, 0, size);
        vertical.addColorStop(0, "rgba(0, 0, 0, 0)");
        vertical.addColorStop(1, "rgba(0, 0, 0, 1)");
        context.fillStyle = vertical;
        context.fillRect(0, 0, size, size);
    }

    function positionThumb() {
        const rect = area.getBoundingClientRect();
        thumb.style.left = `${saturation * rect.width}px`;
        thumb.style.top = `${(1 - brightness) * rect.height}px`;
    }

    function hsvToHex(h, s, v) {
        const sextant = Math.floor(h / 60) % 6;
        const fraction = h / 60 - Math.floor(h / 60);
        const p = v * (1 - s);
        const q = v * (1 - fraction * s);
        const t = v * (1 - (1 - fraction) * s);
        const channels = [
            [v, t, p],
            [q, v, p],
            [p, v, t],
            [p, q, v],
            [t, p, v],
            [v, p, q]
        ][sextant];
        return (
            "#" +
            channels
                .map((channel) =>
                    Math.round(channel * 255)
                        .toString(16)
                        .padStart(2, "0")
                )
                .join("")
        );
    }

    function hexToHsv(hex) {
        const r = parseInt(hex.slice(1, 3), 16) / 255;
        const g = parseInt(hex.slice(3, 5), 16) / 255;
        const b = parseInt(hex.slice(5, 7), 16) / 255;
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        const delta = max - min;
        let h = 0;
        if (delta) {
            if (max === r) h = ((g - b) / delta + 6) % 6;
            else if (max === g) h = (b - r) / delta + 2;
            else h = (r - g) / delta + 4;
            h *= 60;
        }
        return { h, s: max ? delta / max : 0, v: max };
    }

    function commit() {
        const hex = hsvToHex(hue, saturation, brightness);
        hexInput.value = hex;
        if (activeSlot) {
            activeSlot.querySelector(".color-slot__input").value = hex;
            activeSlot.querySelector(".color-slot__hex").textContent = hex;
            activeSlot.style.setProperty("--color", hex);
        }
        saveDraft();
        rebuildContrast();
    }

    hueInput.addEventListener("input", () => {
        hue = Number(hueInput.value);
        drawArea();
        commit();
    });

    hexInput.addEventListener("input", () => {
        let value = hexInput.value.trim();
        if (!value.startsWith("#")) value = "#" + value;
        if (/^#[0-9a-f]{6}$/i.test(value)) {
            ({ h: hue, s: saturation, v: brightness } = hexToHsv(value));
            hueInput.value = Math.round(hue);
            drawArea();
            positionThumb();
            commit();
        }
    });

    let dragging = false;

    function pickAt(event) {
        const rect = area.getBoundingClientRect();
        saturation = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
        brightness = Math.max(0, Math.min(1, 1 - (event.clientY - rect.top) / rect.height));
        positionThumb();
        commit();
    }

    area.addEventListener("mousedown", (event) => {
        dragging = true;
        pickAt(event);
        event.preventDefault();
    });
    document.addEventListener("mousemove", (event) => {
        if (dragging) pickAt(event);
    });
    document.addEventListener("mouseup", () => {
        dragging = false;
    });

    function open(slot) {
        activeSlot = slot;
        const hex = slot.querySelector(".color-slot__input").value;
        ({ h: hue, s: saturation, v: brightness } = hexToHsv(hex));
        hueInput.value = Math.round(hue);
        element.hidden = false;
        drawArea();

        const slotRect = slot.getBoundingClientRect();
        const pickerWidth = element.offsetWidth || 208;
        const pickerHeight = element.offsetHeight || 260;
        let left = slotRect.left;
        let top = slotRect.bottom + 6;
        if (left + pickerWidth > window.innerWidth - 8) left = window.innerWidth - pickerWidth - 8;
        if (top + pickerHeight > window.innerHeight - 8) top = slotRect.top - pickerHeight - 6;
        element.style.left = left + "px";
        element.style.top = top + "px";

        requestAnimationFrame(positionThumb);
    }

    function close() {
        element.hidden = true;
        activeSlot = null;
    }

    function closeIfActive(slot) {
        if (activeSlot === slot) close();
    }

    document.addEventListener("click", (event) => {
        if (!element.hidden && !element.contains(event.target) && !event.target.closest(".color-slot__swatch")) {
            close();
        }
    });

    return { open, close, closeIfActive };
})();

function createSlot(hex) {
    const item = document.createElement("li");
    item.className = "color-slot";
    item.setAttribute("draggable", "true");
    item.style.setProperty("--color", hex);

    const swatch = document.createElement("span");
    swatch.className = "color-slot__swatch";

    const input = document.createElement("input");
    input.type = "hidden";
    input.name = "colors";
    input.value = hex;
    input.className = "color-slot__input";

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "color-slot__remove";
    remove.setAttribute("aria-label", "Remove color");
    remove.appendChild(removeIcon());

    swatch.append(input, remove);

    const hexButton = document.createElement("button");
    hexButton.type = "button";
    hexButton.className = "color-slot__hex";
    hexButton.setAttribute("aria-label", "Copy hex value");
    hexButton.textContent = hex;

    item.append(swatch, hexButton);
    return item;
}

function wireSlot(item) {
    const input = item.querySelector(".color-slot__input");
    const hexButton = item.querySelector(".color-slot__hex");
    const remove = item.querySelector(".color-slot__remove");
    const swatch = item.querySelector(".color-slot__swatch");

    swatch.addEventListener("click", (event) => {
        if (remove.contains(event.target)) return;
        picker.open(item);
    });

    hexButton.addEventListener("click", async () => {
        if (await copyText(input.value)) window.toast("Copied " + input.value, { type: "success" });
    });

    remove.addEventListener("click", () => {
        picker.closeIfActive(item);
        item.remove();
        saveDraft();
        rebuildContrast();
    });
}

list.querySelectorAll(".color-slot").forEach(wireSlot);

addColorButton.addEventListener("click", () => {
    const item = createSlot(randomHex());
    list.appendChild(item);
    wireSlot(item);
    wireDrag(item);
    picker.open(item);
    saveDraft();
    rebuildContrast();
});

let dragged = null;

function wireDrag(item) {
    item.addEventListener("dragstart", (event) => {
        dragged = item;
        event.dataTransfer.effectAllowed = "move";
        setTimeout(() => item.classList.add("color-slot--dragging"), 0);
    });

    item.addEventListener("dragend", () => {
        item.classList.remove("color-slot--dragging");
        list.querySelectorAll(".color-slot--over").forEach((slot) => slot.classList.remove("color-slot--over"));
        dragged = null;
        saveDraft();
    });

    item.addEventListener("dragover", (event) => {
        event.preventDefault();
        if (!dragged || dragged === item) return;
        list.querySelectorAll(".color-slot--over").forEach((slot) => slot.classList.remove("color-slot--over"));
        item.classList.add("color-slot--over");
        const rect = item.getBoundingClientRect();
        if (event.clientX < rect.left + rect.width / 2) {
            list.insertBefore(dragged, item);
        } else {
            list.insertBefore(dragged, item.nextSibling);
        }
    });
}

list.querySelectorAll(".color-slot").forEach(wireDrag);

function getColors() {
    return [...list.querySelectorAll(".color-slot__input")].map((input) => input.value);
}

function getPaletteName() {
    return nameInput.value || "palette";
}

function slugify(name) {
    return name
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9-]/g, "");
}

const copyCssButton = document.getElementById("copyCssButton");
const copyJsonButton = document.getElementById("copyJsonButton");

copyCssButton?.addEventListener("click", async () => {
    const slug = slugify(getPaletteName());
    const vars = getColors()
        .map((hex, index) => `  --color-${slug}-${index + 1}: ${hex};`)
        .join("\n");
    if (await copyText(`:root {\n${vars}\n}`)) window.toast("CSS copied", { type: "success" });
});

copyJsonButton?.addEventListener("click", async () => {
    const payload = { name: getPaletteName(), colors: getColors() };
    if (await copyText(JSON.stringify(payload, null, 2))) window.toast("JSON copied", { type: "success" });
});

const contrastButton = document.getElementById("contrastButton");
const contrastPanel = document.getElementById("contrastPanel");
const contrastInner = document.getElementById("contrastInner");
const badgeText = { aaa: "AAA", aa: "AA", large: "AA large", fail: "fail" };

function contrastHeader(color, label) {
    const cell = document.createElement("th");
    const swatch = document.createElement("span");
    swatch.className = "contrast-swatch";
    swatch.style.setProperty("--color", color);
    const name = document.createElement("span");
    name.className = "contrast-label";
    name.textContent = label;
    cell.append(swatch, document.createElement("br"), name);
    return cell;
}

function buildContrastTable() {
    const palette = getColors();
    contrastInner.textContent = "";

    if (!palette.length) {
        const message = document.createElement("p");
        message.className = "contrast-empty";
        message.textContent = "No colors yet.";
        contrastInner.appendChild(message);
        return;
    }

    const columns = [...palette, "#000000", "#ffffff"];
    const labels = [...palette, "Black", "White"];

    const table = document.createElement("table");
    table.className = "contrast-table";

    const head = document.createElement("thead");
    const headRow = document.createElement("tr");
    headRow.appendChild(document.createElement("th"));
    for (let column = 0; column < columns.length; column++) {
        headRow.appendChild(contrastHeader(columns[column], labels[column]));
    }
    head.appendChild(headRow);
    table.appendChild(head);

    const body = document.createElement("tbody");
    for (let row = 0; row < columns.length; row++) {
        const tableRow = document.createElement("tr");
        tableRow.appendChild(contrastHeader(columns[row], labels[row]));

        for (let column = 0; column < columns.length; column++) {
            const cell = document.createElement("td");
            if (row === column) {
                cell.className = "contrast-cell contrast-cell--skip";
                cell.textContent = "-";
            } else {
                const ratio = contrastRatio(columns[row], columns[column]);
                let grade = "fail";
                if (ratio >= 7) grade = "aaa";
                else if (ratio >= 4.5) grade = "aa";
                else if (ratio >= 3) grade = "large";
                cell.className = `contrast-cell contrast-cell--${grade}`;
                cell.title = `${ratio.toFixed(2)}:1`;
                cell.textContent = ratio.toFixed(2);
                const badge = document.createElement("span");
                badge.className = "contrast-grade";
                badge.textContent = badgeText[grade];
                cell.append(document.createElement("br"), badge);
            }
            tableRow.appendChild(cell);
        }
        body.appendChild(tableRow);
    }
    table.appendChild(body);
    contrastInner.appendChild(table);
}

rebuildContrast = () => {
    if (!contrastPanel.hidden) buildContrastTable();
};

contrastButton.addEventListener("click", () => {
    contrastPanel.hidden = !contrastPanel.hidden;
    if (!contrastPanel.hidden) buildContrastTable();
});

if (isNewPalette) {
    const draftKey = "huebox-draft";

    saveDraft = function () {
        localStorage.setItem(
            draftKey,
            JSON.stringify({ name: nameInput.value, colors: getColors() })
        );
    };

    const raw = localStorage.getItem(draftKey);
    if (raw) {
        try {
            const { name, colors } = JSON.parse(raw);
            if (name) nameInput.value = name;
            if (colors?.length) {
                list.innerHTML = "";
                for (const hex of colors) {
                    const item = createSlot(hex);
                    list.appendChild(item);
                    wireSlot(item);
                    wireDrag(item);
                }
            }
        } catch {
            localStorage.removeItem(draftKey);
        }
    }

    nameInput.addEventListener("input", saveDraft);
    document.getElementById("paletteEditor").addEventListener("submit", () => {
        localStorage.removeItem(draftKey);
    });
}

const isPublicInput = document.getElementById("isPublic");
const visibilityHint = document.getElementById("visibilityHint");

function updateVisibility() {
    visibilityHint.textContent = isPublicInput.checked
        ? "Anyone can view and fork this palette"
        : "Only you can see this palette";
}

updateVisibility();
isPublicInput.addEventListener("change", updateVisibility);
