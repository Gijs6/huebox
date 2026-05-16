const canvas = document.getElementById("splashCanvas");
const ctx = canvas.getContext("2d");
let chips = [];
let mouse = { x: -9999, y: -9999 };
let blasts = [];

const BLAST_EXPAND = 9;
const BLAST_RING_WIDTH = 55;
const BLAST_MAX_RADIUS = 500;
const BLAST_STRENGTH = 3.0;

const colorLabel = document.createElement("div");
colorLabel.style.cssText = ["position:fixed", "pointer-events:none", "background:var(--color-gray-9)", "color:var(--color-white)", "font-family:var(--font-family-mono)", "font-size:var(--font-size-xs)", "font-weight:var(--font-weight-medium)", "padding:var(--spacing-xs) var(--spacing-sm)", "border-radius:var(--radius)", "display:none", "z-index:100", "white-space:nowrap", "border-left-width:3px", "border-left-style:solid"].join(";");
document.body.appendChild(colorLabel);

const messagesContainer = document.createElement("div");
messagesContainer.className = "messages-container";
messagesContainer.setAttribute("aria-live", "polite");
document.body.appendChild(messagesContainer);

function makeChip() {
    const color = `#${Math.floor(Math.random() * 0xffffff)
        .toString(16)
        .padStart(6, "0")}`;
    const angle = Math.random() * Math.PI * 2;
    const speed = 0.25 + Math.random() * 0.55;
    return {
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 0.007,
        color,
        size: 22 + Math.random() * 56,
        alpha: 1,
        wander: Math.random() * Math.PI * 2,
        wanderSpeed: (Math.random() - 0.5) * 0.018
    };
}

function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}

function init() {
    resize();
    chips = Array.from({ length: 70 }, makeChip);
}

function hitTest(chip, mouseX, mouseY) {
    const dx = mouseX - chip.x;
    const dy = mouseY - chip.y;
    const cos = Math.cos(-chip.rotation);
    const sin = Math.sin(-chip.rotation);
    const localX = dx * cos - dy * sin;
    const localY = dx * sin + dy * cos;
    return Math.abs(localX) <= chip.size / 2 && Math.abs(localY) <= chip.size / 2;
}

function applyBlastForce(chip) {
    for (const blast of blasts) {
        const dx = chip.x - blast.x;
        const dy = chip.y - blast.y;
        const dist = Math.hypot(dx, dy);
        if (dist === 0) continue;
        const ringDelta = Math.abs(dist - blast.radius);
        if (ringDelta < BLAST_RING_WIDTH) {
            const falloff = 1 - ringDelta / BLAST_RING_WIDTH;
            chip.vx += (dx / dist) * BLAST_STRENGTH * falloff;
            chip.vy += (dy / dist) * BLAST_STRENGTH * falloff;
        }
    }
}

function updateChip(chip, isHovered) {
    chip.wander += chip.wanderSpeed + (Math.random() - 0.5) * 0.004;
    chip.vx += Math.cos(chip.wander) * 0.012;
    chip.vy += Math.sin(chip.wander) * 0.012;

    applyBlastForce(chip);

    const speed = Math.hypot(chip.vx, chip.vy);
    const maxSpeed = isHovered ? 1.5 : 6.0;
    if (speed > maxSpeed) {
        chip.vx = (chip.vx / speed) * maxSpeed;
        chip.vy = (chip.vy / speed) * maxSpeed;
    }
    chip.vx *= isHovered ? 0.85 : 0.992;
    chip.vy *= isHovered ? 0.85 : 0.992;

    chip.rotationSpeed *= 0.97;
    if (Math.abs(chip.rotationSpeed) > 0.03) chip.rotationSpeed = Math.sign(chip.rotationSpeed) * 0.03;

    chip.x += chip.vx;
    chip.y += chip.vy;
    chip.rotation += chip.rotationSpeed;

    if (chip.x < -chip.size) chip.x = canvas.width + chip.size;
    else if (chip.x > canvas.width + chip.size) chip.x = -chip.size;
    if (chip.y < -chip.size) chip.y = canvas.height + chip.size;
    else if (chip.y > canvas.height + chip.size) chip.y = -chip.size;
}

function drawChip(chip, isHovered) {
    ctx.save();
    ctx.globalAlpha = chip.alpha;
    ctx.translate(chip.x, chip.y);
    ctx.rotate(chip.rotation);
    ctx.fillStyle = chip.color;
    ctx.beginPath();
    ctx.roundRect(-chip.size / 2, -chip.size / 2, chip.size, chip.size, chip.size * 0.2);
    ctx.fill();
    if (isHovered) {
        ctx.strokeStyle = "rgba(255,255,255,0.65)";
        ctx.lineWidth = 2;
        ctx.stroke();
    }
    ctx.restore();
}

function showToast(msg) {
    const el = document.createElement("div");
    el.className = "toast";
    el.textContent = msg;
    messagesContainer.appendChild(el);
    requestAnimationFrame(() => el.classList.add("toast--visible"));
    setTimeout(() => {
        el.classList.remove("toast--visible");
        setTimeout(() => el.remove(), 200);
    }, 1600);
}

function frame() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (let i = blasts.length - 1; i >= 0; i--) {
        blasts[i].radius += BLAST_EXPAND;
        if (blasts[i].radius > BLAST_MAX_RADIUS) blasts.splice(i, 1);
    }

    let hoveredChip = null;
    for (let i = chips.length - 1; i >= 0; i--) {
        if (hitTest(chips[i], mouse.x, mouse.y)) {
            hoveredChip = chips[i];
            break;
        }
    }

    if (hoveredChip) {
        colorLabel.textContent = hoveredChip.color.toUpperCase();
        colorLabel.style.display = "block";
        colorLabel.style.left = mouse.x + 16 + "px";
        colorLabel.style.top = mouse.y - 12 + "px";
        colorLabel.style.borderLeftColor = hoveredChip.color;
    } else {
        colorLabel.style.display = "none";
    }

    for (const chip of chips) {
        const isHovered = chip === hoveredChip;
        updateChip(chip, isHovered);
        drawChip(chip, isHovered);
    }

    requestAnimationFrame(frame);
}

canvas.addEventListener("mousemove", (e) => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
});
canvas.addEventListener("mouseleave", () => {
    mouse.x = -9999;
    mouse.y = -9999;
});
canvas.addEventListener("click", (e) => {
    let clicked = null;
    for (let i = chips.length - 1; i >= 0; i--) {
        if (hitTest(chips[i], mouse.x, mouse.y)) {
            clicked = chips[i];
            break;
        }
    }
    if (clicked) {
        const hex = clicked.color.toUpperCase();
        if (navigator.clipboard) {
            navigator.clipboard.writeText(hex).then(() => showToast(`Copied ${hex}`));
        } else {
            const ta = document.createElement("textarea");
            ta.value = hex;
            ta.style.cssText = "position:fixed;opacity:0";
            document.body.appendChild(ta);
            ta.select();
            document.execCommand("copy");
            document.body.removeChild(ta);
            showToast(`Copied ${hex}`);
        }
    } else {
        blasts.push({ x: e.clientX, y: e.clientY, radius: 0 });
    }
});

window.addEventListener("resize", () => {
    const oldWidth = canvas.width;
    const oldHeight = canvas.height;

    resize();

    const scaleX = canvas.width / oldWidth;
    const scaleY = canvas.height / oldHeight;

    for (const chip of chips) {
        chip.x *= scaleX;
        chip.y *= scaleY;
    }
});

init();
frame();

const titleLetters = document.querySelectorAll(".splash__title-letter");
const randColor = () => `rgb(${Math.floor(Math.random() * 256)},${Math.floor(Math.random() * 256)},${Math.floor(Math.random() * 256)})`;
titleLetters.forEach((letter) => {
    letter.addEventListener("mouseenter", () => {
        letter.style.color = randColor();
    });
});
