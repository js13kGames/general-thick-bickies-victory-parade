function createButton(text, x, y, onClick, { fontSize = 24, height = 64, width = 200, outline = 6 } = {}) {
    return {
        text, x, y, fontSize, height, width, outline,
        hovered: false,
        onClick,

        contains(x, y) {
            return x >= this.x && x <= this.x + this.width && y >= this.y && y <= this.y + this.height;
        },

        updateHover(x, y) {
            this.hovered = this.contains(x, y);
        },

        draw(ctx) {
            const centreX = this.x + this.width / 2;
            const centreY = this.y + this.height / 2;

            ctx.save();

            ctx.beginPath();
            ctx.roundRect(this.x, this.y, this.width, this.height, 8);
            ctx.fillStyle = this.hovered ? "#c99150" : "#a96f39";
            ctx.fill();
            ctx.strokeStyle = "#633c29";
            ctx.lineWidth = 4;
            ctx.stroke();

            ctx.fillStyle = "#fff0bd";
            ctx.font = "bold " + this.fontSize + "px sans-serif";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.lineJoin = "round";
            ctx.strokeStyle = "#633c29";
            ctx.lineWidth = this.outline;
            ctx.strokeText(this.text, centreX, centreY);
            ctx.fillText(this.text, centreX, centreY);

            ctx.restore();
        },

        click(x, y) {
            if (this.contains(x, y)) {
                this.onClick();
            }
        }
    };
}
