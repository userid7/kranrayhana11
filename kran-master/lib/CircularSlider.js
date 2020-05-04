import 'babel-polyfill'; // IE doesn't support Symbols!?! - https://stackoverflow.com/questions/33828840/symbol-is-undefined-in-ie-after-using-babel

window.requestAnimationFrame = window.requestAnimationFrame || window.mozRequestAnimationFrame || window.webkitRequestAnimationFrame || window.msRequestAnimationFrame || function(f){return setTimeout(f, 1000/60)}; // simulate calling code 60
window.cancelAnimationFrame = window.cancelAnimationFrame || window.mozCancelAnimationFrame || function(requestID){clearTimeout(requestID)}; //fall back

const SVG_NAMESPACE = "http://www.w3.org/2000/svg";

const _validateOptions = Symbol('validateOptions');
const _init = Symbol('init');
const _isIEorEdge = Symbol('isIEorEdge');
const _createRootSVG = Symbol('createRootSVG');
const _initSlider = Symbol("addSliderToRootSVG");
const _createSliderCircle = Symbol('createSliderCircle');
const _createEmptyCircle = Symbol('createEmptyCircle');
const _createClickCircle = Symbol('createClickCircle');
const _createCircle = Symbol('createSlider');
const _createHandle = Symbol('createHandle');
const _deg2Step = Symbol('deg2Step');
const _step2Rad = Symbol('step2Rad');
const _val2Step = Symbol('_val2Step');
const _deg2Val = Symbol('deg2Val');
const _point2Radians = Symbol('point2Radians');
const _setStepFallback = Symbol('setStepFallback');
const _move = Symbol('move');
const _canMove = Symbol('cantMove');
const _updateState = Symbol("updateState");
const _cancelDrag = Symbol('cancelDrag');
const _startDrag = Symbol('startDrag');
const _handleDrag = Symbol('handleDrag');
const _handleSliderClick = Symbol('handleSlideClick');
const _initEventHandlers = Symbol('initEventHandlers');
const _touchHandler = Symbol('touchHandler');
const _calculateNewPosition = Symbol('calculateNewPoint');
const _transformClientToLocalCoordinate = Symbol('transformClientToLocalCoordinate');

const STROKE_WIDTH = 20;
const HANDLER_RADIUS = (STROKE_WIDTH / 2) + 2;
const TOLERANCE = 40;

export default class CircularSlider {

    defaults = {
        container: "slider",
        color: "green",
        max: 100,
        min: 0,
        step: 1,
        radius: 50
    };

    constructor(options) {
        this.options = {...this.defaults, ...options};

        this[_validateOptions]();
        this[_init]();
    }

    /**
     * Returns the current value which can only be a number divisible by step.
     *
     * @returns {number}
     */
    get currentValue() {
        return this.options.min + (this.currentStepNo * this.options.step)
    }

    /**
     * Sets slider value based on the provided step number. We don't allow setting the value directly since
     * it can only be set to numbers divisible by step (this.options.step).
     *
     * @param stepNo
     */
    set stepNo(stepNo) {
        const maxSteps = (this.options.max - this.options.min) / this.options.step;
        if (isNaN(parseFloat(stepNo)) || stepNo < 0 || stepNo > maxSteps) {
            throw new Error("Step number " + stepNo + " is not between 0 and " + maxSteps);
        }

        if (this.isIEorEdge) {
            this[_setStepFallback](stepNo);
        } else {
            const radiansEnd = this[_step2Rad](stepNo);
            const newPosition = this[_calculateNewPosition](radiansEnd);

            this.slider.style.transition = "stroke-dashoffset 0.5s ease-in-out";
            this.handle.style.transition = "all 0.5s ease-in-out";

            requestAnimationFrame(() => {
                this.slider.setAttributeNS(null, 'stroke-dashoffset', `${this.circumference - newPosition.path}`);
                this.handle.style.transform = "rotate(" + newPosition.degrees + "deg)";
                this[_updateState](newPosition, stepNo);
            });
        }
    }

    /**
     * Used for Edge/IE because of it doesn't support SVG animation via CSS. :/
     * Animates slider by setting stroke-dashoffset and transform properties in a requestAnimationFrame loop.
     *
     * @param stepNo
     */
    [_setStepFallback](stepNo) {
        //stop current animation if in progress
        if (this.animationFrameId !== null) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }

        // calculate start/end points
        const radiansStart = this.position.radians;
        const radiansEnd = this[_step2Rad](stepNo);
        const isIncreasing = radiansStart < radiansEnd;
        let radiansMove = radiansStart;

        const animate = () => {
            // add easing if we are close to end of the step
            radiansMove += (Math.abs(radiansEnd - radiansMove) <= 0.2) ? (isIncreasing ? 0.01 : -0.01) : (isIncreasing ? 0.05 : -0.05);

            this[_move](radiansMove);

            // allow for a small error because of the rounding
            if ((Math.abs(radiansMove - radiansEnd) > 0.01)) {
                this.animationFrameId = requestAnimationFrame(animate);
            } else {
                this.animationFrameId = null; // animation ended
            }
        };

        this.animationFrameId = requestAnimationFrame(animate);
    }

    /**
     * Moves slider on the orbit for the given coordinates.
     *
     * @param angelRadians
     */
    [_move](angelRadians) {

        const newPosition = this[_calculateNewPosition](angelRadians);
        if (!this[_canMove](newPosition)) {
            return;
        }

        const nextStep = this[_deg2Step](newPosition.degrees);
        this[_updateState](newPosition, nextStep);

        if (this.isIEorEdge) {
            const transform = 'rotate(' + newPosition.degrees + ')';

            this.handle.setAttributeNS(null, 'transform', transform);
            this.slider.setAttributeNS(null, 'stroke-dashoffset', `${this.circumference - newPosition.path}`);
        } else {
            this.slider.style.transition = "";
            this.handle.style.transition = "";

            requestAnimationFrame(() => {
                this.slider.setAttributeNS(null, 'stroke-dashoffset', `${this.circumference - newPosition.path}`);
                this.handle.style.transform = "rotate(" + newPosition.degrees + "deg)";
            });
        }
    }

    /**
     * Returns false if slider wants to be moved past the top zero point.
     *
     * @param newPosition
     * @returns {boolean}
     */
    [_canMove](newPosition) {
        return !(this.position.y < 0 && ((this.position.x >= 0 && newPosition.x < 0) || (this.position.x < 0 && newPosition.x >= 0)));
    }

    /**
     * Calculates new position, angles and path traveled based on local coordinate system (center = 0,0).
     *
     * @param angleRadians
     * @returns {{x: number, y: number, degrees: number, radians: number, path: number}}
     */
    [_calculateNewPosition](angleRadians) {
        const newX = Math.round(Math.sin(angleRadians) * this.radius);
        const newY = Math.round(Math.cos(angleRadians) * this.radius) * -1;

        // we have our coordinates right, but angles need to be adjusted to positive number
        // basically just add 2PI - 360 degrees
        const radians360 = angleRadians < 0 ? angleRadians + 2 * Math.PI : angleRadians;
        const angelDegrees = radians360 * 180.0 / Math.PI;
        const path = Math.round(this.radius * radians360);

        return {
            x: Math.floor(angelDegrees) === 359 ? -1 : newX,
            y: newY,
            degrees: angelDegrees,
            radians: radians360,
            path: path
        };
    }

    [_updateState](newPosition, nextStep) {
        // notify about value change
        if (this.currentStepNo !== nextStep && (this.options.valueChange && typeof(this.options.valueChange) === 'function')) {
            this.currentStepNo = nextStep; // set step here so we send the latest value
            this.options.valueChange(this.currentValue);
        }

        // update slider internal state
        this.value = this[_deg2Val](newPosition.degrees);
        this.currentStepNo = nextStep;
        this.position = newPosition;
    }

    [_validateOptions]() {
        const step = this.options.step;
        const min = this.options.min;
        const max = this.options.max;

        if (min > max) {
            throw new Error("Min " + min + " must be smaller than max " + max + "!");
        }

        if (max % step !== 0 || min % step !== 0) {
            throw new Error("Min " + min + " and max " + max + " + must be divisible by step " + step + "!");
        }

        if (this.options.radius > 200 || this.options.radius < 0) {
            throw new Error("Radius must be between 1 and 200. The slider will adjust the to the size of the container automatically. Radius 200 means slider will be touching the boundaries");
        }
    }

    /**
     * Initializes (calculates values of) all properties and creates a slider.
     */
    [_init]() {
        this.isIEorEdge = this[_isIEorEdge](); // cache the result since we'll be checking it very often
        this.centerX = 0;
        this.centerY = 0;
        this.radius = this.options.radius - (STROKE_WIDTH / 2); // subtract border width from radius
        this.circumference = this.options.radius * 2 * Math.PI;
        this.currentStepNo = 0;
        this.isDragging = false;
        this.position = this[_calculateNewPosition](this.centerX, this.centerY - this.radius);
        this.value = this.options.min;

        this.lastTouchType = '';
        this.animationFrameId = null;

        this[_initSlider]();
        this[_initEventHandlers]();
    }

    /**
     * Creates slider composed of underlying stripped SVG circle and top colored circle which will behave as slider.
     */
    [_initSlider]() {
        this.container = document.getElementById(this.options.container);

        // create root svg only when the first slider is added to the container.
        this.rootSVG = document.getElementById("sliderRootSVG");
        if (this.rootSVG === null) {
            this.rootSVG = this[_createRootSVG](this.container.offsetWidth);
            this.container.appendChild(this.rootSVG);
        }

        this.slider = this[_createSliderCircle]();
        this.handle = this[_createHandle]();
        this.clickCircle = this[_createClickCircle]();

        this.rootSVG.appendChild(this[_createEmptyCircle]());
        this.rootSVG.appendChild(this.clickCircle);
        this.rootSVG.appendChild(this.slider);
        this.rootSVG.appendChild(this.handle);
    }

    /**
     * Creates root svg to which all sliders residing in the same container are later appended.
     * @returns {SVGCircleElement}
     */
    [_createRootSVG](boxSize) {
        const svg = document.createElementNS(SVG_NAMESPACE, "svg");

        // let's keep it a square
        svg.setAttributeNS(null, "id", "sliderRootSVG");
        svg.setAttributeNS(null, "width", boxSize);
        svg.setAttributeNS(null, "height", boxSize);
        svg.setAttributeNS(null, "viewBox", "-200 -200 400 400");

        return svg;
    }

    [_transformClientToLocalCoordinate](svgPoint, event) {
        svgPoint.x = event.clientX;
        svgPoint.y = event.clientY;

        return svgPoint.matrixTransform(this.rootSVG.getScreenCTM().inverse());
    }

    /**
     * Creates new SVG circle used as a top slider.
     */
    [_createSliderCircle]() {
        const slider = this[_createCircle]();

        slider.setAttributeNS(null, 'class', 'top-slider');
        slider.setAttributeNS(null, 'transform', 'rotate(-90)');
        slider.setAttributeNS(null, 'stroke-dasharray', `${this.circumference} ${this.circumference}`);
        slider.setAttributeNS(null, 'stroke-dashoffset', `${this.circumference}`);

        slider.style.stroke = this.options.color;
        slider.style.strokeWidth = STROKE_WIDTH + "px";

        return slider;
    }

    /**
     * Creates transparent circle so we can click on it (dashed border is not click-able everywhere)
     * @returns SVG
     */
    [_createClickCircle]() {
        const slider = this[_createCircle]();

        slider.style.strokeWidth = STROKE_WIDTH + "px";
        slider.style.stroke = "transparent";

        return slider;
    }

    /**
     * Creates new SVG circle with dashed border used as empty "underlying" slider.
     */
    [_createEmptyCircle]() {
        const slider = this[_createCircle]();

        slider.setAttributeNS(null, 'class', 'dashed-circle');
        slider.setAttributeNS(null, 'transform', 'rotate(-90)');
        slider.style.strokeWidth = STROKE_WIDTH + "px";
        slider.style.strokeDasharray = "5, 2";

        return slider;
    }

    /**
     * Creates new SVG circle element based on passed options.
     *
     * @returns {SVGCircleElement}
     */
    [_createCircle]() {
        const slider = document.createElementNS(SVG_NAMESPACE, 'circle');
        slider.setAttributeNS(null, "cx", this.centerX);
        slider.setAttributeNS(null, "cy", this.centerY);
        slider.setAttributeNS(null, "r", this.radius);
        slider.setAttributeNS(null, "fill", "none");

        return slider;
    }

    /**
     * Creates a handle for the slider.
     */
    [_createHandle]() {
        const handle = document.createElementNS(SVG_NAMESPACE, 'circle');
        handle.setAttributeNS(null, "cx", `${this.centerX}`);
        handle.setAttributeNS(null, "cy", `${this.centerY - this.radius}`);
        handle.setAttributeNS(null, "r", `${HANDLER_RADIUS}`);
        handle.setAttributeNS(null, "fill", "#fff");
        handle.setAttributeNS(null, "class", "handle");
        handle.setAttributeNS(null, "id", "handle" + this.options.container + this.radius); // add uniqueId

        return handle;
    }

    [_deg2Step](deg) {
        const val = this[_deg2Val](deg);

        return this[_val2Step](val);
    }

    [_deg2Val](deg) {
        const range = this.options.max - this.options.min;

        return Math.round(deg * (range / 360.0)) + this.options.min;
    }

    [_val2Step](val) {
        return Math.round((val - this.options.min) / this.options.step)
    }

    [_step2Rad](stepNo) {
        const val = stepNo * this.options.step + this.options.min;
        const adjustedVal = val - this.options.min;
        const range = this.options.max - this.options.min;
        const degrees = this.options.max === val ? 359.99 : (Math.round(adjustedVal * (360.0 / range))) % 360;

        return Math.round(degrees * Math.PI / 180 * 100) / 100;
    }

    [_point2Radians](x, y) {
        // calculate distance from rotated circle (0° is on top)
        // replacing x and y in Math.atan2 method rotates the axis for 90 degrees but in wrong direction
        // multiply Y with -1 to "rotate" for 180° in the right direction :)
        return Math.atan2(x - this.centerX, -y - this.centerY);
    }

    [_initEventHandlers]() {
        this.container.addEventListener("mousemove", e => this[_handleDrag](e));
        this.container.addEventListener("mouseup", e => this[_cancelDrag](e));
        this.container.addEventListener("mouseleave", e => this[_cancelDrag](e));

        this.handle.addEventListener("touchmove", e => this[_touchHandler](e));
        this.container.addEventListener("touchcancel", e => this[_touchHandler](e));
        this.container.addEventListener("touchend", e => this[_touchHandler](e));

        this.clickCircle.addEventListener('click', e => this[_handleSliderClick](e));
        this.clickCircle.addEventListener("touchend", e => this[_touchHandler](e));
        this.clickCircle.addEventListener("touchstart", e => this[_touchHandler](e));

        this.slider.addEventListener('click', e => this[_handleSliderClick](e));
        this.slider.addEventListener("touchend", e => this[_touchHandler](e));
        this.slider.addEventListener("touchstart", e => this[_touchHandler](e));

        this.handle.addEventListener("touchstart", e => this[_touchHandler](e));
        this.handle.addEventListener("mousedown", e => this[_startDrag](e));
    }

    [_startDrag](e) {
        e.preventDefault();
        this.isDragging = true;
    };

    /**
     * Handles drag as long as the touch/mouse is inside the tolerance radius.
     * @param e
     */
    [_handleDrag](e) {
        e.preventDefault();
        if (!this.isDragging) {
            return;
        }

        const svgPoint = this.rootSVG.createSVGPoint();
        const localCoords = this[_transformClientToLocalCoordinate](svgPoint, e);
        const mouseHandleOffsetX = this.position.x - localCoords.x;
        const mouseHandleOffsetY = this.position.y - localCoords.y;
        if (mouseHandleOffsetX > TOLERANCE || mouseHandleOffsetY > TOLERANCE) {
            this[_cancelDrag](e);
        } else {
            const angelRadians = this[_point2Radians](localCoords.x, localCoords.y);
            this[_move](angelRadians);
        }
    }

    /**
     * Cancels drag and finishes the move by scrolling to the closest step.
     *
     * @param e
     */
    [_cancelDrag](e) {
        e.preventDefault();
        // only complete step if you are currently moving
        if (this.isDragging) {
            this.stepNo = this[_val2Step](this.value);
        }

        this.isDragging = false;
    }

    [_handleSliderClick](e) {
        const svgPoint = this.rootSVG.createSVGPoint();
        const localCoords = this[_transformClientToLocalCoordinate](svgPoint, e);
        const newPosition = this[_calculateNewPosition](this[_point2Radians](localCoords.x, localCoords.y));
        const nextStep = this[_deg2Step](newPosition.degrees);

        if (this.currentStepNo === nextStep) {
            this.handle.classList.add('same-step-error');
            setTimeout(() => this.handle.classList.remove('same-step-error'), 300);
        } else {
            this.stepNo = nextStep;
        }
    }

    [_touchHandler](e) {
        const touches = e.changedTouches;

        // Ignore multi-touch
        if (touches.length > 1) return;

        const touch = touches[0];
        const events = ["touchstart", "touchmove", "touchend", "touchcancel"];
        const mouseEvents = ["mousedown", "mousemove", "mouseup", "mouseleave"];
        const ev = events.indexOf(e.type);

        if (ev === -1) return;

        const type = e.type === events[2] && this.lastTouchType === events[0] ? 'click' : mouseEvents[ev];
        const simulatedEvent = document.createEvent("MouseEvent");
        simulatedEvent.initMouseEvent(type, true, true, window, 1,
            touch.screenX, touch.screenY, touch.clientX, touch.clientY, false, false, false, false, 0, null);

        touch.target.dispatchEvent(simulatedEvent);
        e.preventDefault();
        this.lastTouchType = e.type;
    };

    [_isIEorEdge]() {
        return document.documentMode || navigator.appName === 'Microsoft Internet Explorer' || (navigator.appName === "Netscape" && navigator.appVersion.indexOf('Edge') > -1);
    }
}