(function (window, document) {
    'use strict';

    var SVG_NAMESPACE = "http://www.w3.org/2000/svg";
    var STROKE_WIDTH = 20;
    var HANDLER_RADIUS = (STROKE_WIDTH / 2) + 2;
    var TOLERANCE = 40;

    function CircularSlider(options) {
        this.options = {};
        this.options.container = options.container || "slider";
        this.options.color = options.color || "green";
        this.options.max = options.max || 100;
        this.options.min = options.min || 0;
        this.options.step = options.step || 1;
        this.options.radius = options.radius || 50;
        this.options.valueChange = options.valueChange;

        this._validateOptions();
        this._init();
    }

    /**
     * Returns the current value which can only be a number divisible by step.
     *
     * @returns {number}
     */
    CircularSlider.prototype.getCurrentValue = function () {
        return this.options.min + (this.currentStepNo * this.options.step)
    };

    /**
     * Sets slider value based on the provided step number. We don't allow setting the value directly since
     * it can only be set to numbers divisible by step (this.options.step).
     *
     * @param stepNo
     */
    CircularSlider.prototype.setStepNo = function (stepNo) {
        var maxSteps = (this.options.max - this.options.min) / this.options.step;
        if (isNaN(parseFloat(stepNo)) || stepNo < 0 || stepNo > maxSteps) {
            throw new Error("Step number " + stepNo + " is not between 0 and " + maxSteps);
        }

        var radiansEnd = this._step2Rad(stepNo);
        var newPosition = this._calculateNewPosition(radiansEnd);

        this.slider.style.transition = "stroke-dashoffset 0.5s ease-in-out";
        this.handle.style.transition = "all 0.5s ease-in-out";

        requestAnimationFrame(function () {
            this.slider.setAttributeNS(null, 'stroke-dashoffset', `${this.circumference - newPosition.path}`);
            this.handle.style.transform = "rotate(" + newPosition.degrees + "deg)";
            this._updateState(newPosition, stepNo);
        }.bind(this));
    };

    /**
     * Moves slider on the orbit for the given coordinates.
     *
     * @param angelRadians
     */
    CircularSlider.prototype._move = function (angelRadians) {
        var newPosition = this._calculateNewPosition(angelRadians);
        if (!this._canMove(newPosition)) {
            return;
        }

        var nextStep = this._deg2Step(newPosition.degrees);
        this._updateState(newPosition, nextStep);

        this.slider.style.transition = "";
        this.handle.style.transition = "";

        requestAnimationFrame(function () {
            this.slider.setAttributeNS(null, 'stroke-dashoffset', `${this.circumference - newPosition.path}`);
            this.handle.style.transform = "rotate(" + newPosition.degrees + "deg)";
        }.bind(this));
    };

    /**
     * Returns false if slider wants to be moved past the top zero point.
     *
     * @param newPosition
     * @returns {boolean}
     */
    CircularSlider.prototype._canMove = function (newPosition) {
        return !(this.position.y < 0 && ((this.position.x >= 0 && newPosition.x < 0) || (this.position.x < 0 && newPosition.x >= 0)));
    };

    /**
     * Calculates new position, angles and path traveled based on local coordinate system (center = 0,0).
     *
     * @param angleRadians
     * @returns {{x: number, y: number, degrees: number, radians: number, path: number}}
     */
    CircularSlider.prototype._calculateNewPosition = function (angleRadians) {
        var newX = Math.round(Math.sin(angleRadians) * this.radius);
        var newY = Math.round(Math.cos(angleRadians) * this.radius) * -1;

        // we have our coordinates right, but angles need to be adjusted to positive number
        // basically just add 2PI - 360 degrees
        var radians360 = angleRadians < 0 ? angleRadians + 2 * Math.PI : angleRadians;
        var angelDegrees = radians360 * 180.0 / Math.PI;
        var path = Math.round(this.radius * radians360);

        return {
            x: Math.floor(angelDegrees) === 359 ? -1 : newX,
            y: newY,
            degrees: angelDegrees,
            radians: radians360,
            path: path
        };
    };

    CircularSlider.prototype._updateState = function (newPosition, nextStep) {
        // notify about value change
        if (this.currentStepNo !== nextStep && (this.options.valueChange && typeof(this.options.valueChange) === 'function')) {
            this.currentStepNo = nextStep; // set step here so we send the latest value
            this.options.valueChange(this.getCurrentValue());
        }

        // update slider internal state
        this.value = this._deg2Val(newPosition.degrees);
        this.currentStepNo = nextStep;
        this.position = newPosition;
    };

    CircularSlider.prototype._validateOptions = function () {
        var step = this.options.step;
        var min = this.options.min;
        var max = this.options.max;

        if (min > max) {
            throw new Error("Min " + min + " must be smaller than max " + max + "!");
        }

        if (max % step !== 0 || min % step !== 0) {
            throw new Error("Min " + min + " and max " + max + " + must be divisible by step " + step + "!");
        }

        if (this.options.radius > 200 || this.options.radius < 0) {
            throw new Error("Radius must be between 1 and 200. The slider will adjust the to the size of the container automatically. Radius 200 means slider will be touching the boundaries");
        }
    };

    /**
     * Initializes (calculates values of) all properties and creates a slider.
     */
    CircularSlider.prototype._init = function () {
        this.centerX = 0;
        this.centerY = 0;
        this.radius = this.options.radius - (STROKE_WIDTH / 2); // subtract border width from radius
        this.circumference = this.options.radius * 2 * Math.PI;
        this.currentStepNo = 0;
        this.isDragging = false;
        this.position = this._calculateNewPosition(this.centerX, this.centerY - this.radius);
        this.value = this.options.min;

        this.lastTouchType = '';
        this.animationFrameId = null;

        this._initSlider();
        this._initEventHandlers();
    };

    /**
     * Creates slider composed of underlying stripped SVG circle and top colored circle which will behave as slider.
     */
    CircularSlider.prototype._initSlider = function () {
        this.container = document.getElementById(this.options.container);

        // create root svg only when the first slider is added to the container.
        this.rootSVG = document.getElementById("sliderRootSVG");
        if (this.rootSVG === null) {
            this.rootSVG = this._createRootSVG(this.container.offsetWidth);
            this.container.appendChild(this.rootSVG);
        }

        this.slider = this._createSliderCircle();
        this.handle = this._createHandle();
        this.clickCircle = this._createClickCircle();

        this.rootSVG.appendChild(this._createEmptyCircle());
        this.rootSVG.appendChild(this.clickCircle);
        this.rootSVG.appendChild(this.slider);
        this.rootSVG.appendChild(this.handle);
    };

    /**
     * Creates root svg to which all sliders residing in the same container are later appended.
     * @returns {SVGCircleElement}
     */
    CircularSlider.prototype._createRootSVG = function (boxSize) {
        var svg = document.createElementNS(SVG_NAMESPACE, "svg");

        // let's keep it a square
        svg.setAttributeNS(null, "id", "sliderRootSVG");
        svg.setAttributeNS(null, "width", boxSize);
        svg.setAttributeNS(null, "height", boxSize);
        svg.setAttributeNS(null, "viewBox", "-200 -200 400 400");

        return svg;
    };

    CircularSlider.prototype._transformClientToLocalCoordinate = function (svgPoint, event) {
        svgPoint.x = event.clientX;
        svgPoint.y = event.clientY;

        return svgPoint.matrixTransform(this.rootSVG.getScreenCTM().inverse());
    };

    /**
     * Creates new SVG circle used as a top slider.
     */
    CircularSlider.prototype._createSliderCircle = function () {
        var slider = this._createCircle();

        slider.setAttributeNS(null, 'class', 'top-slider');
        slider.setAttributeNS(null, 'transform', 'rotate(-90)');
        slider.setAttributeNS(null, 'stroke-dasharray', `${this.circumference} ${this.circumference}`);
        slider.setAttributeNS(null, 'stroke-dashoffset', `${this.circumference}`);

        slider.style.stroke = this.options.color;
        slider.style.strokeWidth = STROKE_WIDTH + "px";

        return slider;
    };

    /**
     * Creates transparent circle so we can click on it (dashed border is not click-able everywhere)
     * @returns SVG
     */
    CircularSlider.prototype._createClickCircle = function () {
        var slider = this._createCircle();

        slider.style.strokeWidth = STROKE_WIDTH + "px";
        slider.style.stroke = "transparent";

        return slider;
    };

    /**
     * Creates new SVG circle with dashed border used as empty "underlying" slider.
     */
    CircularSlider.prototype._createEmptyCircle = function () {
        var slider = this._createCircle();

        slider.setAttributeNS(null, 'class', 'dashed-circle');
        slider.setAttributeNS(null, 'transform', 'rotate(-90)');
        slider.style.strokeWidth = STROKE_WIDTH + "px";
        slider.style.strokeDasharray = "5, 2";

        return slider;
    };

    /**
     * Creates new SVG circle element based on passed options.
     *
     * @returns {SVGCircleElement}
     */
    CircularSlider.prototype._createCircle = function () {
        var slider = document.createElementNS(SVG_NAMESPACE, 'circle');
        slider.setAttributeNS(null, "cx", this.centerX);
        slider.setAttributeNS(null, "cy", this.centerY);
        slider.setAttributeNS(null, "r", this.radius);
        slider.setAttributeNS(null, "fill", "none");

        return slider;
    };

    /**
     * Creates a handle for the slider.
     */
    CircularSlider.prototype._createHandle = function () {
        var handle = document.createElementNS(SVG_NAMESPACE, 'circle');
        handle.setAttributeNS(null, "cx", `${this.centerX}`);
        handle.setAttributeNS(null, "cy", `${this.centerY - this.radius}`);
        handle.setAttributeNS(null, "r", `${HANDLER_RADIUS}`);
        handle.setAttributeNS(null, "fill", "#fff");
        handle.setAttributeNS(null, "class", "handle");
        handle.setAttributeNS(null, "id", "handle" + this.options.container + this.radius); // add uniqueId

        return handle;
    };

    CircularSlider.prototype._deg2Step = function (deg) {
        var val = this._deg2Val(deg);

        return this._val2Step(val);
    };

    CircularSlider.prototype._deg2Val = function (deg) {
        var range = this.options.max - this.options.min;

        return Math.round(deg * (range / 360.0)) + this.options.min;
    };

    CircularSlider.prototype._val2Step = function (val) {
        return Math.round((val - this.options.min) / this.options.step)
    };

    CircularSlider.prototype._step2Rad = function (stepNo) {
        var val = stepNo * this.options.step + this.options.min;
        var adjustedVal = val - this.options.min;
        var range = this.options.max - this.options.min;
        var degrees = this.options.max === val ? 359.99 : (Math.round(adjustedVal * (360.0 / range))) % 360;

        return Math.round(degrees * Math.PI / 180 * 100) / 100;
    };

    CircularSlider.prototype._point2Radians = function (x, y) {
        // calculate distance from rotated circle (0° is on top)
        // replacing x and y in Math.atan2 method rotates the axis for 90 degrees but in wrong direction
        // multiply Y with -1 to "rotate" for 180° in the right direction :)
        return Math.atan2(x - this.centerX, -y - this.centerY);
    };

    CircularSlider.prototype._initEventHandlers = function () {
        this.container.addEventListener("mousemove", function (e) {
            this._handleDrag(e);
        }.bind(this));
        this.container.addEventListener("mouseup", function (e) {
            this._cancelDrag(e);
        }.bind(this));
        this.container.addEventListener("mouseleave", function (e) {
            this._cancelDrag(e);
        }.bind(this));

        this.handle.addEventListener("touchmove", function (e) {
            this._touchHandler(e);
        }.bind(this));
        this.container.addEventListener("touchcancel", function (e) {
            this._touchHandler(e);
        }.bind(this));
        this.container.addEventListener("touchend", function (e) {
            this._touchHandler(e);
        });

        this.clickCircle.addEventListener('click', function (e) {
            this._handleSliderClick(e);
        }.bind(this));
        this.clickCircle.addEventListener("touchend", function (e) {
            this._touchHandler(e);
        }.bind(this));
        this.clickCircle.addEventListener("touchstart", function (e) {
            this._touchHandler(e);
        }.bind(this));

        this.slider.addEventListener('click', function (e) {
            this._handleSliderClick(e);
        }.bind(this));
        this.slider.addEventListener("touchend", function (e) {
            this._touchHandler(e);
        }.bind(this));
        this.slider.addEventListener("touchstart", function (e) {
            this._touchHandler(e);
        }.bind(this));

        this.handle.addEventListener("touchstart", function (e) {
            this._touchHandler(e);
        }.bind(this));
        this.handle.addEventListener("mousedown", function (e) {
            this._startDrag(e);
        }.bind(this));
    };

    CircularSlider.prototype._startDrag = function (e) {
        e.preventDefault();
        this.isDragging = true;
    };

    /**
     * Handles drag as long as the touch/mouse is inside the tolerance radius.
     * @param e
     */
    CircularSlider.prototype._handleDrag = function (e) {
        e.preventDefault();
        if (!this.isDragging) {
            return;
        }

        var svgPoint = this.rootSVG.createSVGPoint();
        var localCoords = this._transformClientToLocalCoordinate(svgPoint, e);
        var mouseHandleOffsetX = this.position.x - localCoords.x;
        var mouseHandleOffsetY = this.position.y - localCoords.y;
        if (mouseHandleOffsetX > TOLERANCE || mouseHandleOffsetY > TOLERANCE) {
            this._cancelDrag(e);
        } else {
            var angelRadians = this._point2Radians(localCoords.x, localCoords.y);
            this._move(angelRadians);
        }
    };

    /**
     * Cancels drag and finishes the move by scrolling to the closest step.
     *
     * @param e
     */
    CircularSlider.prototype._cancelDrag = function (e) {
        e.preventDefault();
        // only complete step if you are currently moving
        if (this.isDragging) {
            this.setStepNo(this._val2Step(this.value));
        }

        this.isDragging = false;
    };

    CircularSlider.prototype._handleSliderClick = function (e) {
        var svgPoint = this.rootSVG.createSVGPoint();
        var localCoords = this._transformClientToLocalCoordinate(svgPoint, e);
        var newPosition = this._calculateNewPosition(this._point2Radians(localCoords.x, localCoords.y));
        var nextStep = this._deg2Step(newPosition.degrees);

        if (this.currentStepNo === nextStep) {
            this.handle.classList.add('same-step-error');
            setTimeout(function () {
                this.handle.classList.remove('same-step-error')
            }.bind(this), 300);
        } else {
            this.setStepNo(nextStep);
        }
    };

    CircularSlider.prototype._touchHandler = function (e) {
        var touches = e.changedTouches;

        // Ignore multi-touch
        if (touches.length > 1) return;

        var touch = touches[0];
        var events = ["touchstart", "touchmove", "touchend", "touchcancel"];
        var mouseEvents = ["mousedown", "mousemove", "mouseup", "mouseleave"];
        var ev = events.indexOf(e.type);

        if (ev === -1) return;

        var type = e.type === events[2] && this.lastTouchType === events[0] ? 'click' : mouseEvents[ev];
        var simulatedEvent = document.createEvent("MouseEvent");
        simulatedEvent.initMouseEvent(type, true, true, window, 1,
            touch.screenX, touch.screenY, touch.clientX, touch.clientY, false, false, false, false, 0, null);

        touch.target.dispatchEvent(simulatedEvent);
        e.preventDefault();
        this.lastTouchType = e.type;
    };

    window.CircularSlider = CircularSlider;

}(window, document));