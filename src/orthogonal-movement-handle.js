import Feature from 'ol/Feature';
import { Point } from 'ol/geom';
import {
  Style,
  Icon,
} from 'ol/style';
import {
  subtractVectors,
  scaleVector,
} from './vector-math';


/**
 * @private
 */
export default class OrthogonalMovementHandle extends Feature {
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

    this.set('origin', new Point(subtractVectors(newHandleCoords, movementVector), 'XY'));
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

    return [new Style({
        image: new Icon({
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
