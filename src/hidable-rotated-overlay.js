import Overlay from "ol/Overlay";

/**
 * @private
 */
export default class HidableRotatedOverlay extends Overlay {
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