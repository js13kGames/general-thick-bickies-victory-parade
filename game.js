document.addEventListener("DOMContentLoaded", () => {
    const canvas = document.querySelector("#canvas");
    const ctx = canvas.getContext("2d");

    let state = "menu"; //, game, settings gameover
    let instructionsOpen = false;
    let instructionsButton = null;
    let isPaused = false;
    let isPointerDown = false;  // "hold" to paint
    let tweens = [];
    let startButton = null;
    let mainMenuButton = null;

    const skinTones = [
        ["#f3c7a3", "#d99d7b", "#a96752"],
        ["#d99b6c", "#b8754e", "#754632"],
        ["#a96846", "#81472f", "#4d2b23"],
        ["#70402e", "#4e2d25", "#2f1c1a"]
    ];

    const hairColours = [
        "#17151c",
        "#36251d",
        "#70452d",
        "#b8783e",
        "#d6b35c",
        "#73476f"
    ];

    const shirtColours = [
        "#7b7a74",
        "#979797"
    ];

    const trouserColours = [
        "#7b7a74",
        "#979797"
    ];
    const hairstyles = ["short", "long", "bob", "bald"];
    const maxGlitterAmount = 1; // glitter bursts per box pickup
    let glitterAmount = 0;
    let glitterBursts = [];

    let resultsButton = null;

    function tween(from, to, duration, onUpdate, onComplete) {
        tweens.push({
            from: from,
            to: to,
            duration: duration,
            started: performance.now(),
            onUpdate: onUpdate,
            onComplete: onComplete
        });
    }

    function updateTweens(time) {
        const active = tweens;
        tweens = [];

        for (const item of active) {
            const elapsed = time - item.started;

            if (elapsed >= item.duration) {
                item.onUpdate(item.to);
                if (item.onComplete) {
                    item.onComplete();
                }
            } else {
                const progress = elapsed / item.duration;
                item.onUpdate(item.from + (item.to - item.from) * progress);
                tweens.push(item);
            }
        }
    }

    // scoring check
    const measureCanvas = document.createElement("canvas");
    measureCanvas.width = canvas.width;
    measureCanvas.height = canvas.height;
    const measureCtx = measureCanvas.getContext("2d", { willReadFrequently: true });

    // read the alpha channel and adds it up. A fully opaque pixel adds 1, a half-transparent 
    // edge pixel adds 0.5, an empty pixel adds 0. So the result is the shape's visible area in 
    // pixels, with anti-aliased edges counted properly.
    function sumAlpha(context) {
        const data = context.getImageData(0, 0, context.canvas.width, context.canvas.height).data;
        let total = 0;
        for (let index = 3; index < data.length; index += 4) {
            total += data[index];
        }
        return total / 255;
    }

    // Draws text along a circular arc.
    function drawArcText(ctx, text, centreX, centreY, radius, centreAngle, invert = false, colours = null, outline = 0) {
        const characters = [...text];
        const widths = characters.map(character => ctx.measureText(character).width);
        const totalWidth = widths.reduce((sum, width) => sum + width, 0);

        // Angular width the whole string occupies.
        const span = totalWidth / radius;

        // Reading left to right on screen means going the other way round
        // the circle once you are on the lower half.
        const direction = Math.sin(centreAngle) > 0 ? -1 : 1;

        let angle = centreAngle - direction * span / 2;

        ctx.save();
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        for (const [index, character] of characters.entries()) {
            const halfAngle = widths[index] / (2 * radius);
            const characterAngle = angle + direction * halfAngle;

            ctx.save();
            ctx.translate(
                centreX + Math.cos(characterAngle) * radius,
                centreY + Math.sin(characterAngle) * radius
            );
            ctx.rotate(characterAngle + direction * Math.PI / 2 + (invert ? Math.PI : 0));
            if (outline) {
                ctx.lineJoin = "round";
                ctx.strokeStyle = "#1b1626";
                ctx.lineWidth = outline;
                ctx.strokeText(character, 0, 0);
            }

            if (colours && colours[index]) {
                ctx.fillStyle = colours[index];
            }
            ctx.fillText(character, 0, 0);
            ctx.restore();

            angle += direction * widths[index] / radius;
        }

        ctx.restore();
    }

    function colourLetters(text, colours) {
        return [...text].map((character, index) =>
            character === " " ? null : colours[index % colours.length]
        );
    }

    function wrapText(text, maxWidth) {
        const words = text.split(" ");
        const lines = [];
        let line = "";

        for (const word of words) {
            const next = line ? line + " " + word : word;

            if (line && ctx.measureText(next).width > maxWidth) {
                lines.push(line);
                line = word;
            } else {
                line = next;
            }
        }

        lines.push(line);
        return lines;
    }


    let placedDecorations = [];
    let currentDecorationRequirementIndex = 0;

    const UP = 0;
    const RIGHT = Math.PI / 2;
    const LEFT = Math.PI * 1.5;
    const DOWN = Math.PI;
    const hornOnHead = { tool: "horn", bodyPart: "head", label: "head: horn" };
    const normalTorsoRainbow = { tool: "rainbow", bodyPart: "torso", rotation: UP, label: "torso: normal rainbow" };
    const leftArmRainbow = { tool: "rainbow", bodyPart: "left arm", rotation: LEFT, label: "left arm: left pointing rainbow" };
    const rightArmRainbow = { tool: "rainbow", bodyPart: "right arm", rotation: RIGHT, label: "right arm: right pointing rainbow" };
    const leftArmOppRainbow = { tool: "rainbow", bodyPart: "left arm", rotation: RIGHT, label: "left arm: right pointing rainbow" };
    const rightArmOppRainbow = { tool: "rainbow", bodyPart: "right arm", rotation: LEFT, label: "right arm: left pointing rainbow" };
    const leftArmPaint = { tool: "paint", bodyPart: "left arm", label: "left arm: paint" };
    const rightArmPaint = { tool: "paint", bodyPart: "right arm", label: "right arm: paint" };
    const leftLegPaint = { tool: "paint", bodyPart: "left leg", label: "left leg: paint" };
    const rightLegPaint = { tool: "paint", bodyPart: "right leg", label: "right leg: paint" };
    const torsoPaint = { tool: "paint", bodyPart: "torso", label: "torso: paint" };
    const leftArmGlitter = { tool: "glitter", bodyPart: "left arm", label: "left arm: glitter" };
    const leftLegGlitter = { tool: "glitter", bodyPart: "left leg", label: "left leg: glitter" };
    const torsoGlitter = { tool: "glitter", bodyPart: "torso", label: "torso: glitter" };

    const decorationRequirements = [
        [hornOnHead],                                                    // 1
        [hornOnHead, normalTorsoRainbow],
        [hornOnHead, leftArmPaint],
        [normalTorsoRainbow, hornOnHead, leftArmPaint],
        [hornOnHead, leftArmPaint, rightArmPaint],                       // 5
        [normalTorsoRainbow, hornOnHead, torsoPaint],                    // trap
        [hornOnHead, leftArmRainbow, rightArmPaint, leftLegPaint],       // trap
        [normalTorsoRainbow, leftArmRainbow, hornOnHead, torsoPaint],    // trap
        [hornOnHead, leftArmPaint, rightArmPaint, torsoGlitter],
        [normalTorsoRainbow, hornOnHead, leftArmPaint, torsoPaint],      // 10 
        [hornOnHead, leftArmRainbow, rightArmRainbow, leftArmPaint],
        [normalTorsoRainbow, hornOnHead, torsoPaint, torsoGlitter],
        [hornOnHead, leftArmPaint, rightArmPaint, leftLegPaint],
        [normalTorsoRainbow, leftArmRainbow, hornOnHead, torsoPaint],
        [hornOnHead, leftArmRainbow, rightArmRainbow, leftArmPaint, rightArmPaint],  // 15
        [normalTorsoRainbow, hornOnHead, torsoPaint, leftArmGlitter],
        [hornOnHead, leftArmPaint, rightArmPaint, leftLegPaint, torsoGlitter],
        [normalTorsoRainbow, leftArmRainbow, rightArmRainbow, hornOnHead, torsoPaint],
        [hornOnHead, leftArmPaint, rightArmPaint, leftLegPaint, leftLegGlitter],
        [normalTorsoRainbow, leftArmRainbow, rightArmRainbow, hornOnHead, rightArmPaint], // 20
        [normalTorsoRainbow, hornOnHead, leftArmPaint, leftLegPaint, torsoPaint], // 21 
        [leftArmOppRainbow, rightArmOppRainbow, normalTorsoRainbow, hornOnHead, torsoPaint] // 22
    ];

    // decoration requirements panel offset.
    let requirementsPanelOffset = 0;
    let currentRequirements = null;

    function requirementsPanelHeight() {
        const padding = 10;
        const headingHeight = 24;
        const lineHeight = 22;

        return padding * 2 + headingHeight + currentRequirements.length * lineHeight;
    }

    function resultsPanelHeight() {
        const lineHeight = 24;
        const padding = 12;
        const buttonHeight = 40;
        const buttonPadding = 16;
        const buttonGap = 40;
        return padding * 2 + lineHeight + 8 + lastVerdicts.length * 44 + lineHeight * 2 + buttonGap + buttonHeight + buttonPadding;
    }

    function startRequirementsPhase() {
        personPhase = "requirements";
        tween(requirementsPanelOffset, 0, 400, value => requirementsPanelOffset = value, () => startDecoratingPhase());
    }

    function drawRequirements(ctx) {
        const panelX = canvas.width - 250;
        const panelY = 24 + requirementsPanelOffset;
        const panelWidth = 232;
        const padding = 10;
        const headingHeight = 24;
        const lineHeight = 22;
        const panelHeight = requirementsPanelHeight();

        ctx.save();

        ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
        ctx.fillRect(panelX, panelY, panelWidth, panelHeight);

        ctx.strokeStyle = "#d8cbea";
        ctx.lineWidth = 2;
        ctx.strokeRect(panelX, panelY, panelWidth, panelHeight);

        ctx.fillStyle = "#392b45";
        ctx.font = "bold 18px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        ctx.fillText("Slave Decorations", panelX + panelWidth / 2, panelY + padding);

        ctx.strokeStyle = "#d8cbea";
        ctx.lineWidth = 2;

        ctx.beginPath();
        ctx.moveTo(panelX + padding, panelY + padding + lineHeight);
        ctx.lineTo(panelX + panelWidth - padding, panelY + padding + lineHeight);
        ctx.stroke();

        ctx.font = "bold 14px sans-serif";
        ctx.textAlign = "left";

        currentRequirements.forEach((requirement, index) => {
            ctx.fillText(
                requirement.label,
                panelX + padding,
                panelY + padding + headingHeight + index * lineHeight
            );
        });

        ctx.restore();
    }

    function pick(array) {
        return array[Math.floor(Math.random() * array.length)];
    }

    function rect(x, y, width, height, colour) {
        ctx.fillStyle = colour;
        ctx.fillRect(
            Math.round(x),
            Math.round(y),
            Math.round(width),
            Math.round(height)
        );
    }

    function polygon(points, colour) {
        ctx.fillStyle = colour;
        ctx.beginPath();
        ctx.moveTo(points[0][0], points[0][1]);

        for (let i = 1; i < points.length; i++) {
            ctx.lineTo(points[i][0], points[i][1]);
        }

        ctx.closePath();
        ctx.fill();
    }

    function evenSize(value, minimum) {
        return Math.max(
            minimum,
            Math.round(value / 2) * 2
        );
    }

    function centredX(centreX, width) {
        return Math.round(centreX - width / 2);
    }

    // Overall body variation
    // "normal" range
    // const widthScale = 0.85 + Math.random() * 0.5;
    // const heightScale = 0.85 + Math.random() * 0.35;

    /*
    // Narrower range of body widths
    const widthScale = 0.95 + Math.random() * 0.25;

    // More exaggerated widths
    const widthScale = 0.70 + Math.random() * 0.75;

    // Mostly short people
    const heightScale = 0.80 + Math.random() * 0.25;

    // More noticeable height variation
    const heightScale = 0.75 + Math.random() * 0.55;
    */

    // entering, requirements, decorating, timeUp, exiting.
    let personPhase = "entering";
    const personSlideDuration = 750;
    let personOffset = 0;
    const personTimeLimit = 15000;  // 15 seconds

    let personTimeRemaining = 0;
    let playerInDanger = 0; // how badly are they doing? :-P
    let resultsOffset = 0;
    let lastPersonOutcome = "okay";
    let lastVerdicts = [];
    let lackeyLine = "";
    let peopleCompleted = 0;
    const peopleCompletedTarget = 22; //20;

    const faceBase = {
        width: 70,
        height: 84,
        eyeY: 34,
        eyeDistance: 18,
        eyeWidth: 8,
        eyeHeight: 10,
        noseY: 46,
        noseWidth: 4,
        noseHeight: 6,
        mouthY: 66,
        mouthWidth: 8,
        mouthHeight: 3
    };

    function generatePerson() {
        const skin = pick(skinTones);
        const hair = pick(hairColours);
        const shirt = pick(shirtColours);
        const trousers = pick(trouserColours);
        const hairstyle = pick(hairstyles);

        const widthScale = 0.70 + Math.random() * 0.75;
        const heightScale = 0.75 + Math.random() * 0.55;

        const shoulderWidth = evenSize(80 * widthScale, 40);
        const hipWidth = evenSize(70 * widthScale, 40);
        const armWidth = evenSize(26 * widthScale, 20);
        const legWidth = evenSize(30 * widthScale, 20);
        const shoeWidth = evenSize(40 * widthScale, 30);
        const headWidth = evenSize(70 * widthScale, 40);
        const neckWidth = evenSize(30 * widthScale, 20);
        const headHeight = Math.round(84 * (0.95 + Math.random() * 0.1));
        const torsoHeight = Math.round(110 * heightScale);
        const armLength = Math.round(90 * heightScale);
        const legLength = Math.round(125 * heightScale);

        return {
            skin,
            hair,
            shirt,
            trousers,
            hairstyle,
            shoulderWidth,
            hipWidth,
            armWidth,
            legWidth,
            shoeWidth,
            headWidth,
            neckWidth,
            headHeight,
            torsoHeight,
            armLength,
            legLength
        };
    }

    function getPersonBodyParts(person) {
        const {
            shoulderWidth,
            hipWidth,
            armWidth,
            legWidth,
            shoeWidth,
            headWidth,
            neckWidth,
            headHeight,
            torsoHeight,
            armLength,
            legLength
        } = person;

        const centre = canvas.width / 2;
        const shoeHeight = 14;
        const headToTorsoGap = 16;

        const headX = centredX(centre, headWidth);
        const groundY = canvas.height - 48;
        const totalHeight = headHeight + headToTorsoGap + torsoHeight + legLength + shoeHeight;
        const headY = groundY - totalHeight;
        const torsoY = headY + headHeight + headToTorsoGap;
        const legY = torsoY + torsoHeight;
        const headTopExtension = person.hairstyle !== "bald" ? 12 : 0;

        const shoulderLeft = centre - shoulderWidth / 2;
        const shoulderRight = centre + shoulderWidth / 2;
        const hipLeft = centre - hipWidth / 2;
        const hipRight = centre + hipWidth / 2;

        const leftLegX = centre - legWidth - 4;
        const rightLegX = centre + 4;

        const armY = torsoY + 12;
        const armOverlap = Math.ceil(
            Math.abs(shoulderWidth - hipWidth) / 2
        ) + 4;

        const leftArmX = shoulderLeft - armWidth + armOverlap;
        const rightArmX = shoulderRight - armOverlap;

        const neckX = centredX(centre, neckWidth);

        const bodyParts = [
            {
                name: "head",
                type: "rect",
                x: headX,
                y: headY - headTopExtension,
                width: headWidth,
                height: headHeight + headTopExtension
            },
            {
                name: "neck",
                type: "rect",
                x: neckX,
                y: headY + headHeight - 4,
                width: neckWidth,
                height: 24
            },
            {
                name: "torso",
                type: "polygon",
                points: [
                    [shoulderLeft, torsoY],
                    [shoulderRight, torsoY],
                    [hipRight, torsoY + torsoHeight],
                    [hipLeft, torsoY + torsoHeight]
                ]
            },
            {
                name: "left hand",
                type: "rect",
                x: leftArmX,
                y: armY + armLength,
                width: armWidth,
                height: 20
            },
            {
                name: "right hand",
                type: "rect",
                x: rightArmX,
                y: armY + armLength,
                width: armWidth,
                height: 20
            },
            {
                name: "left arm",
                type: "rect",
                x: leftArmX,
                y: armY,
                width: armWidth,
                height: armLength
            },
            {
                name: "right arm",
                type: "rect",
                x: rightArmX,
                y: armY,
                width: armWidth,
                height: armLength
            },
            {
                name: "left leg",
                type: "rect",
                x: leftLegX,
                y: legY,
                width: legWidth,
                height: legLength
            },
            {
                name: "right leg",
                type: "rect",
                x: rightLegX,
                y: legY,
                width: legWidth,
                height: legLength
            },
            {
                name: "left shoe",
                type: "rect",
                x: leftLegX - 10,
                y: legY + legLength,
                width: shoeWidth,
                height: shoeHeight
            },
            {
                name: "right shoe",
                type: "rect",
                x: rightLegX,
                y: legY + legLength,
                width: shoeWidth,
                height: shoeHeight
            }
        ];

        return {
            centre,
            groundY,
            headX,
            headY,
            torsoY,
            legY,
            shoulderLeft,
            shoulderRight,
            hipLeft,
            hipRight,
            leftLegX,
            rightLegX,
            armY,
            leftArmX,
            rightArmX,
            neckX,
            bodyParts
        };
    }

    function drawHair(style, x, y, width, colour) {
        if (style === "bald") return;

        if (style === "short") {
            rect(x, y - 12, width, 24, colour);
            rect(x - 5, y + 8, 10, 24, colour);
            rect(x + width - 5, y + 8, 10, 24, colour);
        }

        if (style === "long") {
            rect(x, y - 12, width, 24, colour);
            rect(x - 10, y + 4, 14, 84, colour);
            rect(x + width - 4, y + 4, 14, 84, colour);
        }

        if (style === "bob") {
            rect(x, y - 12, width, 24, colour);
            rect(x - 10, y + 4, 14, 56, colour);
            rect(x + width - 4, y + 4, 14, 56, colour);
        }
    }

    function drawPersonBase(person) {
        const { skin, hair, shirt, trousers, hairstyle, shoulderWidth, hipWidth, armWidth, legWidth, shoeWidth, headWidth, neckWidth, headHeight, torsoHeight, armLength, legLength } = person;
        const geometry = getPersonBodyParts(person);
        const { headX, headY, torsoY, legY, shoulderLeft, shoulderRight, hipLeft, hipRight, leftLegX, rightLegX, armY, leftArmX, rightArmX, neckX } = geometry;

        // Legs.
        rect(leftLegX, legY, legWidth, legLength, trousers);
        rect(rightLegX, legY, legWidth, legLength, trousers);

        // Shoes.
        rect(leftLegX - 10, legY + legLength, shoeWidth, 14, "#29252b");
        rect(rightLegX, legY + legLength, shoeWidth, 14, "#29252b");

        // Arms.
        const armColour = darken(shirt, 12);
        rect(leftArmX, armY, armWidth, armLength, armColour);
        rect(rightArmX, armY, armWidth, armLength, armColour);

        // Hands.
        rect(leftArmX, armY + armLength, armWidth, 20, skin[0]);
        rect(rightArmX, armY + armLength, armWidth, 20, skin[0]);

        // Torso.
        polygon([[shoulderLeft, torsoY], [shoulderRight, torsoY], [hipRight, torsoY + torsoHeight], [hipLeft, torsoY + torsoHeight]], shirt);
        // Shirt shadow.
        rect(hipLeft, torsoY + torsoHeight - 12, hipWidth, 12, darken(shirt));

        // Neck.
        rect(neckX, headY + headHeight - 4, neckWidth, 24, skin[1]);

        // Head.
        rect(headX, headY, headWidth, headHeight, skin[0]);

        // Ears.
        rect(headX - 5, headY + 32, 6, 20, skin[1]);
        rect(headX + headWidth - 1, headY + 32, 6, 20, skin[1]);

        // Face shadow.
        rect(headX, headY + headHeight - 18, headWidth, 18, skin[0]);

        // Hair is paintable, so it sits with the body below paint and decorations.
        drawHair(hairstyle, headX, headY, headWidth, hair);
    }

    function drawPersonFace(person) {
        const { skin, headWidth, headHeight } = person;
        const geometry = getPersonBodyParts(person);
        const { headX, headY } = geometry;

        const faceWidthScale = headWidth / faceBase.width;
        const faceHeightScale = headHeight / faceBase.height;

        // Eyes.
        const eyeWidth = evenSize(faceBase.eyeWidth * faceWidthScale, 4);
        const eyeHeight = Math.max(6, Math.round(faceBase.eyeHeight * faceHeightScale));
        const eyeDistance = Math.round(faceBase.eyeDistance * faceWidthScale);
        const eyeY = headY + Math.round(faceBase.eyeY * faceHeightScale);
        const headCentreX = headX + headWidth / 2;
        const leftEyeX = headCentreX - eyeDistance - eyeWidth / 2;
        const rightEyeX = headCentreX + eyeDistance - eyeWidth / 2;

        rect(leftEyeX, eyeY, eyeWidth, eyeHeight, "#24202b");
        rect(rightEyeX, eyeY, eyeWidth, eyeHeight, "#24202b");

        // Nose.
        const noseWidth = evenSize(faceBase.noseWidth * faceWidthScale, 2);
        const noseHeight = Math.max(4, Math.round(faceBase.noseHeight * faceHeightScale));
        const noseY = headY + Math.round(faceBase.noseY * faceHeightScale);
        rect(headCentreX - noseWidth / 2, noseY, noseWidth, noseHeight, skin[2]);

        // Mouth.
        const mouthWidth = evenSize(faceBase.mouthWidth * faceWidthScale, 4);
        const mouthHeight = Math.max(2, Math.round(faceBase.mouthHeight * faceHeightScale));
        const mouthY = headY + Math.round(faceBase.mouthY * faceHeightScale);
        rect(headCentreX - mouthWidth / 2, mouthY, mouthWidth, mouthHeight, skin[2]);
    }

    function drawOneDecoration(ctx, placed) {
        ctx.save();

        if (placed.tool === "horn") {
            const hornAnchorCentreX = hornAnchor.x + hornAnchor.width / 2;
            const hornAnchorCentreY = hornAnchor.y + hornAnchor.height / 2;
            ctx.translate(placed.anchorX - hornAnchorCentreX, placed.anchorY - hornAnchorCentreY);
            drawHeldHorn(ctx, placed.hornStyle);
        } else if (placed.tool === "rainbow") {
            if (placed.rotation === Math.PI) {
                ctx.translate(placed.anchorX, placed.anchorY - 18);
            } else {
                ctx.translate(placed.anchorX, placed.anchorY);
            }
            ctx.rotate(placed.rotation);
            drawHeldRainbow(ctx);
        }

        ctx.restore();
    }

    function drawPersonLayers(ctx) {
        const geometry = getPersonBodyParts(person);
        const layers = [];

        for (const mark of paintMarks) {
            layers.push({ kind: "paint", order: mark.order, mark });
        }
        for (const placed of placedDecorations) {
            layers.push({ kind: "decoration", order: placed.order, placed });
        }
        for (const burst of glitterBursts) {
            layers.push({ kind: "glitter", order: burst.order, burst });
        }

        layers.sort((a, b) => a.order - b.order);

        for (const layer of layers) {
            if (layer.kind === "paint") {
                const bodyPart = geometry.bodyParts.find(part => part.name === layer.mark.bodyPart);
                if (!bodyPart) continue;
                ctx.save();
                clipToBodyPart(ctx, bodyPart);
                ctx.fillStyle = layer.mark.colour;
                ctx.beginPath();
                ctx.arc(layer.mark.x, layer.mark.y, layer.mark.radius, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
            } else if (layer.kind === "decoration") {
                drawOneDecoration(ctx, layer.placed);
            } else {
                // glitter
                const bodyPart = geometry.bodyParts.find(part => part.name === layer.burst.bodyPart);
                if (!bodyPart) continue;

                ctx.save();
                clipToBodyPart(ctx, bodyPart);

                for (const sparkle of layer.burst.sparkles) {
                    ctx.fillStyle = sparkle.colour;
                    ctx.save();
                    ctx.translate(sparkle.x, sparkle.y);
                    ctx.rotate(sparkle.rotation);
                    ctx.fillRect(-sparkle.size / 2, -sparkle.size / 2, sparkle.size, sparkle.size);
                    ctx.restore();
                }

                ctx.restore();
            }
        }
    }

    function drawOneLayerOn(context, layer) {
        if (layer.kind === "paint") {
            const bodyPart = getPersonBodyParts(person).bodyParts.find(part => part.name === layer.mark.bodyPart);
            if (!bodyPart) {
                return;
            }
            context.save();
            clipToBodyPart(context, bodyPart);
            context.fillStyle = layer.mark.colour;
            context.beginPath();
            context.arc(layer.mark.x, layer.mark.y, layer.mark.radius, 0, Math.PI * 2);
            context.fill();
            context.restore();
        } else if (layer.kind === "decoration") {
            drawOneDecoration(context, layer.placed);
        } else {
            const bodyPart = getPersonBodyParts(person).bodyParts.find(part => part.name === layer.burst.bodyPart);
            if (!bodyPart) {
                return;
            }
            context.save();
            clipToBodyPart(context, bodyPart);
            for (const sparkle of layer.burst.sparkles) {
                context.fillStyle = sparkle.colour;
                context.save();
                context.translate(sparkle.x, sparkle.y);
                context.rotate(sparkle.rotation);
                context.fillRect(-sparkle.size / 2, -sparkle.size / 2, sparkle.size, sparkle.size);
                context.restore();
            }
            context.restore();
        }
    }

    function itemLayer(tool, item) {
        if (tool === "glitter") {
            return { kind: "glitter", order: item.order, burst: item };
        }
        return { kind: "decoration", order: item.order, placed: item };
    }

    // from 0 to 1.0 of paint.
    function paintCoverage(bodyPartName) {
        const bodyPart = getPersonBodyParts(person).bodyParts.find(part => part.name === bodyPartName);
        if (!bodyPart) {
            return 0;
        }

        measureCtx.clearRect(0, 0, measureCanvas.width, measureCanvas.height);
        measureCtx.save();
        clipToBodyPart(measureCtx, bodyPart);
        measureCtx.fillStyle = "#ffffff";
        measureCtx.fillRect(0, 0, measureCanvas.width, measureCanvas.height);
        measureCtx.restore();
        const wholeArea = sumAlpha(measureCtx);

        if (wholeArea === 0) {
            return 0;
        }

        measureCtx.clearRect(0, 0, measureCanvas.width, measureCanvas.height);
        measureCtx.save();
        clipToBodyPart(measureCtx, bodyPart);
        for (const mark of paintMarks) {
            if (mark.bodyPart !== bodyPartName) {
                continue;
            }
            measureCtx.fillStyle = mark.colour;
            measureCtx.beginPath();
            measureCtx.arc(mark.x, mark.y, mark.radius, 0, Math.PI * 2);
            measureCtx.fill();
        }
        measureCtx.restore();
        const paintedArea = sumAlpha(measureCtx);

        return paintedArea / wholeArea;
    }

    function measurePaintedOver(tool, item) {
        const target = itemLayer(tool, item);

        measureCtx.clearRect(0, 0, measureCanvas.width, measureCanvas.height);
        drawOneLayerOn(measureCtx, target);
        const totalArea = sumAlpha(measureCtx);

        if (totalArea === 0) {
            return 0;
        }

        measureCtx.globalCompositeOperation = "destination-out";

        for (const mark of paintMarks) {
            if (mark.order > item.order) {
                drawOneLayerOn(measureCtx, { kind: "paint", order: mark.order, mark: mark });
            }
        }
        for (const placed of placedDecorations) {
            if (placed.order > item.order) {
                drawOneLayerOn(measureCtx, { kind: "decoration", order: placed.order, placed: placed });
            }
        }
        for (const burst of glitterBursts) {
            if (burst.order > item.order) {
                drawOneLayerOn(measureCtx, { kind: "glitter", order: burst.order, burst: burst });
            }
        }

        measureCtx.globalCompositeOperation = "source-over";

        const remainingArea = sumAlpha(measureCtx);

        return (totalArea - remainingArea) / totalArea;
    }

    function clipToBodyPart(ctx, bodyPart) {
        ctx.beginPath();

        if (bodyPart.type === "rect") {
            ctx.rect(
                bodyPart.x,
                bodyPart.y,
                bodyPart.width,
                bodyPart.height
            );
        } else if (bodyPart.type === "polygon") {
            ctx.moveTo(
                bodyPart.points[0][0],
                bodyPart.points[0][1]
            );

            for (let i = 1; i < bodyPart.points.length; i++) {
                ctx.lineTo(
                    bodyPart.points[i][0],
                    bodyPart.points[i][1]
                );
            }

            ctx.closePath();
        }

        ctx.clip();
    }


    function darken(hex, amount = 30) {
        const value = parseInt(hex.slice(1), 16);

        const r = Math.max(0, ((value >> 16) & 255) - amount);
        const g = Math.max(0, ((value >> 8) & 255) - amount);
        const b = Math.max(0, (value & 255) - amount);

        return `rgb(${r}, ${g}, ${b})`;
    }

    let person = null;
    let unicorn = null;
    let currentTool = null;
    let toolRotation = 0;
    let nextDecorationOrder = 0;

    function beginPerson() {
        person = generatePerson();
        paintMarks = [];
        placedDecorations = [];
        glitterBursts = [];
        nextDecorationOrder = 0;
        currentRequirements = decorationRequirements[currentDecorationRequirementIndex];
        heldTool = null;
        currentTool = null;
        toolRotation = 0;
        paintAmount = 0;
        glitterAmount = 0;
        lastPaintX = null;
        lastPaintY = null;
        isPointerDown = false;
        currentHelpText = "";

        personPhase = "entering";
        lastVerdicts = [];
        resultsOffset = -canvas.height;
        personOffset = canvas.width;
        requirementsPanelOffset = -(requirementsPanelHeight() + 40);
        resultsButton = null;

        tween(canvas.width, 0, personSlideDuration, value => personOffset = value, () => startRequirementsPhase());
    }

    function startDecoratingPhase() {
        personPhase = "decorating";
        personTimeRemaining = personTimeLimit;
        currentHelpText = defaultHelpText;
    }

    function endDecoratingPhase() {
        personPhase = "timeUp";

        isPointerDown = false;
        heldTool = null;
        currentTool = null;
        toolRotation = 0;
        paintAmount = 0;
        glitterAmount = 0;
        lastPaintX = null;
        lastPaintY = null;
        currentHelpText = "";

        let verdicts = scorePerson();
        lastVerdicts = verdicts;

        // if not excellent or acceptable its just bad...
        const bad = verdicts.filter(v => v.verdict !== "excellent" && v.verdict !== "acceptable").length;

        if (bad === 0) {
            playerInDanger = Math.max(0, playerInDanger - 1);
            lastPersonOutcome = "good";
        } else {
            playerInDanger++;
            lastPersonOutcome = "bad";
        }

        lackeyLine = getLackeyFeedback();

        peopleCompleted++;

        let target = -(resultsPanelHeight() + 40);
        resultsOffset = target;

        resultsButton = createButton(getResultButtonText(), 0, 0, () => {
            resultsButton = null;
            tween(resultsOffset, target, 400, value => resultsOffset = value, () => advanceAfterResults());
        }, { fontSize: 16, height: 40, width: 276, outline: 4 });

        tween(resultsOffset, 0, 400, value => resultsOffset = value, null);
    }

    function advanceAfterResults() {
        if (playerInDanger >= 4) {
            state = "gameover";
            showEndScreen();
            return;
        }

        if (peopleCompleted >= peopleCompletedTarget) {
            state = "parade";
            showEndScreen();
            return;
        }

        startExitingPhase();
    }

    function startExitingPhase() {
        personPhase = "exiting";

        const panelTarget = -(requirementsPanelHeight() + 40);

        tween(personOffset, -canvas.width, personSlideDuration, value => personOffset = value, () => {
            if (currentDecorationRequirementIndex < decorationRequirements.length - 1) {
                currentDecorationRequirementIndex++;
            }
            beginPerson();
        });
        tween(requirementsPanelOffset, panelTarget, personSlideDuration, value => requirementsPanelOffset = value, null);
    }

    function reset() {
        person = null;
        unicorn = null;
        currentTool = null;
        start();
    };

    function pointInRect(x, y, bodyPart) {
        return (
            x >= bodyPart.x &&
            x <= bodyPart.x + bodyPart.width &&
            y >= bodyPart.y &&
            y <= bodyPart.y + bodyPart.height
        );
    }

    function pointInPolygon(x, y, bodyPart) {
        let inside = false;

        for (let i = 0, j = bodyPart.points.length - 1; i < bodyPart.points.length; j = i++) {
            const xi = bodyPart.points[i][0];
            const yi = bodyPart.points[i][1];
            const xj = bodyPart.points[j][0];
            const yj = bodyPart.points[j][1];

            const intersects = (
                yi > y !== yj > y &&
                x < (xj - xi) * (y - yi) / (yj - yi) + xi
            );

            if (intersects) {
                inside = !inside;
            }
        }

        return inside;
    }

    function pointInBodyPart(x, y, bodyPart) {
        if (bodyPart.type === "rect") {
            return pointInRect(x, y, bodyPart);
        }

        if (bodyPart.type === "polygon") {
            return pointInPolygon(x, y, bodyPart);
        }

        return false;
    }

    // for paint and glitter
    function getTouchedBodyParts(person, unicorn, time) {
        const leg = solveUnicornLeg(unicorn);

        const hoof = {
            x: leg.hoofX,
            y: leg.hoofY,
            radiusX: 30,
            radiusY: 20,
            angle: getHoofAngle(leg)
        };

        const geometry = getPersonBodyParts(person);

        return geometry.bodyParts.filter(bodyPart =>
            hoofOverlapsBodyPart(hoof, bodyPart)
        );
    }

    function pointInRotatedEllipse(x, y, ellipse) {
        const distanceX = x - ellipse.x;
        const distanceY = y - ellipse.y;

        const cos = Math.cos(ellipse.angle);
        const sin = Math.sin(ellipse.angle);

        const localX = distanceX * cos + distanceY * sin;
        const localY = -distanceX * sin + distanceY * cos;

        return (
            localX * localX / (ellipse.radiusX * ellipse.radiusX) +
            localY * localY / (ellipse.radiusY * ellipse.radiusY)
        ) <= 1;
    }

    function getBodyPartPoints(bodyPart) {
        if (bodyPart.type === "polygon") {
            const points = [...bodyPart.points];

            let centreX = 0;
            let centreY = 0;

            for (const point of bodyPart.points) {
                centreX += point[0];
                centreY += point[1];
            }

            points.push([
                centreX / bodyPart.points.length,
                centreY / bodyPart.points.length
            ]);

            return points;
        }

        return [
            [bodyPart.x, bodyPart.y],
            [bodyPart.x + bodyPart.width, bodyPart.y],
            [bodyPart.x, bodyPart.y + bodyPart.height],
            [
                bodyPart.x + bodyPart.width,
                bodyPart.y + bodyPart.height
            ],
            [
                bodyPart.x + bodyPart.width / 2,
                bodyPart.y + bodyPart.height / 2
            ]
        ];
    }

    function hoofOverlapsBodyPart(hoof, bodyPart) {
        const hoofPoints = [[hoof.x, hoof.y]];
        const pointCount = 24;

        for (let i = 0; i < pointCount; i++) {
            const angle = Math.PI * 2 * i / pointCount;

            const localX = Math.cos(angle) * hoof.radiusX;
            const localY = Math.sin(angle) * hoof.radiusY;

            const cos = Math.cos(hoof.angle);
            const sin = Math.sin(hoof.angle);

            hoofPoints.push([
                hoof.x + localX * cos - localY * sin,
                hoof.y + localX * sin + localY * cos
            ]);
        }

        for (const point of hoofPoints) {
            if (pointInBodyPart(point[0], point[1], bodyPart)) {
                return true;
            }
        }

        const bodyPartPoints = getBodyPartPoints(bodyPart);

        for (const point of bodyPartPoints) {
            if (pointInRotatedEllipse(point[0], point[1], hoof)) {
                return true;
            }
        }

        return false;
    }

    function updateUnicornPersonCollision(person, unicorn, time) {
        unicorn.collision = false;
        unicorn.collisionBodyPart = null;

        if (!unicorn.visible) {
            return;
        }

        const leg = solveUnicornLeg(unicorn);

        const hoof = {
            x: leg.hoofX,
            y: leg.hoofY,
            radiusX: 30,
            radiusY: 20,
            angle: getHoofAngle(leg)
        };

        const geometry = getPersonBodyParts(person);

        for (const bodyPart of geometry.bodyParts) {
            if (hoofOverlapsBodyPart(hoof, bodyPart)) {
                unicorn.collision = true;
                unicorn.collisionBodyPart = bodyPart.name;
                unicorn.collisionX = leg.hoofX;
                unicorn.collisionY = leg.hoofY;
                return;
            }
        }
    }

    let currentRainbowRotationIndex = 0;
    const rainbowRotations = [
        0,
        Math.PI / 2,
        Math.PI,
        Math.PI * 1.5   // rendering looks odd with this, like it appears between hoof and leg.
    ];

    document.addEventListener("keydown", event => {
        if (personPhase !== "decorating") {
            return;
        }
        if (event.repeat) {
            return;
        }

        if (currentTool === "rainbow" && event.code === "Space") {
            event.preventDefault();

            currentRainbowRotationIndex++;

            if (currentRainbowRotationIndex >= rainbowRotations.length) {
                currentRainbowRotationIndex = 0;
            }

            toolRotation = rainbowRotations[currentRainbowRotationIndex];
        }
    });

    canvas.addEventListener(
        "pointerenter",
        event => {
            unicornActive(unicorn, canvas, event);
        }
    );

    canvas.addEventListener(
        "pointermove",
        event => {
            const point = getCanvasPoint(canvas, event);

            if (!unicorn.pointerInside) {
                unicornActive(unicorn, canvas, event);
            } else {
                updateUnicornPointer(unicorn, canvas, event);
            }

            if (resultsButton && personPhase === "timeUp") {
                resultsButton.updateHover(point.x, point.y);
            }
        }
    );

    canvas.addEventListener("pointerup", () => {
        if (state !== "game" || !currentRequirements) {
            return;
        }

        isPointerDown = false;
        lastPaintX = null;
        lastPaintY = null;
    });

    function rectOverlapArea(a, b) {
        const width = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
        const height = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
        return width > 0 && height > 0 ? width * height : 0;
    }

    function insidePolygonEdge(point, edgeStart, edgeEnd) {
        return (
            (edgeEnd[0] - edgeStart[0]) * (point[1] - edgeStart[1]) -
            (edgeEnd[1] - edgeStart[1]) * (point[0] - edgeStart[0])
        ) >= 0;
    }

    function lineIntersect(a, b, c, d) {
        const dx1 = b[0] - a[0];
        const dy1 = b[1] - a[1];
        const dx2 = d[0] - c[0];
        const dy2 = d[1] - c[1];
        const denom = dx1 * dy2 - dy1 * dx2;

        if (Math.abs(denom) < 1e-9) return [b[0], b[1]];

        const t = ((c[0] - a[0]) * dy2 - (c[1] - a[1]) * dx2) / denom;
        return [a[0] + dx1 * t, a[1] + dy1 * t];
    }

    function clipPolygon(subject, edgeStart, edgeEnd) {
        const output = [];
        const count = subject.length;

        for (let index = 0; index < count; index++) {
            const current = subject[index];
            const previous = subject[(index - 1 + count) % count];
            const currentInside = insidePolygonEdge(current, edgeStart, edgeEnd);
            const previousInside = insidePolygonEdge(previous, edgeStart, edgeEnd);

            if (currentInside) {
                if (!previousInside) output.push(lineIntersect(previous, current, edgeStart, edgeEnd));
                output.push(current);
            } else if (previousInside) {
                output.push(lineIntersect(previous, current, edgeStart, edgeEnd));
            }
        }

        return output;
    }

    function polygonArea(polygon) {
        if (polygon.length < 3) return 0;

        let sum = 0;

        for (let index = 0; index < polygon.length; index++) {
            const point = polygon[index];
            const next = polygon[(index + 1) % polygon.length];
            sum += point[0] * next[1] - next[0] * point[1];
        }

        return Math.abs(sum) / 2;
    }

    function rectPolygonOverlapArea(rect, points) {
        let subject = [
            [rect.x, rect.y],
            [rect.x + rect.width, rect.y],
            [rect.x + rect.width, rect.y + rect.height],
            [rect.x, rect.y + rect.height]
        ];

        const count = points.length;

        for (let index = 0; index < count; index++) {
            subject = clipPolygon(subject, points[index], points[(index + 1) % count]);
            if (subject.length < 3) return 0;
        }

        return polygonArea(subject);
    }

    function bodyPartOverlapArea(bodyPart, rect) {
        if (bodyPart.type === "rect") return rectOverlapArea(rect, bodyPart);
        if (bodyPart.type === "polygon") return rectPolygonOverlapArea(rect, bodyPart.points);
        return 0;
    }

    canvas.addEventListener("pointerdown", event => {

        if (state === "menu") {
            if (startButton && !menuExiting) {
                const leg = solveUnicornLeg(unicorn);

                startButton.click(leg.hoofX, leg.hoofY);
            }
            return;
        }

        if (instructionsOpen) {
            if (instructionsButton) {
                const leg = solveUnicornLeg(unicorn);

                instructionsButton.click(leg.hoofX, leg.hoofY);
            }

            return;
        }

        if (state === "gameover" || state === "parade") {
            if (mainMenuButton) {
                const leg = solveUnicornLeg(unicorn);

                mainMenuButton.click(leg.hoofX, leg.hoofY);
            }

            return;
        }


        if (personPhase === "timeUp") {
            if (resultsButton) {
                const point = getCanvasPoint(canvas, event);
                resultsButton.click(point.x, point.y);
            }
            return;
        }

        if (personPhase !== "decorating") {
            return;
        }

        const point = getCanvasPoint(canvas, event);

        for (const [toolName, box] of Object.entries(toolBoxes)) {
            if (pointInRect(point.x, point.y, box)) {
                selectTool(toolName);
                if (toolName === "paint") {
                    paintAmount = maxPaintAmount;
                    lastPaintX = null;
                    lastPaintY = null;
                }
                if (toolName === "glitter") {
                    glitterAmount = maxGlitterAmount;
                }
                return;
            }
        }

        isPointerDown = true;

        // body part check
        const leg = solveUnicornLeg(
            unicorn,
            performance.now()
        );

        const hoofX = leg.hoofX;
        const hoofY = leg.hoofY;
        const geometry = getPersonBodyParts(person);

        let bodyPart = null;
        let placementX = hoofX;
        let placementY = hoofY;

        if (heldTool === "horn") {
            const hornAnchorRect = {
                x: leg.hoofX + hornGripOffset.x + hornAnchor.x,
                y: leg.hoofY + hornGripOffset.y + hornAnchor.y,
                width: hornAnchor.width,
                height: hornAnchor.height
            };

            placementX = hornAnchorRect.x + hornAnchorRect.width / 2;
            placementY = hornAnchorRect.y + hornAnchorRect.height / 2;

            let bestBodyPart = null;
            let bestOverlap = 0;

            for (const currentBodyPart of geometry.bodyParts) {
                const overlap = bodyPartOverlapArea(currentBodyPart, hornAnchorRect);

                if (overlap > bestOverlap) {
                    bestOverlap = overlap;
                    bestBodyPart = currentBodyPart.name;
                }
            }

            bodyPart = bestBodyPart;
        } else {
            for (const currentBodyPart of geometry.bodyParts) {
                if (pointInBodyPart(
                    hoofX,
                    hoofY,
                    currentBodyPart
                )) {
                    bodyPart = currentBodyPart.name;
                    break;
                }
            }
        }

        if (heldTool && heldTool !== "paint" && heldTool !== "glitter" && bodyPart) {
            placeDecoration(bodyPart, placementX, placementY);
        } else if (heldTool === "glitter" && bodyPart) {
            applyGlitter(bodyPart, placementX, placementY);
        }
    });

    canvas.addEventListener(
        "pointerleave",
        () => {
            // stop painting and clear last position
            isPointerDown = false;
            lastPaintX = null;
            lastPaintY = null;
            unicornInactive(unicorn);
        }
    );

    let heldTool = null;

    // const maxPaintAmount = 40;
    const maxPaintAmount = 25;
    let paintMarks = [];
    let paintAmount = 0;
    let lastPaintX = null;
    let lastPaintY = null;

    let defaultHelpText = "Select a decoration by clicking on its container...";
    let currentHelpText = defaultHelpText;
    let toolHelpText = {
        "horn": "Click on the slave to place the horn",
        "glitter": "Click on the slave to apply glitter",
        "paint": "Hold LEFT CLICK down then move over the slave to paint",
        "rainbow": "SPACE rotates rainbows 90 degrees. Click on the slave to place it."
    };

    let currentHornStyle = 0;
    function chooseHornStyle() {
        currentHornStyle = Math.floor(Math.random() * 4);
    }

    function selectTool(tool) {
        if (tool !== "paint" && heldTool === "paint") {
            paintAmount = 0;
            lastPaintX = null;
            lastPaintY = null;
        }
        if (tool !== "glitter" && heldTool === "glitter") {
            glitterAmount = 0;
        }
        heldTool = tool;
        currentTool = tool;
        toolRotation = 0;
        if (tool === "horn") {
            chooseHornStyle();
        } else if (tool === "rainbow") {
            currentRainbowRotationIndex = 0;
            toolRotation = rainbowRotations[currentRainbowRotationIndex];
        } else if (tool === "glitter") {
            chooseGlitterSparkles();
        }

        currentHelpText = toolHelpText[tool];
    }

    function placeDecoration(bodyPart, anchorX, anchorY) {
        if (!heldTool || heldTool === "paint" || heldTool === "glitter") {
            return;
        }

        placedDecorations.push({
            tool: heldTool,
            bodyPart: bodyPart,
            anchorX: anchorX,
            anchorY: anchorY,
            rotation: toolRotation,
            hornStyle: currentHornStyle,
            order: nextDecorationOrder++
        });

        heldTool = null;
        currentTool = null;
        // set help text to the default message now that no tool has been selected
        currentHelpText = defaultHelpText;
    }

    function applyGlitter(bodyPart, x, y) {
        if (glitterAmount <= 0) {
            return;
        }

        const sparkleCount = 24;
        const scatterRadius = 25;
        const sparkles = [];

        for (let i = 0; i < sparkleCount; i++) {
            const angle = Math.random() * Math.PI * 2;
            const distance = Math.random() * scatterRadius;
            sparkles.push({
                x: x + Math.cos(angle) * distance,
                y: y + Math.sin(angle) * distance,
                size: 2 + Math.random() * 3,
                rotation: Math.random() * Math.PI,
                colour: glitterColours[Math.floor(Math.random() * glitterColours.length)]
            });
        }

        glitterBursts.push({
            bodyPart: bodyPart,
            x: x,
            y: y,
            order: nextDecorationOrder++,
            sparkles: sparkles
        });

        glitterAmount--;

        if (glitterAmount <= 0) {
            currentTool = null;
            heldTool = null;
            currentHelpText = defaultHelpText;
        }
    }

    function paintAtHoof(time) {
        if (
            !isPointerDown ||
            heldTool !== "paint" ||
            paintAmount <= 0
        ) {
            return;
        }

        const leg = solveUnicornLeg(unicorn, time);

        if (lastPaintX !== null) {
            const distanceX = leg.hoofX - lastPaintX;
            const distanceY = leg.hoofY - lastPaintY;
            const distance = Math.sqrt(
                distanceX * distanceX +
                distanceY * distanceY
            );

            if (distance < 8) {
                return;
            }
        }

        const touchedBodyParts = getTouchedBodyParts(
            person,
            unicorn,
            time
        );

        for (const bodyPart of touchedBodyParts) {
            paintMarks.push({
                bodyPart: bodyPart.name,
                x: leg.hoofX,
                y: leg.hoofY,
                radius: 14,
                colour: "#ff73ba",
                order: nextDecorationOrder++
            });
        }

        paintAmount--;
        lastPaintX = leg.hoofX;
        lastPaintY = leg.hoofY;

        if (paintAmount <= 0) {
            currentTool = null;
            heldTool = null;
            currentHelpText = defaultHelpText;
        }
    }

    // verdict thresholds
    const paintExcellent = 0.60;
    const paintAcceptable = 0.35;
    const paintPoor = 0.05;

    const decorationExcellent = 0.75;
    const decorationAcceptable = 0.40;
    const decorationPoor = 0.05;

    // horn position thresholds — fraction of head height from top
    const hornPositionGood = 0.40;
    const hornPositionPoor = 0.70;
    const hornOffCentreLimit = 0.50;
    // Fraction of skull height where the top-of-head zone ends. Below this and
    // above hornPositionGood is the acceptable band.
    const hornPositionTop = 0.20;


    // Verdict bands, best to worst.
    const verdictBands = ["excellent", "acceptable", "poor", "awful", "missed"];

    function bandIndex(verdict) {
        return verdictBands.indexOf(verdict);
    }

    function worseBand(a, b) {
        return bandIndex(a) >= bandIndex(b) ? a : b;
    }

    function hornVisibilityBand(visible) {
        if (visible >= 0.75) {
            return "excellent";
        } else if (visible >= 0.40) {
            return "acceptable";
        } else if (visible >= 0.05) {
            return "poor";
        }
        return "missed";
    }

    function hornVisibilityDetail(band) {
        if (band === "excellent") {
            return "OK";
        } else if (band === "acceptable") {
            return "partly covered";
        } else if (band === "poor") {
            return "mostly covered";
        }
        return "completely covered";
    }

    // Horn depth, as pixel distances from the top of the head.
    const hornTopDepth = 0;    // above this is the top of the head and where the horn should go for "excellent"
    const hornAboveEyes = 8;    // the face starts this far above the eye line

    // A horn counts as centred when the head's centre line falls within its base.
    function hornOffCentre(placed, head) {
        const offset = placed.anchorX - (head.x + head.width / 2);
        const style = hornStyles[placed.hornStyle] || hornStyles[0];
        const halfBase = style.width / 2 + hornBaseSideExtension;

        if (Math.abs(offset) <= halfBase) {
            return "centred";
        }

        return offset < 0 ? "too far left" : "too far right";
    }

    function hornPositionBand(placed, head) {
        const eyeLine = head.y + faceBase.eyeY;

        if (placed.anchorY > eyeLine - hornAboveEyes) {
            return "poor";
        }

        if (hornOffCentre(placed, head) !== "centred") {
            return "poor";
        }

        if (placed.anchorY <= head.y + hornTopDepth) {
            return "excellent";
        }

        return "acceptable";
    }

    function hornPositionDetail(placed, head) {
        const eyeLine = head.y + faceBase.eyeY;

        if (placed.anchorY > eyeLine - hornAboveEyes) {
            return "you know horns do not go on faces!";
        }

        if (hornOffCentre(placed, head) !== "centred") {
            return hornOffCentre(placed, head);
        }

        if (placed.anchorY > head.y + hornTopDepth) {
            return "a bit low on the head";
        }

        return "acceptable";
    }

    function applyVerdictPenalty(result, penalty, overrideDetail) {
        const newIndex = Math.min(bandIndex(result.verdict) + penalty, verdictBands.length - 1);
        return {
            label: result.label,
            verdict: verdictBands[newIndex],
            detail: overrideDetail || result.detail
        };
    }

    function requiredCount(tool) {
        return currentRequirements.filter(requirement => requirement.tool === tool).length;
    }

    // Score one requirement against the current person's state.
    // Returns { label, verdict, detail } where verdict is one of:
    // "excellent", "acceptable", "poor", "missed".
    // All threshold values are starting points — tune by playtesting.
    function scoreRequirement(requirement) {
        let result = { label: requirement.label, verdict: "missed", detail: "not attempted" };

        if (requirement.tool === "paint") {
            // Measure what fraction of the body part is covered
            let coverage = paintCoverage(requirement.bodyPart);
            if (coverage >= 0.80) { // .6
                result = { label: requirement.label, verdict: "excellent", detail: "OK" };    // well covered
            } else if (coverage >= 0.60) {  // .35
                result = { label: requirement.label, verdict: "acceptable", detail: "decent" };    // decent coverage
            } else if (coverage >= 0.35) {  // .15
                result = { label: requirement.label, verdict: "poor", detail: "minimal" };   // minimum effort
            } else if (coverage >= 0.15) {
                result = { label: requirement.label, verdict: "awful", detail: "barely there" };
            } else {
                result = { label: requirement.label, verdict: "missed", detail: "not painted" };
            }

            result.coverage = +coverage.toFixed(2);
        }
        else if (requirement.tool === "horn") {
            const geometry = getPersonBodyParts(person);
            const head = { x: geometry.headX, y: geometry.headY, width: person.headWidth, height: person.headHeight };
            const allHorns = placedDecorations.filter(placed => placed.tool === "horn");
            const candidates = allHorns.filter(placed => placed.bodyPart === requirement.bodyPart);

            if (candidates.length === 0) {
                result = { label: requirement.label, verdict: "missed", detail: "missing" }; // not placed
            } else {
                let best = null;

                for (const candidate of candidates) {
                    const visible = 1 - measurePaintedOver("horn", candidate);
                    const visibilityBand = hornVisibilityBand(visible);
                    const positionBand = hornPositionBand(candidate, head);
                    const band = worseBand(visibilityBand, positionBand);
                    const detail = band === positionBand
                        ? hornPositionDetail(candidate, head)
                        : hornVisibilityDetail(visibilityBand);

                    if (!best || bandIndex(band) < bandIndex(best.verdict)) {
                        best = { label: requirement.label, verdict: band, detail: detail };
                    }
                }

                result = best;

                // Every horn beyond the one that fulfils the requirement is an extra.
                // Buried horns keep their own worse detail.
                if (allHorns.length > 1 && result.verdict !== "missed") {
                    result = applyVerdictPenalty(result, 1, "not sticking to the requirements");
                }
            }
        }
        else if (requirement.tool === "rainbow") {
            // Find rainbows on the required body part.
            const allRainbows = placedDecorations.filter(placed => placed.tool === "rainbow");
            let candidates = allRainbows.filter(placed => placed.bodyPart === requirement.bodyPart);

            if (candidates.length === 0) {
                result = { label: requirement.label, verdict: "missed", detail: "missing" };    // not placed
            } else {
                // If a rotation is specified, filter to only matching rotations first.
                let rotationFailed = false;

                if (requirement.rotation !== undefined && requirement.rotation !== null) {
                    let rotated = candidates.filter(placed => placed.rotation === requirement.rotation);

                    if (rotated.length === 0) {
                        rotationFailed = true;
                        result = { label: requirement.label, verdict: "missed", detail: "wrong way round" };
                    } else {
                        candidates = rotated;
                    }
                }

                if (!rotationFailed) {
                    let bestVisible = 0;

                    for (let candidate of candidates) {
                        let visible = 1 - measurePaintedOver("rainbow", candidate);

                        if (visible > bestVisible) {
                            bestVisible = visible;
                        }
                    }

                    if (bestVisible >= 0.75) {
                        result = { label: requirement.label, verdict: "excellent", detail: "OK" };   // nicely placed
                    } else if (bestVisible >= 0.4) {
                        result = { label: requirement.label, verdict: "acceptable", detail: "kinda visible" };
                    } else if (bestVisible >= 0.05) {
                        result = { label: requirement.label, verdict: "poor", detail: "barely visible" };
                    } else {
                        result = { label: requirement.label, verdict: "missed", detail: "hardly visible" };
                    }

                    if (allRainbows.length > requiredCount("rainbow") && result.verdict !== "missed") {
                        result = applyVerdictPenalty(result, 1, "not sticking to the requirements");
                    }

                    result.visibility = +bestVisible.toFixed(2);
                }
            }
        }
        else if (requirement.tool === "glitter") {
            const onPart = glitterBursts.filter(burst => burst.bodyPart === requirement.bodyPart);
            const elsewhere = glitterBursts.filter(burst => burst.bodyPart !== requirement.bodyPart);

            if (onPart.length === 0) {
                result = {
                    label: requirement.label,
                    verdict: "missed",
                    detail: elsewhere.length > 0 ? "only on " + elsewhere[0].bodyPart : "none"  // no glitter applied or on the wrong part
                };
            } else {
                result = { label: requirement.label, verdict: "excellent", detail: "OK" };  // glitter applied

                if (elsewhere.length > 0) {
                    result = applyVerdictPenalty(result, 1, "also WRONGLY on " + elsewhere[0].bodyPart);
                }
            }
        }

        return result;
    }

    function scorePerson() {
        return currentRequirements.map(scoreRequirement);
    }

    function drawToolBoxes(ctx) {
        drawToolCrate(ctx, "HORNS", toolBoxes.horn, currentTool === "horn", drawHornIcon);
        drawToolCrate(ctx, "GLITTER", toolBoxes.glitter, currentTool === "glitter" && glitterAmount > 0, drawGlitterIcon);
        drawToolCrate(ctx, "RAINBOWS", toolBoxes.rainbow, currentTool === "rainbow", drawRainbowIcon);
        drawPaintPot(ctx, toolBoxes.paint, currentTool === "paint" && paintAmount > 0);
    }

    function drawCurrentHelpText(ctx) {
        // if time make this rainbow-y or colourful to draw attention to it
        ctx.save();
        ctx.fillStyle = '#CCC';
        ctx.fillRect(0, groundY, canvas.width, 48);
        ctx.fillStyle = '#000';
        ctx.font = "bold 18px sans-serif";

        ctx.fillText(currentHelpText, 75, groundY + 28);
        ctx.strokeStyle = "#000";
        ctx.lineWidth = 4;
        ctx.strokeRect(0, groundY, canvas.width, 48);
        const clock = String(Math.ceil(personTimeRemaining / 1000)).padStart(2, "0");

        ctx.font = "bold 44px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        ctx.lineJoin = "round";

        // Cream halo with a soft shadow, so it lifts off the background.
        ctx.shadowColor = "#392b45";
        ctx.shadowBlur = 8;
        ctx.strokeStyle = "#fff0bd";
        ctx.lineWidth = 10;
        ctx.strokeText(clock, canvas.width / 2, 16);

        // Black fill last, with the shadow off so the letter edges stay crisp.
        ctx.shadowColor = "transparent";
        ctx.fillStyle = "#000";
        ctx.fillText(clock, canvas.width / 2, 16);

        ctx.restore();
    }

    function drawToolCrate(
        ctx,
        name,
        box,
        selected,
        drawItem
    ) {
        ctx.save();

        ctx.fillStyle = selected ? "#c99150" : "#a96f39";
        ctx.fillRect(
            box.x,
            box.y,
            box.width,
            box.height
        );

        ctx.strokeStyle = "#633c29";
        ctx.lineWidth = 4;
        ctx.strokeRect(
            box.x,
            box.y,
            box.width,
            box.height
        );

        // Crate planks
        ctx.lineWidth = 2;

        ctx.beginPath();
        ctx.moveTo(
            box.x,
            box.y + box.height / 3
        );
        ctx.lineTo(
            box.x + box.width,
            box.y + box.height / 3
        );

        ctx.moveTo(
            box.x,
            box.y + box.height * 2 / 3
        );
        ctx.lineTo(
            box.x + box.width,
            box.y + box.height * 2 / 3
        );

        ctx.stroke();

        // Item preview
        ctx.save();
        ctx.translate(
            box.x + box.width / 2,
            box.y + 35
        );
        drawItem(ctx, true);
        ctx.restore();

        // Label
        ctx.fillStyle = "#fff0bd";
        ctx.font = "bold 14px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(
            name,
            box.x + box.width / 2,
            box.y + 92
        );

        ctx.restore();
    }

    function drawPaintPot(ctx, box, selected) {
        const centreX = box.x + box.width / 2;
        const left = box.x + 6;
        const right = box.x + box.width - 6;
        const topY = box.y + 10;                      // top of the grey body, just under the rim
        const baseY = box.y + box.height - 6;

        ctx.save();

        // Grey cylinder body.
        ctx.fillStyle = "#c9ccd6";
        ctx.fillRect(left, topY, right - left, baseY - topY);

        // Rounded base.
        ctx.beginPath();
        ctx.ellipse(centreX, baseY, (right - left) / 2, 8, 0, 0, Math.PI);
        ctx.fill();

        // Shade down the right, so it reads as a cylinder.
        // Grey cylinder body, outlined like the solid crates.
        ctx.fillStyle = "#c9ccd6";
        ctx.beginPath();
        ctx.roundRect(left, topY, right - left, baseY - topY, 6);
        ctx.fill();
        ctx.strokeStyle = "#000";
        ctx.lineWidth = 4;
        ctx.stroke();


        // Pink lid across the top.
        ctx.fillStyle = selected ? "#ff73ba" : "#d889a8";
        ctx.beginPath();
        ctx.ellipse(centreX, topY, (right - left) / 2, 10, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = "#000";
        ctx.lineWidth = 2;
        ctx.stroke();

        // Label on the body.
        ctx.fillStyle = "#000";
        ctx.font = "bold 15px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("PAINT", centreX, topY + (baseY - topY) / 2);

        ctx.restore();
    }

    function drawResults(ctx) {
        if (personPhase !== "timeUp" || lastVerdicts.length === 0) {
            return;
        }

        const panelX = 24;
        const panelY = 24 + resultsOffset;
        const panelWidth = 300;
        const lineHeight = 24;
        const padding = 12;
        const panelHeight = resultsPanelHeight();

        ctx.save();

        ctx.fillStyle = "rgba(255, 255, 255, 1.0)";
        ctx.fillRect(panelX, panelY, panelWidth, panelHeight);

        ctx.strokeStyle = "#392b45";
        ctx.lineWidth = 4;
        ctx.strokeRect(panelX, panelY, panelWidth, panelHeight);

        ctx.textAlign = "left";
        ctx.textBaseline = "top";

        ctx.fillStyle = "#392b45";
        ctx.font = "italic bold 18px sans-serif";
        ctx.fillText("Brigadier Serenade's review", panelX + padding, panelY + padding);

        // Divider, so the remarks below read as their reply.
        ctx.strokeStyle = "#d8cbea";
        ctx.lineWidth = 2;

        ctx.beginPath();
        ctx.moveTo(panelX + padding, panelY + padding + lineHeight);
        ctx.lineTo(panelX + panelWidth - padding, panelY + padding + lineHeight);
        ctx.stroke();

        ctx.fillStyle = "#392b45";
        ctx.font = "bold 16px sans-serif";
        let textY = panelY + padding + lineHeight + 8;

        for (let verdict of lastVerdicts) {
            ctx.fillStyle = "#392b45";
            ctx.font = "bold 15px sans-serif";
            ctx.fillText(verdict.label, panelX + padding, textY);

            ctx.font = "14px sans-serif";
            ctx.fillText(verdict.detail, panelX + padding + 12, textY + 22);

            textY += 44;
        }
        textY += lineHeight / 2;
        ctx.strokeStyle = "#d8cbea";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(panelX + padding, textY);
        ctx.lineTo(panelX + panelWidth - padding, textY);
        ctx.stroke();

        textY += 10;

        ctx.fillStyle = "#392b45";
        ctx.font = "bold italic 16px sans-serif";
        ctx.fillText("Overall:", panelX + padding, textY);
        textY += 18;
        for (const line of wrapText(lackeyLine, panelWidth - padding * 2)) {
            ctx.fillText(line, panelX + padding, textY);
            textY += 22;
        }
        ctx.restore();

        if (resultsButton) {
            resultsButton.x = panelX + padding;
            resultsButton.y = panelY + panelHeight - padding - resultsButton.height;
        }
    }

    let menuTopOffset = -canvas.height;
    let menuBottomOffset = canvas.height;
    let menuExiting = false;

    const instructionsLines = [
        "The long war is over. Humanity has been defeated!",
        "Unicorns control the glitter now. All. Of. It.",
        "",
        "Despite losing a leg in the war, you are still extremely capable",
        "and have been given the honour of victory parade decoration duties.",
        "",
        "Each human slave must be decorated for the parade.",
        "You will be given a list of exactly what to apply and 15 seconds to do it.",
        "",
        "Use your hoof to select a decoration and then apply it to the slave.",
        "",
        "Brigadier Sugar Cube Serenade will review your work after each one. She is",
        "demanding. A bad parade reflects badly on her, and on General",
        "Thick Bickies. You do not want to end up in the Glitter Mines..."
    ];

    let instructionsOffset = canvas.height;
    function drawInstructions(ctx) {
        ctx.save();

        ctx.fillStyle = "rgba(16, 16, 24, 1.0)";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.fillStyle = "#fff0bd";
        ctx.font = "18px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "top";

        let y = 90 + instructionsOffset;

        for (const line of instructionsLines) {
            ctx.fillText(line, 360, y);
            y += 28;
        }

        ctx.restore();
    }

    function drawMainMenu(ctx) {
        ctx.save();
        ctx.fillStyle = "#8d78be";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.shadowColor = "#120f1c";
        ctx.shadowOffsetX = 3;
        ctx.shadowOffsetY = 6;
        ctx.shadowBlur = 6;
        ctx.font = "bold 48px sans-serif";
        drawArcText(ctx, "General Thick Bickies", canvas.width / 2, 280 + menuTopOffset, 220, -Math.PI / 2, false, colourLetters("General Thick Bickies", rainbowColours), 8);
        drawArcText(ctx, "Victory Parade!", canvas.width / 2, 280 + menuTopOffset, 160, -Math.PI / 2, false, colourLetters("Victory Parade!", rainbowColours), 8);
        ctx.restore();

        if (startButton) {
            startButton.draw(ctx);
        }
    }

    function drawGameOver() {
        const width = canvas.width;
        const height = canvas.height;
        const groundLine = height - 40;

        // Mountain
        ctx.fillStyle = "#5c5c6a";
        ctx.fillRect(0, 0, width, height);

        polygon([
            [0, groundLine], [0, 320], [160, 210], [330, 320],
            [480, 230], [640, 330], [width, 250], [width, groundLine]
        ], "#6f6f80");

        polygon([
            [0, groundLine], [0, 400], [180, 300], [350, 420],
            [520, 310], [width, 400], [width, groundLine]
        ], "#48485a");

        ctx.fillStyle = "#3a3a46";
        ctx.fillRect(0, groundLine, width, height - groundLine);

        const caveWidth = 700;
        const caveHeight = 500;
        const caveX = width / 2;
        const springY = groundLine - (caveHeight - caveWidth / 2);

        ctx.beginPath();
        ctx.moveTo(caveX - caveWidth / 2, groundLine);
        ctx.lineTo(caveX - caveWidth / 2, springY);
        ctx.arc(caveX, springY, caveWidth / 2, Math.PI, 0);
        ctx.lineTo(caveX + caveWidth / 2, groundLine);
        ctx.closePath();

        ctx.fillStyle = "#08080c";
        ctx.fill();

        ctx.strokeStyle = "#2b2b34";
        ctx.lineWidth = 8;
        ctx.stroke();

        ctx.save();
        ctx.font = "bold 80px sans-serif";
        ctx.shadowColor = "#08080c";
        ctx.shadowOffsetX = 6;
        ctx.shadowOffsetY = 18;
        ctx.shadowBlur = 6;
        drawArcText(ctx, "Glitter Mines", caveX, springY, caveWidth / 2 + 30, -Math.PI / 2, false, colourLetters("Glitter Mines", glitterColours), 12);
        ctx.restore();
    }

    // Falling confetti for the parade.
    const confetti = [];

    for (let index = 0; index < 60; index++) {
        confetti.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            size: 4 + Math.random() * 6,
            speed: 0.6 + Math.random() * 1.6,
            colour: (index % 2 ? rainbowColours : glitterColours)[index % 6]
        });
    }

    function drawConfetti(ctx) {
        for (const piece of confetti) {
            piece.y += piece.speed;

            if (piece.y > canvas.height) {
                piece.y = -piece.size;
                piece.x = Math.random() * canvas.width;
            }

            ctx.fillStyle = piece.colour;
            ctx.fillRect(piece.x, piece.y, piece.size, piece.size);
        }
    }


    function drawParade() {
        ctx.fillStyle = "#101018";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        drawConfetti(ctx);
        ctx.save();
        ctx.fillStyle = "#f138c3";
        ctx.font = "bold 48px sans-serif";
        drawArcText(ctx, "Hail General Thick Bickies!", canvas.width / 2, 280, 220, -Math.PI / 2, false, colourLetters("Hail General Thick Bickies!", rainbowColours), 8);
        ctx.restore();
    }

    function getLackeyFeedback() {
        if (playerInDanger >= 4) {
            return pick(["That's it! Off to the mines.", "Enjoy the mines.", "Two words: Glitter. Mines."]);
        } else if (playerInDanger >= 3) {
            return pick(["One more mistake and it's the mines.", "One last chance!", "Call yourself a unicorn?!"]);
        }

        const lines = [
            [   
                // danger 0
                ["Not bad.", "Not bad, but not great.", "Needs improvement, quickly."], // "good"
                ["Sloppy!", "Rushed.", "Don't let it happen again!"] // "bad"
            ],
            [
                // danger 1
                ["Adequate but get better fast!", "Not impressed.", ""], // "good"
                ["Poor. I expect better.", "Not good enough.", "Weak. Like a human did it."]  // "bad"
            ],
            [
                // danger 2
                ["You make problems for me, I can make worse problems for you.", "Are you trying to anger me?", ""], // "good"
                ["You are making this worse for yourself.", "The General holds grudges!", "How are you this bad?!"]  // "bad"
            ]
        ];

        return pick(lines[playerInDanger][lastPersonOutcome === "bad" ? 1 : 0]);
    }

    function getResultButtonText() {
        if (playerInDanger >= 4) {
            return "Please! No!!!";
        } else if (peopleCompleted === peopleCompletedTarget) {
            return "Victory Parade!";
        } else if (lastPersonOutcome === "good") {
            return "I live to decorate!";
        } else {
            return "Yes Brigadier!";
        }
    }

    function showEndScreen() {
        mainMenuButton = null;

        setTimeout(() => {
            if (state !== "gameover" && state !== "parade") {
                return;
            }

            mainMenuButton = createButton("Main Menu", 0, canvas.height + 40, leaveEndScreen, { fontSize: 28, height: 72, width: 260 });
            mainMenuButton.x = (canvas.width - mainMenuButton.width) / 2;

            tween(mainMenuButton.y, canvas.height * 0.72, 1400, value => mainMenuButton.y = value, null);
        }, 1500);
    }

    function leaveEndScreen() {
        const target = canvas.height + mainMenuButton.height + 40;

        tween(mainMenuButton.y, target, 500, value => mainMenuButton.y = value, () => {
            mainMenuButton = null;
            showMainMenu();
        });
    }


    function showMainMenu() {
        state = "menu";
        menuExiting = false;
        menuTopOffset = -canvas.height;
        menuBottomOffset = canvas.height;

        startButton = createButton("Let's get started!", 0, canvas.height / 2, startMenuExit, { fontSize: 32, height: 80, width: 280 });

        const homeX = (canvas.width - startButton.width) / 2;
        startButton.x = -startButton.width - 40;

        tween(menuTopOffset, 0, 800, value => menuTopOffset = value, () => {
            tween(menuBottomOffset, 0, 600, value => menuBottomOffset = value, () => {
                tween(startButton.x, homeX, 800, value => startButton.x = value, null);
            });
        });
    }

    function init() {
        // need it for cursor purposes!
        unicorn = createUnicorn(canvas);
        showMainMenu();
        requestAnimationFrame(gameLoop);
    }

    function startMenuExit() {
        if (menuExiting) {
            return;
        }
        menuExiting = true;

        let finished = 0;

        function oneDone() {
            finished++;

            if (finished === 3) {
                startGame();
            }
        }

        const buttonTarget = canvas.width + startButton.width + 40;

        tween(menuTopOffset, -canvas.height, 500, value => menuTopOffset = value, oneDone);
        tween(menuBottomOffset, canvas.height, 500, value => menuBottomOffset = value, oneDone);
        tween(startButton.x, buttonTarget, 500, value => startButton.x = value, oneDone);
    }

    function startGame() {
        state = "game";
        startButton = null;

        instructionsButton = createButton("You can rely on me!", 0, canvas.height * 0.8, closeInstructions, { fontSize: 28, height: 72, width: 320 });
        instructionsButton.x = (canvas.width - instructionsButton.width) / 2;
        instructionsOpen = true;
        instructionsOffset = canvas.height;
        tween(instructionsOffset, 0, 400, value => instructionsOffset = value, null);

        personTimeRemaining = personTimeLimit;
    }

    function closeInstructions() {
        tween(instructionsOffset, canvas.height, 400, value => instructionsOffset = value, () => {
            instructionsOpen = false;
            instructionsButton = null;
            start();
        });
    }

    function start() {
        playerInDanger = 1;
        peopleCompleted = 0;

        beginPerson();
    }

    function draw(time) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        switch (state) {
            case "menu":
                drawMainMenu(ctx);

                if (startButton) {
                    startButton.draw(ctx);
                }

                drawUnicorn(ctx, unicorn, true);
                break;
            case "settings":
                break;
            case "game":
                if (instructionsOpen) {
                    drawInstructions(ctx);

                    if (instructionsButton) {
                        instructionsButton.y = canvas.height * 0.8 + instructionsOffset;
                        instructionsButton.draw(ctx);
                    }

                    drawUnicorn(ctx, unicorn, time, true);
                }
                else if (!isPaused) {
                    // move decorations with the person.
                    ctx.save();
                    ctx.translate(personOffset, 0);
                    drawPersonBase(person);
                    drawPersonLayers(ctx);
                    drawPersonFace(person);
                    ctx.restore();

                    drawToolBoxes(ctx);
                    drawCurrentHelpText(ctx);
                    drawRequirements(ctx);
                    drawResults(ctx);

                    if (personPhase === "timeUp" && resultsButton) {
                        resultsButton.draw(ctx);
                    }

                    // rainbow renders behind the leg and hoof
                    if (unicorn.visible && currentTool === "rainbow") {
                        const leg = solveUnicornLeg(unicorn, time);
                        drawSelectedToolAtHoof(ctx, currentTool, leg, getHoofAngle(leg), toolRotation, currentHornStyle);
                    }

                    drawUnicorn(ctx, unicorn, time, false);

                    // horn and brush render in front of the leg
                    if (unicorn.visible && currentTool && currentTool !== "rainbow") {
                        const leg = solveUnicornLeg(unicorn, time);
                        drawSelectedToolAtHoof(ctx, currentTool, leg, getHoofAngle(leg), toolRotation, currentHornStyle);
                    }

                    if (unicorn.visible) {
                        const leg = solveUnicornLeg(unicorn, time);
                        // drawHoofPaint(ctx, leg.hoofX, leg.hoofY, getHoofAngle(leg), paintAmount, maxPaintAmount);
                        drawHoofPaint(ctx, leg, paintAmount, maxPaintAmount);
                        drawUnicornHoof(ctx, leg);
                        if (currentTool === "glitter") {
                            drawHeldGlitter(ctx, leg.hoofX, leg.hoofY, getHoofAngle(leg));
                        }
                    }
                }
                break;
            case "gameover":
                drawGameOver(ctx);
                if (mainMenuButton) {
                    mainMenuButton.draw(ctx);
                }

                drawUnicorn(ctx, unicorn, time, true);
                break;
            case "parade":
                drawParade(ctx);
                if (mainMenuButton) {
                    mainMenuButton.draw(ctx);
                }

                drawUnicorn(ctx, unicorn, time, true);
                break;
        }
    };

    let lastTime = performance.now();

    function gameLoop(time) {
        const deltaTime = Math.min(50, time - lastTime);

        lastTime = time;

        updateTweens(time);

        switch (state) {
            case "menu":
                updateUnicorn(unicorn, deltaTime);

                if (startButton && !menuExiting) {
                    const leg = solveUnicornLeg(unicorn);
                    startButton.updateHover(leg.hoofX, leg.hoofY);
                }
                break;
            case "settings":
                break;
            case "game":
                if (!isPaused) {
                    updateUnicorn(unicorn, deltaTime);
                    paintAtHoof(time);
                    if (person) {
                        updateUnicornPersonCollision(person, unicorn, time);
                    }

                    if (instructionsOpen && instructionsButton) {
                        const leg = solveUnicornLeg(unicorn);
                        instructionsButton.updateHover(leg.hoofX, leg.hoofY);
                    }

                    if (personPhase === "decorating" && !instructionsOpen) {
                        personTimeRemaining -= deltaTime;
                        if (personTimeRemaining <= 0) {
                            endDecoratingPhase();
                        }
                    }
                }
                break;
            case "gameover":
                updateUnicorn(unicorn, deltaTime);

                if (mainMenuButton) {
                    const leg = solveUnicornLeg(unicorn);
                    mainMenuButton.updateHover(leg.hoofX, leg.hoofY);
                }
                break;
            case "parade":
                updateUnicorn(unicorn, deltaTime);

                if (mainMenuButton) {
                    const leg = solveUnicornLeg(unicorn);
                    mainMenuButton.updateHover(leg.hoofX, leg.hoofY);
                }
                break;
        }

        draw(time);
        requestAnimationFrame(gameLoop);
    }

    init();

});