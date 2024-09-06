import { isSolidColorSelected } from './utils/is-solid-color-selected.js';
import { MAX_SHADOW_BLUR_SIZE, MAX_STROKE_WIDTH, MAX_ROTATE } from './constants.js';

export class Canvas {
  #canvas = null;
  #ctx = null;
  #isDragging = false;
  #draggedTextbox = null;
  #dragStartX = 0;
  #dragStartY = 0;
  #eventListenersAdded = false;

  constructor(canvasEl) {
    this.#canvas = canvasEl;
    this.#ctx = this.#canvas.getContext('2d');
    this.#addEventListeners();
  }

  get width() {
    return this.#canvas.width;
  }

  set width(value) {
    this.#canvas.width = value;
  }

  get height() {
    return this.#canvas.height;
  }

  set height(value) {
    this.#canvas.height = value;
  }

  getDimensions() {
    return {
      width: this.width,
      height: this.height
    };
  }

  setDimensions({ width, height }) {
    this.width = width;
    this.height = height;
    return this;
  }

  toDataURL() {
    return this.#canvas.toDataURL();
  }

  draw(image, textboxes = new Map()) {
    this.currentImage = image;
    this.textboxes = textboxes;

    if (image == null) {
      return;
    }

    const canvas = this.#canvas;
    const ctx = this.#ctx;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (isSolidColorSelected(image)) {
      ctx.fillStyle = image;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    } else {
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    }

    let multiplier = 0;

    textboxes.forEach(textbox => {
      const { data } = textbox;

      multiplier += 1;

      ctx.save();

      ctx.font = `${data.fontWeight} ${(data.fontSize * canvas.width) / 1000}px ${data.font}`;
      ctx.fillStyle = data.fillColor;
      ctx.textAlign = data.textAlign;
      ctx.strokeStyle = data.strokeColor;

      const lineHeight = ctx.measureText('M').width + data.fontSize / 2;
      const xPos = canvas.width / 2;
      const shadowBlur = data.shadowBlur;
      const text = data.allCaps === true ? data.text.toUpperCase() : data.text;
      const textLines = text.split('\n');

      if (shadowBlur !== 0) {
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
        ctx.shadowBlur = Math.min(shadowBlur, MAX_SHADOW_BLUR_SIZE);
        ctx.shadowColor = data.strokeColor;
      }

      ctx.translate(xPos + data.offsetX, lineHeight * multiplier + data.offsetY);
      ctx.rotate((Math.min(data.rotate, MAX_ROTATE) * Math.PI) / 180);

      // First draw each line with shadow.
      textLines.forEach((text, index) => ctx.fillText(text, 0, index * lineHeight));

      // Since shadows of multiline text may be drawn over letters of neighbour lines
      // (when shadow blur is big enough), re-draw text without shadows.
      if (shadowBlur !== 0) {
        ctx.shadowBlur = 0;
        textLines.forEach((text, index) => ctx.fillText(text, 0, index * lineHeight));
      }

      if (data.strokeWidth > 0) {
        ctx.lineWidth = Math.min(data.strokeWidth, MAX_STROKE_WIDTH);
        textLines.forEach((text, index) => ctx.strokeText(text, 0, index * lineHeight));
      }

      ctx.restore();
    });

    return this;
  }

  clear() {
    this.#ctx.clearRect(0, 0, this.#canvas.width, this.#canvas.height);
    return this;
  }

  show() {
    this.#canvas.hidden = false;
    return this;
  }

  hide() {
    this.#canvas.hidden = true;
    return this;
  }

  static createInstance(canvasEl) {
    return new Canvas(canvasEl);
  }

  #addEventListeners() {
    if (this.#eventListenersAdded) return;

    this.#canvas.addEventListener('touchstart', this.#handleTouchStart.bind(this), {
      passive: false
    });
    this.#canvas.addEventListener('touchmove', this.#handleTouchMove.bind(this), {
      passive: false
    });
    this.#canvas.addEventListener('touchend', this.#handleTouchEnd.bind(this));

    this.#canvas.addEventListener('mousedown', this.#handleMouseDown.bind(this));
    this.#canvas.addEventListener('mousemove', this.#handleMouseMove.bind(this));
    this.#canvas.addEventListener('mouseup', this.#handleMouseUp.bind(this));

    this.#eventListenersAdded = true;
  }

  #handleMouseDown(e) {
    this.#startDragging(e.clientX, e.clientY);
  }

  #handleMouseMove(e) {
    if (this.#isDragging && this.#draggedTextbox) {
      this.#drag(e.clientX, e.clientY);
    }
  }

  #handleMouseUp() {
    this.#stopDragging();
  }

  #handleTouchStart(e) {
    e.preventDefault();
    const touch = e.touches[0];
    const rect = this.#canvas.getBoundingClientRect();
    const touchX = touch.clientX - rect.left;
    const touchY = touch.clientY - rect.top;
    this.#startDragging(touchX, touchY);
  }

  #handleTouchMove(e) {
    e.preventDefault();
    if (this.#isDragging && this.#draggedTextbox) {
      const touch = e.touches[0];
      const rect = this.#canvas.getBoundingClientRect();
      const touchX = touch.clientX - rect.left;
      const touchY = touch.clientY - rect.top;
      this.#drag(touchX, touchY);
    }
  }

  #handleTouchEnd(e) {
    e.preventDefault();
    this.#stopDragging();
  }

  #startDragging(clientX, clientY) {
    const rect = this.#canvas.getBoundingClientRect();
    const mouseX = clientX - rect.left;
    const mouseY = clientY - rect.top;

    this.textboxes.forEach((textbox, id) => {
      const { data } = textbox;
      const textX = this.#canvas.width / 2 + data.offsetX;
      const textY =
        (this.#ctx.measureText('M').width + data.fontSize / 2) *
          (Array.from(this.textboxes.keys()).indexOf(id) + 1) +
        data.offsetY;

      if (Math.abs(mouseX - textX) < 50 && Math.abs(mouseY - textY) < 50) {
        this.#isDragging = true;
        this.#draggedTextbox = textbox;
        this.#dragStartX = mouseX - data.offsetX;
        this.#dragStartY = mouseY - data.offsetY;
      }
    });
  }

  #drag(clientX, clientY) {
    const rect = this.#canvas.getBoundingClientRect();
    const mouseX = clientX - rect.left;
    const mouseY = clientY - rect.top;

    this.#draggedTextbox.data.offsetX = mouseX - this.#dragStartX;
    this.#draggedTextbox.data.offsetY = mouseY - this.#dragStartY;

    this.draw(this.currentImage, this.textboxes);
  }

  #stopDragging() {
    this.#isDragging = false;
    this.#draggedTextbox = null;
  }
}
