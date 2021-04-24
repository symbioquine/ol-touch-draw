import Event from 'ol/events/Event';


/**
 * @enum {string}
 * Copied since this enum is not exported https://github.com/openlayers/openlayers/issues/11482
 */
export const TouchDrawEventType = {
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
export class TouchDrawEvent extends Event {
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