'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var PointerInteraction = require('ol/interaction/Pointer');
var css = require('ol/css');
var source = require('ol/source');
var layer = require('ol/layer');
var Feature = require('ol/Feature');
var Overlay = require('ol/Overlay');
var control = require('ol/control');
var geom = require('ol/geom');
var BaseObject = require('ol/Object');
var style = require('ol/style');
var sphere = require('ol/sphere');
var extent = require('ol/extent');
var Event = require('ol/events/Event');

function _interopDefaultLegacy (e) { return e && typeof e === 'object' && 'default' in e ? e : { 'default': e }; }

var PointerInteraction__default = /*#__PURE__*/_interopDefaultLegacy(PointerInteraction);
var Feature__default = /*#__PURE__*/_interopDefaultLegacy(Feature);
var Overlay__default = /*#__PURE__*/_interopDefaultLegacy(Overlay);
var BaseObject__default = /*#__PURE__*/_interopDefaultLegacy(BaseObject);
var Event__default = /*#__PURE__*/_interopDefaultLegacy(Event);

/**
 * @returns a vector which is orthogonal to the line between two points.
 * @private
 */
function getOrthogonalBasisVector(cp1, cp2) {
  const cp3 = [cp1[0], cp2[1]];
  const cp4 = [cp2[0], cp1[1]];

  const len = getPlanarDistance(cp1, cp2);
  const rise = getPlanarDistance(cp1, cp3);
  const run = getPlanarDistance(cp1, cp4);

  var riseFactor = rise / len;
  var runFactor = run / len;

  if (((cp1[0] - cp2[0]) * (cp1[1] - cp2[1])) < 0) {
    runFactor *= -1;
  }

  return [
    (-1) * riseFactor,
    runFactor,
  ];
}

/**
 * @returns the planar distance between the coordinates of two points.
 * @private
 */
function getPlanarDistance(p0, p1) {
  return Math.hypot(Math.abs(p0[0] - p1[0]), Math.abs(p0[1] - p1[1]));
}

/**
 * @returns the resulting vector of scaling a vector by a contant.
 * @private
 */
function scaleVector(v, c) {
  return [v[0] * c, v[1] * c];
}

/**
 * @returns the resulting vector of subtracting one vector from another.
 * @private
 */
function subtractVectors(va, vb) {
  return [va[0] - vb[0], va[1] - vb[1]];
}

/**
 * @returns the coordinates of a line segment which is wholy within the specified extent.
 * @private
 */
function cropLineSegmentByExtent(segCoords, extent$1) {
  const [p0, p1] = segCoords;

  const p0InExtent = extent.containsCoordinate(extent$1, p0);
  const p1InExtent = extent.containsCoordinate(extent$1, p1);

  // Both points within extent: return segCoords
  // One point within extent: return that point plus single intersection
  // Both points outside extent:
    // If two intersections: return those points
  // Else return undefined

  if (p0InExtent && p1InExtent) {
    return segCoords;
  }

  const extentBottomLeft = extent.getBottomLeft(extent$1);
  const extentTopRight = extent.getTopRight(extent$1);
  const extentTopLeft = extent.getTopLeft(extent$1);
  const extentBottomRight = extent.getBottomRight(extent$1);

  const intersections = [
    getLineIntersection(p0, p1, extentBottomLeft, extentBottomRight),
    getLineIntersection(p0, p1, extentTopLeft, extentTopRight),
    getLineIntersection(p0, p1, extentTopLeft, extentBottomLeft),
    getLineIntersection(p0, p1, extentTopRight, extentBottomRight)
  ].filter(i => !!i);

  if (!p0InExtent && !p1InExtent) {
    if (intersections.length > 1) {
      return intersections.slice(0, 2);
    }
    return undefined;
  }

  if (intersections.length < 1) {
    return undefined;
  }

  if (p0InExtent) {
    return [p0, intersections[0]];
  }

  if (p1InExtent) {
    return [p1, intersections[0]];
  }

}

/**
 * @returns the intersection point if the lines intersect, otherwise undefined.
 * Based on https://stackoverflow.com/a/1968345
 * @private
 */
function getLineIntersection(p0, p1, p2, p3) {
  const [p0_x, p0_y] = p0;
  const [p1_x, p1_y] = p1;
  const [p2_x, p2_y] = p2;
  const [p3_x, p3_y] = p3;

  const s1_x = p1_x - p0_x;
  const s1_y = p1_y - p0_y;
  const s2_x = p3_x - p2_x;
  const s2_y = p3_y - p2_y;

  const s = (-s1_y * (p0_x - p2_x) + s1_x * (p0_y - p2_y)) / (-s2_x * s1_y + s1_x * s2_y);
  const t = ( s2_x * (p0_y - p2_y) - s2_y * (p0_x - p2_x)) / (-s2_x * s1_y + s1_x * s2_y);

  if (s >= 0 && s <= 1 && t >= 0 && t <= 1) {
    // Collision detected

    const i_x = p0_x + (t * s1_x);
    const i_y = p0_y + (t * s1_y);

    return [i_x, i_y];
  }

  return undefined; // No collision
}

/**
 * @private
 */
class OrthogonalMovementHandle extends Feature__default['default'] {
  /**
   * @param {Object=} opt_options Feature options.
   */
  constructor(opt_options) {
    const options = opt_options || {};

    super(options);

    this.set('origin', options.geometry.clone());
    this.setStyle(this.createStyle_(options));
    this.set('isOrthogonalMovementHandle', true);

    this.on(['change:movementBasisVector', 'change:movementMagnitude'], () => {
      const newHandleDeltas = scaleVector(this.get('movementBasisVector'), this.get('movementMagnitude'));

      this.set('movementVector', newHandleDeltas);
    });

    this.on(['change:origin', 'change:movementVector'], () => {
      const newHandleGeometry = this.get('origin').clone();

      const newHandleDeltas = this.get('movementVector');

      newHandleGeometry.translate(...newHandleDeltas);

      this.setGeometry(newHandleGeometry);
    });

    this.set('movementMagnitude', options.movementMagnitude || 0);
  }

   /**
    * Sets the handle location by inferring a new origin from the specified coordinates and
    * the existing basis/magnitude.
    */
  updateLocation(newHandleCoords) {
    const movementVector = this.get('movementVector');

    this.set('origin', new geom.Point(subtractVectors(newHandleCoords, movementVector), 'XY'));
  }

  handleDownEvent(evt) {
    this.coordinate_ = evt.coordinate;
  }

  handleUpEvent(evt) {
    this.coordinate_ = null;
  }

  handleDragEvent(evt) {
    var deltaX = evt.coordinate[0] - this.coordinate_[0];
    var deltaY = evt.coordinate[1] - this.coordinate_[1];

    if (this.get('movementBasisVector')[0] < 0) {
      deltaX *= -1;
    }

    if (this.get('movementBasisVector')[1] < 0) {
      deltaY *= -1;
    }

    // TODO: Improve how well handle movement matches mouse movements
    this.set('movementMagnitude', this.get('movementMagnitude') + (deltaX + deltaY));

    this.coordinate_[0] = evt.coordinate[0];
    this.coordinate_[1] = evt.coordinate[1];
  }

  createStyle_(options) {
    const coords = this.get('movementBasisVector');

    var iconRotation = Math.asin(Math.abs(coords[1]));

    if (coords[1] < 0) {
      iconRotation = Math.PI - iconRotation;
    }

    return [new style.Style({
        image: new style.Icon({
          rotation: iconRotation,
          rotateWithView: true,
          opacity: 0.5,
          scale: 2,
          src: options.iconUrl,
          zIndex: 10000,
        }),
    })];
  }
}

class ButtonControl extends control.Control {
  /**
   * @param {Object=} opt_options Control options.
   */
  constructor(opt_options) {
    const options = opt_options || {};

    const className = options.className || '';

    const button = document.createElement('button');
    button.innerHTML = options.label || '?';

    const element = document.createElement('div');
    element.className = `${className} ol-button-control ${css.CLASS_UNSELECTABLE} ${css.CLASS_CONTROL}`;
    element.appendChild(button);

    super({
      element: element,
      target: options.target,
    });

    button.addEventListener('click', this.handleClick_.bind(this), false);
  }

  handleClick_() {
    this.dispatchEvent('click');
  }
}

/**
 * @private
 */
class SelectControl extends control.Control {
  /**
   * @param {Object=} opt_options Control options.
   */
  constructor(opt_options) {
    const options = opt_options || {};

    const className = options.className || '';

    const select = document.createElement('select');

    const addOption = (value) => {
      const option = document.createElement('option');
      option.innerHTML = value;
      option.value = value;
      select.appendChild(option);
    };

    const optionValues = (options.optionValues || []);

    optionValues.forEach(v => addOption(v));

    const element = document.createElement('div');
    element.className = `${className} ol-select-control ${css.CLASS_UNSELECTABLE} ${css.CLASS_CONTROL}`;
    element.appendChild(select);

    super({
      element: element,
      target: options.target,
    });

    select.addEventListener('change', () => this.set('selection', select.value), false);

    select.value = options.selectedOption || optionValues[0];

    this.set('selection', select.value);
  }

}

/**
 * @private
 */
class HidableRotatedOverlay extends Overlay__default['default'] {
  /**
   * @param {Object=} opt_options Overlay options.
   */
  constructor(opt_options) {
    const options = opt_options || {};

    super(options);

    this.element_ = options.element;
    this.baseRotation_ = options.rotation || 0;
    this.rotateWithView_ = options.rotateWithView || false;
    this.rotationTransform_ = options.rotationTransform || (r => r);
  }

  /**
   * @inheritDoc
   * @api
   */
  setMap(map) {
    const oldMap = this.getMap();
    if (map === oldMap) {
      return;
    }
    if (this.onMapViewChanged_ && this.onMapViewChanged_.target) {
      this.onMapViewChanged_.target.un('change:view', this.onMapViewChanged_.listener);
    }
    this.onMapViewChanged_ = null;
    super.setMap(map);

    if (map) {
      const updateRotationSubscription = () => {
        const newView = map.getView();

        if (this.onMapRotationChanged_ && this.onMapRotationChanged_.target) {
          this.onMapRotationChanged_.target.un('change:rotation', this.onMapRotationChanged_.listener);
        }
        this.onMapRotationChanged_ = null;

        if (!this.rotateWithView_) {
          this.updateRotation_();
          return;
        }

        if (newView) {
          this.onMapRotationChanged_ = newView.on('change:rotation', () => this.updateRotation_());
          this.updateRotation_();
        }
      };

      this.onMapViewChanged_ = map.on('change:view', (viewChangeEvent) => {
        const oldView = viewChangeEvent.oldValue;
        const newView = map.getView();

        if (newView === oldView) {
          return;
        }

        updateRotationSubscription();
      });
      updateRotationSubscription();
    }
  }

  hide() {
    this.element_.style.display = 'none';
  }

  show() {
    this.element_.style.display = 'block';
  }

  updateRotation_() {
    const map = this.getMap();
    if (!map) {
      return;
    }
    const view = map.getView();
    if (!view) {
      return;
    }
    var rotation;
    if (this.rotateWithView_) {
      rotation = (this.baseRotation_ + view.getRotation()) % (2 * Math.PI);
    } else {
      rotation = this.baseRotation_ % (2 * Math.PI);
    }

    rotation = this.rotationTransform_(rotation);

    ['-webkit-transform', '-moz-transform', '-o-transform', '-ms-transform'].forEach(cssKey => {
      this.element_.style[cssKey] = `rotate(${rotation}rad)`;
    });
  }

}

/**
 * @enum {string}
 * Copied since this enum is not exported https://github.com/openlayers/openlayers/issues/11482
 */
const TouchDrawEventType = {
  /**
   * Triggered upon feature draw start
   * @event TouchDrawEvent#drawstart
   * @api
   */
  DRAWSTART: 'drawstart',
  /**
   * Triggered upon feature draw end
   * @event TouchDrawEvent#drawend
   * @api
   */
  DRAWEND: 'drawend',
  /**
   * Triggered upon feature draw abortion
   * @event TouchDrawEvent#drawabort
   * @api
   */
  DRAWABORT: 'drawabort',
};

/**
 * @classdesc
 * Events emitted by {@link TouchDraw} instances are instances of this type.
 * Copied since these types are not exported https://github.com/openlayers/openlayers/issues/11482
 */
class TouchDrawEvent extends Event__default['default'] {
  /**
   * @param {TouchDrawEventType} type Type.
   * @param {Feature} feature The feature drawn.
   */
  constructor(type, feature) {
    super(type);

    /**
     * The feature being drawn.
     * @type {Feature}
     * @api
     */
    this.feature = feature;
  }
}

const MOVE_HANDLE_ICON = "data:image/svg+xml,%3C%3Fxml version='1.0' encoding='UTF-8'%3F%3E%3Csvg width='24' height='24' version='1.1' viewBox='0 0 24 24' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='m15 17h3v6l5-11-5-11v6h-12v-6l-5 11 5 11v-6h9'/%3E%3C/svg%3E";

/**
 * Encapsulates the state for an in-progress drawing.
 * @private
 */
class TouchDrawFeatureDraftingState extends BaseObject__default['default'] {
  /**
   * @param {Object=} opt_options BaseObject options.
   */
  constructor(opt_options) {
    const options = opt_options || {};

    super(options);

    const map = options.map;
    this.map_ = map;
    const initialTouchDrawHandle = options.initialTouchDrawHandle;

    this.xScaleHandle_ = initialTouchDrawHandle;
    this.overlay_ = options.overlay;

    this.unitConversions_ = options.unitConversions;

    this.unitSelect_ = new SelectControl({
      className: 'unit-selector-touch-draw',
      optionValues: Object.keys(this.unitConversions_),
      selectedOption: options.selectedUnit,
    });
    map.addControl(this.unitSelect_);

    const getUnitConversionFactor = () => {
      const selectedUnit = this.unitSelect_.get('selection');
      return this.unitConversions_[selectedUnit];
    };

    const getSphericalLengthInSelectedUnits = (geom) => {
      return sphere.getLength(geom, {projection: map.getView().getProjection()}) / getUnitConversionFactor();
    };

    const originalSegmentCoords = initialTouchDrawHandle.get('originalSegmentCoords');

    const draftFeature = new Feature__default['default']({
      geometry: new geom.Polygon([[...originalSegmentCoords, ...originalSegmentCoords]], 'XY'),
    });

    const handleXMovementBasisVector = getOrthogonalBasisVector(...originalSegmentCoords);

    this.xMoveHandle_ = new OrthogonalMovementHandle({
      geometry: new geom.Point(originalSegmentCoords[0], 'XY'),
      movementBasisVector: handleXMovementBasisVector,
      iconUrl: MOVE_HANDLE_ICON,
    });

    const handleYMovementBasisVector = getOrthogonalBasisVector([0, 0], handleXMovementBasisVector);

    this.yMoveHandle_ = new OrthogonalMovementHandle({
      geometry: new geom.Point(new geom.LineString(originalSegmentCoords, 'XY').getCoordinateAt(0.5), 'XY'),
      movementBasisVector: handleYMovementBasisVector,
      iconUrl: MOVE_HANDLE_ICON,
    });

    this.overlay_.getSource().clear();
    this.overlay_.getSource().addFeature(this.xScaleHandle_);
    this.overlay_.getSource().addFeature(this.xMoveHandle_);
    this.overlay_.getSource().addFeature(this.yMoveHandle_);

    const createInputPopupBoundToMovementHandle = (handle) => {
      const inputElement = document.createElement('input');
      inputElement.value = 0;
      inputElement.type = 'text';
      inputElement.required = true;
      inputElement.pattern="-?([0-9]+)?(\\.[0-9]+)?";

      inputElement.addEventListener('focus', () => {
        inputElement.setSelectionRange(0, inputElement.value.length);
      }, false);

      const basisVector = handle.get('movementBasisVector');

      inputElement.addEventListener('input', (event) => {
        const desiredMoveLength = parseFloat(event.target.value);

        inputElement.checkValidity();

        if (!isFinite(desiredMoveLength)) {
          return;
        }

        const handleMoveGeom = new geom.LineString([handle.get('origin').getCoordinates(), handle.getGeometry().getCoordinates()], 'XY');
        const currentMagnitude = handle.get('movementMagnitude');
        const currentMoveLength = sphere.getLength(handleMoveGeom, {projection: map.getView().getProjection()});

        const newMagnitude = (currentMagnitude / currentMoveLength) * (desiredMoveLength * getUnitConversionFactor());

        handle.set('movementMagnitude', newMagnitude);
      }, false);

      const inputPopupElement = document.createElement('div');
      inputPopupElement.className = `ol-touchdraw-dim-popup`;
      inputPopupElement.appendChild(inputElement);

      var inputRotation = Math.asin(Math.abs(basisVector[1]));

      if (basisVector[1] < 0) {
        inputRotation = 2 * Math.PI - inputRotation;
      }

      const overlay = new HidableRotatedOverlay({
        element: inputPopupElement,
        positioning: "top-center",
        rotation: inputRotation,
        rotateWithView: true,
        // Modifies the rotation such that the input text is never upsidedown.
        rotationTransform: r => {
          var ar = r % (2 * Math.PI);
          if (ar < 0) {
            ar += (2 * Math.PI);
          }

          if (ar < (Math.PI * 0.25) || ar > (Math.PI * 1.75)) {
            return ar;
          }

          if (ar < (Math.PI * 0.75)) {
            return ar - (Math.PI / 2);
          }

          if (ar > (Math.PI * 1.25)) {
            return ar - (1.5 * Math.PI);
          }

          return ar - Math.PI;
        },
      });
      overlay.inputElement = inputElement;

      overlay.recomputeInputValue = () => {
        if (document.activeElement !== inputElement) {
          const handleMoveGeom = new geom.LineString([handle.get('origin').getCoordinates(), handle.getGeometry().getCoordinates()], 'XY');
          inputElement.value = getSphericalLengthInSelectedUnits(handleMoveGeom).toFixed(4);
        }
      };

      inputElement.addEventListener('blur', overlay.recomputeInputValue, false);

      this.unitSelect_.on('change:selection', overlay.recomputeInputValue);

      return overlay;
    };

    this.XDimPopup_ = createInputPopupBoundToMovementHandle(this.xScaleHandle_);
    map.addOverlay(this.XDimPopup_);
    this.XDimPopup_.setPosition(originalSegmentCoords[1]);

    this.XMovePopup_ = createInputPopupBoundToMovementHandle(this.xMoveHandle_);
    this.XMovePopup_.hide();
    map.addOverlay(this.XMovePopup_);
    this.XMovePopup_.setPosition(originalSegmentCoords[1]);

    const XMoveGuide = new Feature__default['default']({
      geometry: new geom.LineString([originalSegmentCoords[1], originalSegmentCoords[1]], 'XY'),
    });
    XMoveGuide.setStyle(new style.Style({
          stroke: new style.Stroke({
            color: '#ccc',
            width: 2,
            lineDash: [4,8],
          }),
      }));
    this.overlay_.getSource().addFeature(XMoveGuide);

    const YMoveGuide = new Feature__default['default']({
      geometry: new geom.LineString([originalSegmentCoords[1], originalSegmentCoords[1]], 'XY'),
    });
    YMoveGuide.setStyle(new style.Style({
          stroke: new style.Stroke({
            color: '#ccc',
            width: 2,
            lineDash: [4,8],
          }),
      }));
    this.overlay_.getSource().addFeature(YMoveGuide);

    this.YMovePopup_ = createInputPopupBoundToMovementHandle(this.yMoveHandle_);
    this.YMovePopup_.hide();
    map.addOverlay(this.YMovePopup_);
    this.YMovePopup_.setPosition(originalSegmentCoords[1]);

    const recalculateDraftFeatureGeometry = () => {
      const newGeom = new geom.Polygon([[...originalSegmentCoords, ...originalSegmentCoords]], 'XY');

      const xScaleTranslation = this.xScaleHandle_.get('movementVector');

      const xTranslation = this.xMoveHandle_.get('movementVector');
      const yTranslation = this.yMoveHandle_.get('movementVector');

      newGeom.translate(...xTranslation);
      newGeom.translate(...yTranslation);

      const coords = newGeom.getCoordinates();

      const p0 = new geom.Point(coords[0][0], 'XY');
      const p1 = new geom.Point(coords[0][1], 'XY');

      p0.translate(...xScaleTranslation);
      p1.translate(...xScaleTranslation);

      coords[0][3] = p0.getCoordinates();
      coords[0][2] = p1.getCoordinates();

      draftFeature.getGeometry().setCoordinates(coords);
    };

    const calculateMoveGuideGeometries = (draftFeatureCoords) => {
      const coords = draftFeatureCoords;

      const xTranslation = this.xMoveHandle_.get('movementVector');

      const xMoveGuideGeometry = new geom.LineString([coords[0][1], subtractVectors(coords[0][1], xTranslation)], 'XY');
      const yMoveGuideGeometry = new geom.LineString([originalSegmentCoords[1], subtractVectors(coords[0][1], xTranslation)], 'XY');

      return [xMoveGuideGeometry, yMoveGuideGeometry];
    };

    draftFeature.getGeometry().on('change', () => {
      const coords = draftFeature.getGeometry().getCoordinates();

      const [xMoveGuideGeometry, yMoveGuideGeometry] = calculateMoveGuideGeometries(coords);

      const xDimGeometry = new geom.LineString([coords[0][1], coords[0][2]], 'XY');
      this.XDimPopup_.setPosition(xDimGeometry.getCoordinateAt(0.5));
      this.XDimPopup_.recomputeInputValue();

      XMoveGuide.setGeometry(xMoveGuideGeometry);
      this.XMovePopup_.setPosition(xMoveGuideGeometry.getCoordinateAt(0.5));
      this.XMovePopup_.recomputeInputValue();

      YMoveGuide.setGeometry(yMoveGuideGeometry);
      this.YMovePopup_.setPosition(yMoveGuideGeometry.getCoordinateAt(0.5));
      this.YMovePopup_.recomputeInputValue();
    });

    this.xScaleHandle_.on('change:movementVector', () => {
      recalculateDraftFeatureGeometry();
      const coords = draftFeature.getGeometry().getCoordinates();
      this.xMoveHandle_.updateLocation(new geom.LineString([coords[0][3], coords[0][0]], 'XY').getCoordinateAt(0.5));
      this.yMoveHandle_.updateLocation(new geom.LineString([coords[0][0], coords[0][1]], 'XY').getCoordinateAt(0.5));
    });

    this.xMoveHandle_.on('change:movementVector', () => {
      recalculateDraftFeatureGeometry();
      const coords = draftFeature.getGeometry().getCoordinates();
      this.xScaleHandle_.set('origin', new geom.Point(new geom.LineString([coords[0][0], coords[0][1]], 'XY').getCoordinateAt(0.5), 'XY'));
      this.yMoveHandle_.updateLocation(new geom.LineString([coords[0][0], coords[0][1]], 'XY').getCoordinateAt(0.5));

      if (this.xMoveHandle_.get('movementMagnitude') != 0) {
        this.XMovePopup_.show();
      } else {
        this.XMovePopup_.hide();
      }
    });

    this.yMoveHandle_.on('change:movementVector', () => {
      recalculateDraftFeatureGeometry();
      const coords = draftFeature.getGeometry().getCoordinates();
      this.xScaleHandle_.set('origin', new geom.Point(new geom.LineString([coords[0][0], coords[0][1]], 'XY').getCoordinateAt(0.5), 'XY'));
      this.xMoveHandle_.updateLocation(new geom.LineString([coords[0][3], coords[0][0]], 'XY').getCoordinateAt(0.5));

      if (this.yMoveHandle_.get('movementMagnitude') != 0) {
        this.YMovePopup_.show();
      } else {
        this.YMovePopup_.hide();
      }
    });

    this.draftFeature_ = draftFeature;

    this.confirmButton_ = new ButtonControl({
      className: 'confirm-touch-draw',
      label: '✓',
    });
    this.confirmButton_.on('click', () => this.handleConfirmButtonClick_());
    map.addControl(this.confirmButton_);

    this.cancelButton_ = new ButtonControl({
      className: 'cancel-touch-draw',
      label: 'X',
    });
    this.cancelButton_.on('click', () => this.handleCancelButtonClick_());
    map.addControl(this.cancelButton_);

    this.overlay_.getSource().addFeature(this.draftFeature_);
  }

  handleConfirmButtonClick_() {
    this.dispatchEvent(new TouchDrawEvent(TouchDrawEventType.DRAWEND, this.draftFeature_));
  }

  handleCancelButtonClick_() {
    this.dispatchEvent(new TouchDrawEvent(TouchDrawEventType.DRAWABORT, this.draftFeature_));
  }

  cancelDraft() {
    this.map_.removeOverlay(this.XDimPopup_);
    this.map_.removeOverlay(this.XMovePopup_);
    this.map_.removeOverlay(this.YMovePopup_);

    this.map_.removeControl(this.unitSelect_);
    this.map_.removeControl(this.confirmButton_);
    this.map_.removeControl(this.cancelButton_);
  }

}

/**
 * @typedef {Object} TouchDrawOptions
 * @property {VectorSource} [source] Source used as both a reference and destination. If
 * this options is provided, the referenceSource and destinationSource options should not be.
 * @property {VectorSource} [referenceSource] Reference source used to calculate proposed
 * drawing handles. 
 * @property {VectorSource} [destinationSource] Destination source for the drawn features.
 */


/**
 * Default units and their meter conversions for touch draw dimensions.
 */
const DefaultTouchDrawUnitConversions = {
  'm': 1.0,
  'ft': 1 / 3.28084,
  'in': 0.0254,
};


const TouchDrawStates = {
  PROPOSING_HANDLES: 1,
  DRAWING: 2,
};

const TOUCH_DRAW_HANDLE_ICON = "data:image/svg+xml,%3C%3Fxml version='1.0' encoding='UTF-8'%3F%3E%3Csvg width='24' height='24' version='1.1' viewBox='0 0 24 24' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='m15 14h3v3l5-5-5-5v3h-12v-3l-5 5 5 5v-3h9'/%3E%3Cpath d='m15.06 20.132h2.1168v-16.269h-10.268v16.269h8.151' opacity='.74986'/%3E%3C/svg%3E";


/**
 * @classdesc
 * Proposes touch-friendly "handles" that can be used to draw relative to existing
 * source geometry.
 *
 * @fires TouchDrawEvent
 * @api
 */
class TouchDraw extends PointerInteraction__default['default'] {
  /**
   * @param {TouchDrawOptions=} opt_options TouchDrawOptions.
   */
  constructor(opt_options) {

    const options = opt_options ? opt_options : {};

    super(/** @type {PointerInteraction.Options} */ (options));

    /**
     * Reference source used to calculate proposed drawing handles.
     * @type {VectorSource}
     * @private
     */
    this.source_ = options.referenceSource ? options.referenceSource : null;

    /**
     * Destination source for the drawn features.
     * @type {VectorSource}
     * @private
     */
    this.target_ = options.destinationSource ? options.destinationSource : null;

    if (options.source) {
      this.source_ = options.source;
      this.target_ = options.source;
    }

    this.unitConversions_ = options.unitConversions || DefaultTouchDrawUnitConversions;
    this.selectedUnit_ = options.selectedUnit || 'm';

    this.internalState_ = TouchDrawStates.PROPOSING_HANDLES;

    this.overlay_ = new layer.Vector({
      source: createAlwaysVisibleVectorSource(),
      updateWhileInteracting: true
    });

    this.interestingSegmentsFeature_ = new Feature__default['default']({
      geometry: new geom.MultiLineString([]),
    });

    this.interestingSegmentsFeature_.setStyle(new style.Style({
      stroke: new style.Stroke({
        color: '#ffcc33',
        width: 2,
        zIndex: 100,
      }),
    }));

    this.overlay_.getSource().addFeature(this.interestingSegmentsFeature_);

    this.overlay_.on('postrender', this.handleOverlayPostRender_.bind(this));
    this.addEventListener(BaseObject.getChangeEventType('active'), this.updateState_);
  }

  /**
   * @param {ol.PluggableMap} map Map.
   */
  setMap(map) {
    super.setMap(map);
    this.updateState_();
  }

  /**
   * @private
   */
  updateState_() {
    const map = this.getMap();
    const active = this.getActive();
    if (!map || !active) {
      this.abortDrawing();
    }
    this.overlay_.setMap(active ? map : null);
  }

  /**
   * @inheritDoc
   * @api
   */
  changed() {
    super.changed();
    this.overlay_.changed();
  }

  handleDownEvent(evt) {

    const map = evt.map;

    const feature = map.forEachFeatureAtPixel(evt.pixel, function (feature, layer) {
      if (feature.get('isOrthogonalMovementHandle')) {
        return feature;
      }
    });

    if (feature && feature.get('isOrthogonalMovementHandle')) {
      this.activeHandle_ = feature;
      this.activeHandle_.handleDownEvent(evt);

      if (this.internalState_ === TouchDrawStates.PROPOSING_HANDLES) {
        this.internalState_ = TouchDrawStates.DRAWING;

        this.draftingState_ = new TouchDrawFeatureDraftingState({
          map,
          overlay: this.overlay_,
          initialTouchDrawHandle: feature,
          unitConversions: this.unitConversions_,
          selectedUnit: this.selectedUnit_,
        });

        this.draftingState_.once(TouchDrawEventType.DRAWSTART, (e) => this.dispatchEvent(e));
        this.draftingState_.once(TouchDrawEventType.DRAWEND, (e) => this.handleDrawEnd_(e));
        this.draftingState_.once(TouchDrawEventType.DRAWABORT, (e) => this.handleDrawAbort_(e));
      }

      return true;
    }

    return !!feature;
  }

  handleUpEvent(evt) {
    if (this.activeHandle_) {
      this.activeHandle_.handleUpEvent(evt);
      this.activeHandle_ = null;
      return true;
    }

    return false;
  }

  handleDragEvent(evt) {
    if (this.activeHandle_) {
      this.activeHandle_.handleDragEvent(evt);
      return true;
    }
  }

  handleDrawEnd_(event) {
    const draftFeature = this.draftingState_ && this.draftingState_.draftFeature_;

    this.abortDrawing();

    if (!draftFeature) {
      return;
    }

    // First dispatch event to allow full set up of feature
    this.dispatchEvent(event);

    if (this.target_) {
      this.target_.addFeature(draftFeature);
    }
  }

  handleDrawAbort_(event) {
    this.abortDrawing();
    this.dispatchEvent(event);
  }

  abortDrawing() {
    if (this.draftingState_) {
      this.draftingState_.cancelDraft();
      this.draftingState_ = null;
    }
    this.internalState_ = TouchDrawStates.PROPOSING_HANDLES;

    // Reset our overlay
    this.overlay_.getSource().clear();
    this.interestingSegmentsFeature_.getGeometry().setCoordinates([]);
    this.overlay_.getSource().addFeature(this.interestingSegmentsFeature_);

    // Reset this so the next post render event will recalculate new touch handles
    this.lastSourceRevision_ = null;

    this.changed();
  }

  /**
   * Handle post render events for our overlay layer
   * @private
   */
   handleOverlayPostRender_() {
     if (this.internalState_ === TouchDrawStates.PROPOSING_HANDLES) {
       this.handleOverlayPostRenderHandleProposals_();
     }
   }

  /**
   * Handle drawing handle proposals post render.
   * @private
   */
   handleOverlayPostRenderHandleProposals_() {
     const map = this.getMap();

     const viewExtent = map.getView().calculateExtent(map.getSize());

     const viewExtentUnchanged = viewExtent === this.lastViewExtent_ || JSON.stringify(viewExtent) === JSON.stringify(this.lastViewExtent_);
     const sourceUnchanged = this.source_.getRevision() === this.lastSourceRevision_;

     // No need to recalculate the overlay geometry if nothing has changed
     if (viewExtentUnchanged && sourceUnchanged) {
       return;
     }

     this.lastViewExtent_ = viewExtent;
     this.lastSourceRevision_ = this.source_.getRevision();

     this.overlay_.getSource().clear();
     this.overlay_.getSource().addFeature(this.interestingSegmentsFeature_);

     const extentSize = extent.getSize(viewExtent);

     const extentDiagonalLength = Math.hypot(...extentSize);

     const extentFocusRegion = extent.buffer(extent.boundingExtent([extent.getCenter(viewExtent)]), extentDiagonalLength / 8);

     const screenAreasWithHandles = {};
     const interestingSegmentLineStrings = [];
     const movementHandles = [];

     function findInterestingSegmentsFromLinearCoords(coords) {
       if (coords.length < 2) {
         return;
       }

       // TODO: Consider limiting total count of anchors

       for(var i = 0; (i + 1) < coords.length; i += 1) {
         const segmentInFocusRegion = cropLineSegmentByExtent(coords.slice(i, i + 2), extentFocusRegion);

         if (!segmentInFocusRegion) {
           continue;
         }

         const segmentExtentInFocusRegion = extent.boundingExtent(segmentInFocusRegion);

         if (extent.isEmpty(segmentExtentInFocusRegion)) {
           continue;
         }

         const segmentExtentSizeInFocusRegion = extent.getSize(segmentExtentInFocusRegion);

         const segmentLengthInFocusRegion = Math.hypot(...segmentExtentSizeInFocusRegion);

         if ((segmentLengthInFocusRegion / extentDiagonalLength) < 0.1) {
           continue;
         }

         const segmentInExtent = cropLineSegmentByExtent(coords.slice(i, i + 2), viewExtent);

         const ls = new geom.LineString(segmentInExtent, 'XY');

         const handleCoord = ls.getCoordinateAt(0.5);

         const handlePixel = map.getPixelFromCoordinate(handleCoord);

         const handleDesc = `${Math.floor(handlePixel[0] / 100)}x${Math.floor(handlePixel[1] / 100)}`;

         if (handleDesc in screenAreasWithHandles) {
           continue;
         }

         screenAreasWithHandles[handleDesc] = true;

         const handleMovementBasisVector = getOrthogonalBasisVector(handleCoord, segmentInExtent[1]);

         movementHandles.push(new OrthogonalMovementHandle({
           geometry: new geom.Point(handleCoord, 'XY'),
           movementBasisVector: handleMovementBasisVector,
           iconUrl: TOUCH_DRAW_HANDLE_ICON,

           originalSegmentCoords: coords.slice(i, i + 2),
         }));

         interestingSegmentLineStrings.push(ls);
       }
     }

     function findInterestingSegments(g) {
       if (typeof g.getType !== 'function') {
         return;
       }

       const gType = g.getType();

       // 'Point', 'LineString', 'LinearRing', 'Polygon', 'MultiPoint', 'MultiLineString', 'MultiPolygon', 'GeometryCollection', 'Circle'.

       if (gType === 'LineString') {
         findInterestingSegmentsFromLinearCoords(g.getCoordinates());
       } else if (gType === 'LinearRing') {
         const coords = g.getCoordinates();

         if (coords.length >= 2) {
           coords.push(coords[0]);
         }

         findInterestingSegmentsFromLinearCoords(coords);

       } else if (gType === 'Polygon') {
         g.getLinearRings().map(findInterestingSegments);
       } else if (gType === 'MultiLineString') {
         g.getLineStrings().map(findInterestingSegments);
       } else if (gType === 'MultiPolygon') {
         g.getPolygons().map(findInterestingSegments);
       } else if (gType === 'GeometryCollection') {
         g.getGeometries().map(findInterestingSegments);
       }
     }

     this.source_.forEachFeatureInExtent(viewExtent, (feature) => {

       const geometry = feature.getGeometry();

       if (typeof geometry.getLayout !== 'function' || geometry.getLayout() !== 'XY') {
         return;
       }

       findInterestingSegments(geometry);
     });

     this.interestingSegmentsFeature_.getGeometry().setCoordinates([]);
     interestingSegmentLineStrings.forEach(ls => this.interestingSegmentsFeature_.getGeometry().appendLineString(ls));
     this.overlay_.getSource().addFeatures(movementHandles);
  }
}

/**
 * @returns a vector source which always returns all its features - ignoring extents.
 * @private
 */
function createAlwaysVisibleVectorSource() {
  const vectorSource = new source.Vector({
    useSpatialIndex: false,
    features: [],
    wrapX: false,
  });

  // Monkey-patch this function to ensure the grid is always rendered even
  // when the origin/rotation points are outside the view extents
  vectorSource.getFeaturesInExtent = vectorSource.getFeatures;

  return vectorSource;
}

exports.DefaultTouchDrawUnitConversions = DefaultTouchDrawUnitConversions;
exports.default = TouchDraw;
