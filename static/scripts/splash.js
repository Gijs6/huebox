const canvas = document.getElementById("splashCanvas");
const context = canvas.getContext("2d");
let chips = [];
let mouse = { x: -9999, y: -9999 };
let blasts = [];
const center = document.querySelector(".splash__center");
let repelRect = null;

const blastExpand = 9;
const blastRingWidth = 55;
const blastMaxRadius = 500;
const blastStrength = 3;

const colorLabel = document.createElement("div");
colorLabel.className = "splash__color-label";
document.body.appendChild(colorLabel);

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
    if (center) repelRect = center.getBoundingClientRect();
}

function init() {
    resize();
    chips = Array.from({ length: 70 }, makeChip);
}

function hitTest(chip, x, y) {
    const dx = x - chip.x;
    const dy = y - chip.y;
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
        const distance = Math.hypot(dx, dy);
        if (distance === 0) continue;
        const ringDelta = Math.abs(distance - blast.radius);
        if (ringDelta < blastRingWidth) {
            const falloff = 1 - ringDelta / blastRingWidth;
            chip.vx += (dx / distance) * blastStrength * falloff;
            chip.vy += (dy / distance) * blastStrength * falloff;
        }
    }
}

function applyCenterRepel(chip) {
    if (!repelRect) return;
    const margin = 90;
    const strength = 0.45;

    const clampedX = Math.max(repelRect.left, Math.min(repelRect.right, chip.x));
    const clampedY = Math.max(repelRect.top, Math.min(repelRect.bottom, chip.y));
    const dx = chip.x - clampedX;
    const dy = chip.y - clampedY;
    const distance = Math.hypot(dx, dy);

    if (distance === 0) {
        const rectCenterX = (repelRect.left + repelRect.right) / 2;
        const rectCenterY = (repelRect.top + repelRect.bottom) / 2;
        const escapeX = chip.x - rectCenterX || 1;
        const escapeY = chip.y - rectCenterY;
        const escapeDistance = Math.hypot(escapeX, escapeY) || 1;
        chip.vx += (escapeX / escapeDistance) * strength * 2;
        chip.vy += (escapeY / escapeDistance) * strength * 2;
    } else if (distance < margin) {
        const force = (1 - distance / margin) * strength;
        chip.vx += (dx / distance) * force;
        chip.vy += (dy / distance) * force;
    }
}

function updateChip(chip, hovered) {
    chip.wander += chip.wanderSpeed + (Math.random() - 0.5) * 0.004;
    chip.vx += Math.cos(chip.wander) * 0.012;
    chip.vy += Math.sin(chip.wander) * 0.012;

    applyBlastForce(chip);
    applyCenterRepel(chip);

    const speed = Math.hypot(chip.vx, chip.vy);
    const maxSpeed = hovered ? 2 : 6;
    if (speed > maxSpeed) {
        chip.vx = (chip.vx / speed) * maxSpeed;
        chip.vy = (chip.vy / speed) * maxSpeed;
    }
    chip.vx *= hovered ? 0.92 : 0.992;
    chip.vy *= hovered ? 0.92 : 0.992;

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

function drawChip(chip) {
    context.save();
    context.globalAlpha = chip.alpha;
    context.translate(chip.x, chip.y);
    context.rotate(chip.rotation);
    context.fillStyle = chip.color;
    context.beginPath();
    context.roundRect(-chip.size / 2, -chip.size / 2, chip.size, chip.size, chip.size * 0.2);
    context.fill();
    context.restore();
}

function copyHex(hex) {
    const done = () => window.toast(`Copied ${hex}`, { type: "success" });
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(hex).then(done, () => {});
        return;
    }
    const field = document.createElement("textarea");
    field.value = hex;
    field.style.position = "fixed";
    field.style.opacity = "0";
    document.body.appendChild(field);
    field.select();
    try {
        document.execCommand("copy");
        done();
    } catch {
        /* clipboard unavailable */
    }
    field.remove();
}

function frame() {
    context.clearRect(0, 0, canvas.width, canvas.height);

    for (let index = blasts.length - 1; index >= 0; index--) {
        blasts[index].radius += blastExpand;
        if (blasts[index].radius > blastMaxRadius) blasts.splice(index, 1);
    }

    let hoveredChip = null;
    for (let index = chips.length - 1; index >= 0; index--) {
        if (hitTest(chips[index], mouse.x, mouse.y)) {
            hoveredChip = chips[index];
            break;
        }
    }

    if (hoveredChip) {
        colorLabel.textContent = hoveredChip.color.toUpperCase();
        colorLabel.classList.add("is-active");
        colorLabel.style.left = mouse.x + 16 + "px";
        colorLabel.style.top = mouse.y - 12 + "px";
        colorLabel.style.borderInlineStartColor = hoveredChip.color;
    } else {
        colorLabel.classList.remove("is-active");
    }

    for (const chip of chips) {
        updateChip(chip, chip === hoveredChip);
        drawChip(chip);
    }

    requestAnimationFrame(frame);
}

canvas.addEventListener("mousemove", (event) => {
    mouse.x = event.clientX;
    mouse.y = event.clientY;
});
canvas.addEventListener("mouseleave", () => {
    mouse.x = -9999;
    mouse.y = -9999;
});
canvas.addEventListener("click", (event) => {
    let clicked = null;
    for (let index = chips.length - 1; index >= 0; index--) {
        if (hitTest(chips[index], mouse.x, mouse.y)) {
            clicked = chips[index];
            break;
        }
    }
    if (clicked) {
        copyHex(clicked.color.toUpperCase());
    } else {
        blasts.push({ x: event.clientX, y: event.clientY, radius: 0 });
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

const randomColor = () => `rgb(${Math.floor(Math.random() * 256)}, ${Math.floor(Math.random() * 256)}, ${Math.floor(Math.random() * 256)})`;
document.querySelectorAll(".splash__letter").forEach((letter) => {
    letter.addEventListener("mouseenter", () => {
        letter.style.color = randomColor();
    });
});
