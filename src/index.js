import PointerInteraction from 'ol/interaction/Pointer';
import { CLASS_CONTROL, CLASS_UNSELECTABLE } from 'ol/css';
import {Vector as VectorSource} from 'ol/source';
import {Vector as VectorLayer} from 'ol/layer';
import Feature from 'ol/Feature';
import Overlay from "ol/Overlay";
import {Control} from 'ol/control';
import {
  Point,
  LineString,
  MultiLineString,
  Polygon,
} from 'ol/geom';
import { getChangeEventType } from 'ol/Object';
import {
  Stroke,
  Style,
  Icon,
} from 'ol/style';
import { getLength as getSphericalLength } from 'ol/sphere';
import {
  getSize as getExtentSize,
  boundingExtent as boundingExtentFromCoordinates,
  containsCoordinate as extentContainsCoordinate,
  buffer as bufferExtent,
  getCenter as getExtentCenter,
  getBottomLeft as getExtentBottomLeft,
  getBottomRight as getExtentBottomRight,
  getTopLeft as getExtentTopLeft,
  getTopRight as getExtentTopRight,
  isEmpty as isExtentEmpty,
} from 'ol/extent';

import OrthogonalMovementHandle from './orthogonal-movement-handle';
import TouchDrawFeatureDraftingState from './touch-draw-feature-drafting-state';
import {
  subtractVectors,
  cropLineSegmentByExtent,
  getOrthogonalBasisVector,
} from './vector-math';
import {
  TouchDrawEventType,
  TouchDrawEvent,
} from './touch-draw-event';

import './index.css';


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
export const DefaultTouchDrawUnitConversions = {
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
export default class TouchDraw extends PointerInteraction {
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

    this.overlay_ = new VectorLayer({
      source: createAlwaysVisibleVectorSource(),
      updateWhileInteracting: true
    });

    this.interestingSegmentsFeature_ = new Feature({
      geometry: new MultiLineString([]),
    });

    this.interestingSegmentsFeature_.setStyle(new Style({
      stroke: new Stroke({
        color: '#ffcc33',
        width: 2,
        zIndex: 100,
      }),
    }));

    this.overlay_.getSource().addFeature(this.interestingSegmentsFeature_);

    this.overlay_.on('postrender', this.handleOverlayPostRender_.bind(this));
    this.addEventListener(getChangeEventType('active'), this.updateState_);
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
    const getCircularReplacer = () => {
      const seen = new WeakSet();
      return (key, value) => {
        if (typeof value === "object" && value !== null) {
          if (seen.has(value)) {
            return;
          }
          seen.add(value);
        }
        return value;
      };
    };

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

        this.draftingState_.once(TouchDrawEventType.DRAWEND, (e) => this.handleDrawEnd_(e));
        this.draftingState_.once(TouchDrawEventType.DRAWABORT, (e) => this.handleDrawAbort_(e));
        this.dispatchEvent(new TouchDrawEvent(TouchDrawEventType.DRAWSTART, this.draftingState_.draftFeature_));
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

     const extentSize = getExtentSize(viewExtent);

     const extentDiagonalLength = Math.hypot(...extentSize);

     const extentFocusRegion = bufferExtent(boundingExtentFromCoordinates([getExtentCenter(viewExtent)]), extentDiagonalLength / 8);

     const screenAreasWithHandles = {};
     const interestingSegmentLineStrings = [];
     const movementHandles = [];

     const vm = this;

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

         const segmentExtentInFocusRegion = boundingExtentFromCoordinates(segmentInFocusRegion);

         if (isExtentEmpty(segmentExtentInFocusRegion)) {
           continue;
         }

         const segmentExtentSizeInFocusRegion = getExtentSize(segmentExtentInFocusRegion);

         const segmentLengthInFocusRegion = Math.hypot(...segmentExtentSizeInFocusRegion);

         if ((segmentLengthInFocusRegion / extentDiagonalLength) < 0.1) {
           continue;
         }

         const segmentInExtent = cropLineSegmentByExtent(coords.slice(i, i + 2), viewExtent);

         const ls = new LineString(segmentInExtent, 'XY');

         const handleCoord = ls.getCoordinateAt(0.5);

         const handlePixel = map.getPixelFromCoordinate(handleCoord);

         const handleDesc = `${Math.floor(handlePixel[0] / 100)}x${Math.floor(handlePixel[1] / 100)}`;

         if (handleDesc in screenAreasWithHandles) {
           continue;
         }

         screenAreasWithHandles[handleDesc] = true;

         const handleMovementBasisVector = getOrthogonalBasisVector(handleCoord, segmentInExtent[1]);

         movementHandles.push(new OrthogonalMovementHandle({
           geometry: new Point(handleCoord, 'XY'),
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
         findInterestingSegmentsFromLinearCoords(g.getCoordinates())
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
  const vectorSource = new VectorSource({
    useSpatialIndex: false,
    features: [],
    wrapX: false,
  });

  // Monkey-patch this function to ensure the grid is always rendered even
  // when the origin/rotation points are outside the view extents
  vectorSource.getFeaturesInExtent = vectorSource.getFeatures;

  return vectorSource;
}
