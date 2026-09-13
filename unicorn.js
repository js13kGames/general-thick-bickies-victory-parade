// hoof always points toward the top of the canvas
// REMEMBER: canvas angles are clockwise from the RIGHT, 
// and canvas y increases down screen, so straight up is -90. 
//
// The hoof's toe is along the ellipse's long axis, which is local +x.
const hoofUprightAngle = -Math.PI / 2;
const legMinLength = 150;
const legMaxLength = 650;

function getHoofAngle(leg) {
    return Math.atan2(
        leg.hoofY - leg.shoulderY,
        leg.hoofX - leg.shoulderX
    );
}

function createUnicorn(canvas) {
    const x = canvas.width / 2;
    const y = canvas.height + 180;

    return {
        pointerInside: false,
        visible: false,
        targetX: x,
        targetY: y,
        hoofX: x,
        hoofY: y,
        shoulderX: x,
        shoulderY: y
    };
}

function getCanvasPoint(canvas, event) {
    const bounds = canvas.getBoundingClientRect();

    return {
        x: (event.clientX - bounds.left) * (canvas.width / bounds.width),
        y: (event.clientY - bounds.top) * (canvas.height / bounds.height)
    };
}

function updateUnicornPointer(unicorn, canvas, event) {
    const point = getCanvasPoint(canvas, event);

    unicorn.targetX = point.x;
    unicorn.targetY = point.y;
}

// cursor is within the canvas
function unicornActive(unicorn, canvas, event) {
    unicorn.pointerInside = true;
    unicorn.visible = true;

    updateUnicornPointer(unicorn, canvas, event);
}

// cursor has left the canvas
function unicornInactive(unicorn) {
    unicorn.pointerInside = false;

    // when cursor has gone off canvas, return to off screen position
    unicorn.targetX = unicorn.shoulderX;
    unicorn.targetY = unicorn.shoulderY;
}

function updateUnicorn(unicorn, deltaTime) {
    const smoothing =
        1 - Math.pow(0.0005, deltaTime / 1000);

    unicorn.hoofX +=
        (unicorn.targetX - unicorn.hoofX) * smoothing;

    unicorn.hoofY +=
        (unicorn.targetY - unicorn.hoofY) * smoothing;

    if (!unicorn.pointerInside) {
        const distanceX =
            unicorn.targetX - unicorn.hoofX;

        const distanceY =
            unicorn.targetY - unicorn.hoofY;

        const distance = Math.sqrt(
            distanceX * distanceX +
            distanceY * distanceY
        );

        if (distance < 2) {
            unicorn.visible = false;
        }
    }
}

function solveUnicornLeg(unicorn) {
    const distanceX = unicorn.hoofX - unicorn.shoulderX;
    const distanceY = unicorn.hoofY - unicorn.shoulderY;
    const angle = Math.atan2(distanceY, distanceX);
    const distance = Math.max(legMinLength, Math.min(legMaxLength, Math.hypot(distanceX, distanceY)));

    return {
        shoulderX: unicorn.shoulderX,
        shoulderY: unicorn.shoulderY,
        hoofX: unicorn.shoulderX + Math.cos(angle) * distance,
        hoofY: unicorn.shoulderY + Math.sin(angle) * distance
    };
}

function drawUnicornLine(ctx, leg, width, colour) {
    ctx.strokeStyle = colour;
    ctx.lineWidth = width;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(leg.shoulderX, leg.shoulderY);
    ctx.lineTo(leg.hoofX, leg.hoofY);
    ctx.stroke();
}

function drawUnicornHoof(ctx, leg) {
    const x = leg.hoofX;
    const y = leg.hoofY;
    const angle = getHoofAngle(leg);

    ctx.save();

    ctx.translate(x, y);
    ctx.rotate(angle);

    ctx.fillStyle = "#29252b";
    ctx.beginPath();
    ctx.ellipse(0, 0, 30, 20, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#381802";
    ctx.beginPath();
    ctx.ellipse(-3, -2, 24, 15, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#883b08";
    ctx.beginPath();
    ctx.ellipse(-11, -7, 8, 4, -0.3, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
}

function drawUnicorn(ctx, unicorn, drawHoof = true) {
    if (!unicorn.visible) {
        return;
    }

    const leg = solveUnicornLeg(unicorn);

    drawUnicornLine(ctx, leg, 46, "#29252b");

    drawUnicornLine(ctx, leg, 30,"#e4c4ed");

    if (drawHoof) {
        drawUnicornHoof(ctx, leg);
    }
}


function drawHoofPaint(ctx, leg, paintAmount, maxPaintAmount) {
    const paintRatio = paintAmount / maxPaintAmount;

    if (paintRatio <= 0) {
        return;
    }

    ctx.save();

    ctx.translate(leg.hoofX, leg.hoofY);
    ctx.rotate(getHoofAngle(leg));

    ctx.globalAlpha = 0.35 + paintRatio * 0.65;
    ctx.strokeStyle = "#ff73ba";
    ctx.lineWidth = 5;
    ctx.lineCap = "round";

    // only show selected paint on the top edge of hoof.
    ctx.beginPath();
    ctx.ellipse(0, 0, 33, 23, 0, -Math.PI / 2, Math.PI / 2);
    ctx.stroke();

    ctx.restore();
}