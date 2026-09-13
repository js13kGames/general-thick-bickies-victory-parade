const groundY = canvas.height - 48;
const toolBoxes = {
    horn: {
        x: 20,
        y: 500 - 24,
        width: 90,
        height: 110
    },
    glitter: {
        x: 125,
        y: 500 - 24,
        width: 90,
        height: 110
    },
    paint: {
        x: 500,
        y: 550 - 24,
        width: 90,
        height: 70
    },
    rainbow: {
        x: 630,
        y: 500 - 24,
        width: 90,
        height: 110
    }
};

const hornBaseY = 12;
const hornBaseHeight = 8;
const hornBaseSideExtension = 2;
const hornBaseRadius = 4;

const hornAnchor = {
    x: -8,
    y: 0,
    width: 18,
    height: 20
};

const hornGripFollow = 0.35; // 0 = current fixed behaviour
const hornGripOffset = {
    x: 16,
    y: -32
};

const hornStyles = [
    {
        body: "#fff8d6",
        stripe: "#ed8bd8",
        width: 18,
        length: 50,
        stripeDirection: 1
    },
    {
        body: "#dff8ff",
        stripe: "#9274d8",
        width: 15,
        length: 56,
        stripeDirection: -1
    },
    {
        body: "#ffe5f4",
        stripe: "#56bde8",
        width: 21,
        length: 46,
        stripeDirection: 1
    },
    {
        body: "#fff0bd",
        stripe: "#65c466",
        width: 17,
        length: 53,
        stripeDirection: -1
    },
    {
        body: "#d9ffd9",
        stripe: "#9274d8",
        width: 19,
        length: 51,
        stripeDirection: 1
    },
    {
        body: "#e8d9ff",
        stripe: "#ef5757",
        width: 16,
        length: 55,
        stripeDirection: -1
    }
];

const rainbowScale = 1.05;
// const rainbow180Offset = 18;

const rainbowColours = [
    "#ef5757",
    "#f6a623",
    "#f8df4f",
    "#65c466",
    "#56bde8",
    "#9274d8"
];
const rainbowOuterRadius = 34;
const rainbowBandWidth = 5;
const rainbowArcCentreY = 8;

const glitterColours = [
    "#f138c3",
    "#ffe45e",
    "#7ce3ff",
    "#ff9e5e",
    "#b8ff5e",
    "#d9a6ff"
];

function drawHornIcon(ctx, preview = false) {
    const bodyColour =
        preview ? "#fff" : "#fff8d6";

    const outlineColour =
        preview ? "#fff" : "#b887d8";

    // Horn pointing upwards
    ctx.fillStyle = bodyColour;
    ctx.strokeStyle = outlineColour;
    ctx.lineWidth = 2;

    ctx.beginPath();
    ctx.moveTo(-13, 28);
    ctx.lineTo(13, 28);
    ctx.lineTo(3, -32);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
}

function drawRainbowIcon(ctx, preview = false) {
    ctx.lineWidth = 5;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#fff";

    ctx.beginPath();
    ctx.arc(0, 15, 34, Math.PI, Math.PI * 2);
    ctx.stroke();
}

function drawGlitterIcon(ctx) {
    const sparkles = [
        [-9, -10, 3, 0],
        [8, -12, 4, 0.5],
        [-3, -1, 5, 0.2],
        [11, 1, 3, 0.8],
        [-12, 5, 3, 0.4],
        [1, 10, 4, 0],
        [-5, -18, 3, 0.6],
        [14, -5, 3, 0.3]
    ];

    sparkles.forEach((sparkle, index) => {
        const [x, y, size, rotation] = sparkle;
        ctx.save();
        ctx.fillStyle = "#fff";
        ctx.translate(x, y);
        ctx.rotate(rotation);
        ctx.fillRect(-size / 2, -size / 2, size, size);
        ctx.restore();
    });
}

function drawSelectedToolAtHoof(ctx, currentTool, leg, hoofAngle, toolRotation, hornStyle) {
    if (!currentTool) {
        return;
    }

    ctx.save();
    ctx.translate(leg.hoofX, leg.hoofY);

    if (currentTool === "horn") {
        const tilt = hoofAngle + Math.PI / 2;
        const follow = tilt * hornGripFollow;
        const cos = Math.cos(follow);
        const sin = Math.sin(follow);
        const offsetX = hornGripOffset.x * cos - hornGripOffset.y * sin;
        const offsetY = hornGripOffset.x * sin + hornGripOffset.y * cos;
        // should point upwards         
        ctx.rotate(0);
        ctx.translate(offsetX, offsetY);
        drawHeldHorn(ctx, hornStyle);
    } else if (currentTool === "rainbow") {
        if (toolRotation === Math.PI) {
            ctx.translate(0, -18);
        }
        ctx.rotate(toolRotation);
        drawHeldRainbow(ctx);
    }

    ctx.restore();
}

function drawHeldHorn(ctx, styleIndex = 0) {

    const style = hornStyles[styleIndex] || hornStyles[0];

    ctx.fillStyle = style.body;
    ctx.strokeStyle = "#8b5ca8";
    ctx.lineWidth = 2;

    ctx.beginPath();
    ctx.moveTo(-style.width / 2, hornBaseY);
    ctx.lineTo(style.width / 2, hornBaseY);
    ctx.lineTo(0, -style.length);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#8b5ca8";
    ctx.strokeStyle = "#8b5ca8";
    ctx.beginPath();
    ctx.roundRect(
        -style.width / 2 - hornBaseSideExtension,
        hornBaseY,
        style.width + hornBaseSideExtension * 2,
        hornBaseHeight,
        hornBaseRadius
    );
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = style.stripe;
    ctx.lineWidth = 2;

    for (let y = 4; y > -style.length + 8; y -= 10) {
        const widthRatio =
            (y + style.length) / (style.length + 12);

        const halfWidth =
            style.width / 2 * widthRatio;

        const leftY =
            y + (style.stripeDirection === 1 ? 0 : -4);

        const rightY =
            y + (style.stripeDirection === 1 ? -4 : 0);

        ctx.beginPath();
        ctx.moveTo(-halfWidth, leftY);
        ctx.lineTo(halfWidth, rightY);
        ctx.stroke();
    }
}

function drawHeldRainbow(ctx) {
    ctx.save();

    ctx.scale(
        rainbowScale,
        rainbowScale
    );

    ctx.lineWidth = rainbowBandWidth;
    ctx.lineCap = "round";

    rainbowColours.forEach((colour, index) => {
        ctx.strokeStyle = colour;

        ctx.beginPath();
        ctx.arc(
            0,
            rainbowArcCentreY,
            rainbowOuterRadius -
            index * rainbowBandWidth,
            Math.PI,
            Math.PI * 2
        );
        ctx.stroke();
    });

    ctx.restore();
}

// visual feedback to player
let heldGlitterSparkles = [];

function chooseGlitterSparkles() {
    // close to edge of hoof, roughlyg going from left to right
    const positions = [[26, -7, 4, 0.7], [16, -12, 3, 0.3], [22, 10, 5, 0.2], [12, 18, 3, 0.6], [3, 6, 3, 0.9]];
    heldGlitterSparkles = positions.map(position => ({
        x: position[0],
        y: position[1],
        size: position[2],
        rotation: position[3],
        colour: glitterColours[Math.floor(Math.random() * glitterColours.length)]
    }));
}

function drawHeldGlitter(ctx, x, y, angle) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    heldGlitterSparkles.forEach(sparkle => {
        ctx.save();
        ctx.fillStyle = sparkle.colour;
        ctx.translate(sparkle.x, sparkle.y);
        ctx.rotate(sparkle.rotation);
        ctx.fillRect(-sparkle.size / 2, -sparkle.size / 2, sparkle.size, sparkle.size);
        ctx.restore();
    });
    ctx.restore();
}