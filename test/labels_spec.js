import chai from 'chai';
let assert = chai.assert;

import LabelPoint from '../src/styles/text/label_point';
import LabelOptions from '../src/styles/text/label_options';

let label;

describe('Labels', () => {

    describe('LabelPoint', () => {

        beforeEach(() => {
            let options = new LabelOptions({ units_per_pixel: 1 });
            let size = { text_size: [1000, 500] };
            let p = [2000, -1000];
            label = new LabelPoint('Test', p, size, options);
        });

        it('is in tile bounds', () => {
            assert.isTrue(label.inTileBounds());
        });

        describe('for tile edges', () => {

            let edges = [
                ['left', [450, -1000]],
                ['right', [4500, -1000]],
                ['top', [2000, 250]],
                ['bottom', [2000, -4100]]
            ];

            edges.forEach(([edge, p]) => {

                it(`is out of tile on ${edge} edge`, () => {
                    label.position = p;
                    label.update();
                    assert.isFalse(label.inTileBounds());
                });

                it(`can move back into tile for ${edge} edge`, () => {
                    label.position = p;
                    label.update();
                    let discarded = label.moveInTile();
                    assert.isFalse(discarded);
                    assert.isTrue(label.inTileBounds());
                });

            });

        });

    });

});

