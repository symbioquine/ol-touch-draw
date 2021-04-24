import BaseObject from 'ol/Object';
import ButtonControl from './button-control';
import SelectControl from './select-control';
import Feature from 'ol/Feature';
import { getLength as getSphericalLength } from 'ol/sphere';
import {
  Point,
  LineString,
  Polygon,
} from 'ol/geom';
import {
  Stroke,
  Style,
} from 'ol/style';

import HidableRotatedOverlay from './hidable-rotated-overlay';
import OrthogonalMovementHandle from './orthogonal-movement-handle';
import {
  subtractVectors,
  getOrthogonalBasisVector,
} from './vector-math';
import {
  TouchDrawEventType,
  TouchDrawEvent,
} from './touch-draw-event';


const MOVE_HANDLE_ICON = "data:image/svg+xml,%3C%3Fxml version='1.0' encoding='UTF-8'%3F%3E%3Csvg width='24' height='24' version='1.1' viewBox='0 0 24 24' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='m15 17h3v6l5-11-5-11v6h-12v-6l-5 11 5 11v-6h9'/%3E%3C/svg%3E";

/**
 * Encapsulates the state for an in-progress drawing.
 * @private
 */
export default class TouchDrawFeatureDraftingState extends BaseObject {
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
      return getSphericalLength(geom, {projection: map.getView().getProjection()}) / getUnitConversionFactor();
    };

    const originalSegmentCoords = initialTouchDrawHandle.get('originalSegmentCoords');

    const draftFeature = new Feature({
      geometry: new Polygon([[...originalSegmentCoords, ...originalSegmentCoords]], 'XY'),
    });

    const handleXMovementBasisVector = getOrthogonalBasisVector(...originalSegmentCoords);

    this.xMoveHandle_ = new OrthogonalMovementHandle({
      geometry: new Point(originalSegmentCoords[0], 'XY'),
      movementBasisVector: handleXMovementBasisVector,
      iconUrl: MOVE_HANDLE_ICON,
    });

    const handleYMovementBasisVector = getOrthogonalBasisVector([0, 0], handleXMovementBasisVector);

    this.yMoveHandle_ = new OrthogonalMovementHandle({
      geometry: new Point(new LineString(originalSegmentCoords, 'XY').getCoordinateAt(0.5), 'XY'),
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

        const handleMoveGeom = new LineString([handle.get('origin').getCoordinates(), handle.getGeometry().getCoordinates()], 'XY');
        const currentMagnitude = handle.get('movementMagnitude');
        const currentMoveLength = getSphericalLength(handleMoveGeom, {projection: map.getView().getProjection()});

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
          const handleMoveGeom = new LineString([handle.get('origin').getCoordinates(), handle.getGeometry().getCoordinates()], 'XY');
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

    const XMoveGuide = new Feature({
      geometry: new LineString([originalSegmentCoords[1], originalSegmentCoords[1]], 'XY'),
    });
    XMoveGuide.setStyle(new Style({
          stroke: new Stroke({
            color: '#ccc',
            width: 2,
            lineDash: [4,8],
          }),
      }));
    this.overlay_.getSource().addFeature(XMoveGuide);

    const YMoveGuide = new Feature({
      geometry: new LineString([originalSegmentCoords[1], originalSegmentCoords[1]], 'XY'),
    });
    YMoveGuide.setStyle(new Style({
          stroke: new Stroke({
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
      const newGeom = new Polygon([[...originalSegmentCoords, ...originalSegmentCoords]], 'XY');

      const xScaleTranslation = this.xScaleHandle_.get('movementVector');

      const xTranslation = this.xMoveHandle_.get('movementVector');
      const yTranslation = this.yMoveHandle_.get('movementVector');

      newGeom.translate(...xTranslation);
      newGeom.translate(...yTranslation);

      const coords = newGeom.getCoordinates();

      const p0 = new Point(coords[0][0], 'XY');
      const p1 = new Point(coords[0][1], 'XY');

      p0.translate(...xScaleTranslation);
      p1.translate(...xScaleTranslation);

      coords[0][3] = p0.getCoordinates();
      coords[0][2] = p1.getCoordinates();

      draftFeature.getGeometry().setCoordinates(coords);
    };

    const calculateMoveGuideGeometries = (draftFeatureCoords) => {
      const coords = draftFeatureCoords;

      const xTranslation = this.xMoveHandle_.get('movementVector');

      const xMoveGuideGeometry = new LineString([coords[0][1], subtractVectors(coords[0][1], xTranslation)], 'XY');
      const yMoveGuideGeometry = new LineString([originalSegmentCoords[1], subtractVectors(coords[0][1], xTranslation)], 'XY');

      return [xMoveGuideGeometry, yMoveGuideGeometry];
    };

    draftFeature.getGeometry().on('change', () => {
      const coords = draftFeature.getGeometry().getCoordinates();

      const [xMoveGuideGeometry, yMoveGuideGeometry] = calculateMoveGuideGeometries(coords);

      const xDimGeometry = new LineString([coords[0][1], coords[0][2]], 'XY');
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
      this.xMoveHandle_.updateLocation(new LineString([coords[0][3], coords[0][0]], 'XY').getCoordinateAt(0.5));
      this.yMoveHandle_.updateLocation(new LineString([coords[0][0], coords[0][1]], 'XY').getCoordinateAt(0.5));
    });

    this.xMoveHandle_.on('change:movementVector', () => {
      recalculateDraftFeatureGeometry();
      const coords = draftFeature.getGeometry().getCoordinates();
      this.xScaleHandle_.set('origin', new Point(new LineString([coords[0][0], coords[0][1]], 'XY').getCoordinateAt(0.5), 'XY'));
      this.yMoveHandle_.updateLocation(new LineString([coords[0][0], coords[0][1]], 'XY').getCoordinateAt(0.5));

      if (this.xMoveHandle_.get('movementMagnitude') != 0) {
        this.XMovePopup_.show();
      } else {
        this.XMovePopup_.hide();
      }
    });

    this.yMoveHandle_.on('change:movementVector', () => {
      recalculateDraftFeatureGeometry();
      const coords = draftFeature.getGeometry().getCoordinates();
      this.xScaleHandle_.set('origin', new Point(new LineString([coords[0][0], coords[0][1]], 'XY').getCoordinateAt(0.5), 'XY'));
      this.xMoveHandle_.updateLocation(new LineString([coords[0][3], coords[0][0]], 'XY').getCoordinateAt(0.5));

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
