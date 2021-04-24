import TouchDraw from '../../src/index.js';
import PointerInteraction from 'ol/interaction/Pointer';
import {Control} from 'ol/control';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import Map from 'ol/Map';
import View from 'ol/View';
import Feature from 'ol/Feature';
import MapBrowserEvent from 'ol/MapBrowserEvent';
import { clearUserProjection } from 'ol/proj';
import {
  Point,
  LineString,
} from 'ol/geom';
import { getUid } from 'ol/util';


describe('ol-touch-draw.TouchDraw', function () {

  describe('constructor', function () {
    it('creates a new interaction', function () {
      const draw = new TouchDraw({});
      expect(draw).to.be.a(TouchDraw);
      expect(draw).to.be.a(PointerInteraction);
    });
  });

});
