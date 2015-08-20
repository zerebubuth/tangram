/*global Label */

import boxIntersect from 'box-intersect';
import Utils from '../../utils/utils';
import Geo from '../../geo';
import OBB from '../../utils/obb';
import Vector from '../../vector';

export default class Label {
    constructor (text, size, { move_in_tile, keep_in_tile }) {
        Object.assign(this, {
            text,
            size,
            position: [],
            aabb: [],
            move_in_tile,
            keep_in_tile
        });

        this.id = Label.id++;
        this.buffer = this.buffer || 2; // TODO: make configurable
        this.buffer *= Geo.units_per_pixel;
        this.keep_min_distance = true;
    }

    isComposite () {
        return false;
    }

    occluded (aabbs) {
        let intersect = false;

        // Broadphase
        if (aabbs.length > 0) {
            boxIntersect([this.aabb], aabbs, (i, j) => {
                // Narrow phase
                if (OBB.intersect(this.aabb.obb, aabbs[j].obb)) {
                    intersect = true;
                    return true;
                }
            });
        }

        // No collision on aabb
        if (!intersect) {
            aabbs.push(this.aabb);
        }

        return intersect;
    }

    // keep a minimal distance between the labels
    checkMinDistance (aabbs) {
        let obb1 = this.aabb.obb;
        let w1 = Math.abs(obb1.quad[1][0] - obb1.quad[0][0]);

        for (let i = 0; i < aabbs.length; ++i) {
            let aabb = aabbs[i];
            let obb0 = aabb.obb;
            let dHalf = Vector.mult(Vector.sub(obb0.centroid, obb1.centroid), 0.5);
            let dHalfLength = Vector.length(Vector.sub(obb0.centroid, dHalf));
            let w0 = Math.abs(obb0.quad[1][0] - obb0.quad[0][0]);

            //  obb0
            // ______              obb1
            // |    |    dhalf  _________
            // |  ._|______.____|___.   |
            // |    |           |_______|
            // |____|
            //  __._w0__.____.__w1__.____

            // 1. skip obbs with half distance length longer than any obb width
            if (dHalfLength > w0 + this.buffer && dHalfLength > w1 + this.buffer) {
                continue;
            }

            // 2. find the two closest edges determined by the 4 closest points
            let e0 = { v0: obb0.quad[0], v1: obb0.quad[1] };
            let e1 = { v0: obb1.quad[0], v1: obb1.quad[1] };
            let minD0 = Vector.length(Vector.sub(e0.v0, e1.v0));
            let minD1 = Vector.length(Vector.sub(e0.v1, e1.v1));

            for (let j = 1; j < 4; ++j) {
                let v00 = obb0.quad[j];
                let v01 = obb0.quad[(j+1) % 4];
                let newEdge = false;

                for (let k = 1; k < 4; ++k) {
                    let v10 = obb1.quad[k];
                    let v11 = obb1.quad[(k+1) % 4];

                    let d0 = Vector.length(Vector.sub(v00, v10));
                    let d1 = Vector.length(Vector.sub(v01, v11));

                    if (d0 < minD0 || d1 < minD1) {
                        e1.v0 = v10;
                        e1.v1 = v11;
                        newEdge = true;
                    }
                }

                if (newEdge) {
                    e0.v0 = v00;
                    e0.v1 = v01;
                }
            }

            // 3. find the distance between the two edges
            let ve0 = Vector.sub(e0.v1, e0.v0);
            let ve1 = Vector.sub(e1.v1, e1.v0);
            let dve0ve1 = Math.abs(Vector.dot(ve0, ve1));

            let p = Vector.add(e1.v0, Vector.mult(ve1, dve0ve1));
            let d = Vector.length(Vector.sub(p, e1.v0));

            if (d < this.buffer) {
                return true;
            }
        }

        return false;
    }

    // checks whether the label is within the tile boundaries
    inTileBounds () {
        let min = [ this.aabb[0], this.aabb[1] ];
        let max = [ this.aabb[2], this.aabb[3] ];

        if (!Utils.pointInTile(min) || !Utils.pointInTile(max)) {
            return false;
        }

        return true;
    }

    // whether the label should be discarded
    // 1. try to keep the label in tile if the label (to avoid collision over tile for now)
    // 2. if 1. -> keep a minimal distance between the label
    // 3. if 2. -> perfom occlusion
    discard (aabbs) {
        let discard = false;

        // perform specific styling rule, should we keep the label in tile bounds?
        if (this.keep_in_tile) {
            let in_tile = this.inTileBounds();

            if (!in_tile && this.move_in_tile) {
                // can we move?
                discard = this.moveInTile();
            } else if (!in_tile) {
                // we didn't want to move at all,
                // just discard since we're out of tile bounds
                return true;
            }
        }

        if (this.keep_min_distance) {
            discard |= this.checkMinDistance(aabbs);
        }

        // should we discard? if not, just make occlusion test
        return discard || this.occluded(aabbs);
    }
}

Label.id = 0;

