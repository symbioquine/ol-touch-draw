import {
  containsCoordinate as extentContainsCoordinate,
  getBottomLeft as getExtentBottomLeft,
  getBottomRight as getExtentBottomRight,
  getTopLeft as getExtentTopLeft,
  getTopRight as getExtentTopRight,
} from 'ol/extent';


/**
 * @returns a vector which is orthogonal to the line between two points.
 * @private
 */
export function getOrthogonalBasisVector(cp1, cp2) {
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
export function getPlanarDistance(p0, p1) {
  return Math.hypot(Math.abs(p0[0] - p1[0]), Math.abs(p0[1] - p1[1]));
}

/**
 * @returns the resulting vector of scaling a vector by a contant.
 * @private
 */
export function scaleVector(v, c) {
  return [v[0] * c, v[1] * c];
}

/**
 * @returns the resulting vector of subtracting one vector from another.
 * @private
 */
export function subtractVectors(va, vb) {
  return [va[0] - vb[0], va[1] - vb[1]];
}

/**
 * @returns the coordinates of a line segment which is wholy within the specified extent.
 * @private
 */
export function cropLineSegmentByExtent(segCoords, extent) {
  const [p0, p1] = segCoords;

  const p0InExtent = extentContainsCoordinate(extent, p0);
  const p1InExtent = extentContainsCoordinate(extent, p1);

  // Both points within extent: return segCoords
  // One point within extent: return that point plus single intersection
  // Both points outside extent:
    // If two intersections: return those points
  // Else return undefined

  if (p0InExtent && p1InExtent) {
    return segCoords;
  }

  const extentBottomLeft = getExtentBottomLeft(extent);
  const extentTopRight = getExtentTopRight(extent);
  const extentTopLeft = getExtentTopLeft(extent);
  const extentBottomRight = getExtentBottomRight(extent);

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
