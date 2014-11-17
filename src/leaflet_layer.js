import Scene from './scene';
import CSSMatrix from 'xcssmatrix';

export var LeafletLayer = L.GridLayer.extend({

    initialize: function (options) {
        L.setOptions(this, options);
        this.createScene();
        this.hooks = {};
    },

    createScene: function () {
        this.scene = Scene.create({
            tile_source: this.options.vectorTileSource,
            layers: this.options.vectorLayers,
            styles: this.options.vectorStyles
        }, {
            numWorkers: this.options.numWorkers,
            preRender: this.options.preRender,
            postRender: this.options.postRender,
            // advanced option, app will have to manually called scene.render() per frame
            disableRenderLoop: this.options.disableRenderLoop
        });
    },

    // Finish initializing scene and setup events when layer is added to map
    onAdd: function (map) {
        if (!this.scene) {
            this.createScene();
        }

        L.GridLayer.prototype.onAdd.apply(this, arguments);

        this.hooks.tileunload = (event) => {
            // TODO: not expecting leaflet to fire this event for tiles that simply pan
            // out of bounds when 'unloadInvisibleTiles' option is set, but it's firing
            // since upgrading to latest master branch - force-checking for now
            if (this.options.unloadInvisibleTiles) {
                var tile = event.tile;
                var key = tile.getAttribute('data-tile-key');
                this.scene.removeTile(key);
            }
        };
        this.on('tileunload', this.hooks.tileunload);

        this.hooks.resize = () => {
            var size = map.getSize();
            this.scene.resizeMap(size.x, size.y);
        };
        map.on('resize', this.hooks.resize);

        this.hooks.move = () => {
            var center = map.getCenter();
            this.scene.setCenter(center.lng, center.lat);
            this.scene.immediateRedraw();
            this.reverseTransform(map);
        };
        map.on('move', this.hooks.move);

        this.hooks.zoomstart = () => {
            this.scene.startZoom();
        };
        map.on('zoomstart', this.hooks.zoomstart);

        this.hooks.zoomend = () => {
            this.scene.setZoom(map.getZoom());
        };
        map.on('zoomend', this.hooks.zoomend);

        this.hooks.dragstart = () => {
            this.scene.panning = true;
        };
        map.on('dragstart', this.hooks.dragstart);

        this.hooks.dragend = () => {
            this.scene.panning = false;
        };
        map.on('dragend', this.hooks.dragend);

        // Canvas element will be inserted after map container (leaflet transforms shouldn't be applied to the GL canvas)
        // TODO: find a better way to deal with this? right now GL map only renders correctly as the bottom layer
        // this.scene.container = map.getContainer();
        this.scene.container = this.getContainer();

        // Use leaflet's existing event system as the callback mechanism
        var scene = this.scene;
        this.scene.init(() => {
            // make sure the expected scene is being initialized
            // can be another scene object if layer is removed and re-added before scene init completes
            if (this.scene === scene) {
                // TODO: why is force-resize needed here?
                var size = map.getSize();
                this.scene.resizeMap(size.x, size.y);

                var center = map.getCenter();
                this.scene.setCenter(center.lng, center.lat, map.getZoom());
                this.reverseTransform(map);
            }

            this.fire('init');
        });
    },

    onRemove: function (map) {
        L.GridLayer.prototype.onRemove.apply(this, arguments);

        this.off('tileunload', this.hooks.tileunload);
        map.off('resize', this.hooks.resize);
        map.off('move', this.hooks.move);
        map.off('zoomstart', this.hooks.zoomstart);
        map.off('zoomend', this.hooks.zoomend);
        map.off('dragstart', this.hooks.dragstart);
        map.off('dragend', this.hooks.dragend);
        this.hooks = {};

        if (this.scene) {
            this.scene.destroy();
            this.scene = null;
        }
    },

    createTile: function (coords, done) {
        var div = document.createElement('div');
        this.scene.loadTile(coords, div, done);
        return div;
    },

    // Reverse the CSS transform Leaflet applies to the layer, since Tangram's WebGL canvas
    // is expected to be 'absolutely' positioned.
    reverseTransform: function (map) {
        if (!map || !this.scene.canvas) {
            return;
        }

        var pane = map.getPanes().mapPane;
        var transform = pane.style.transform || pane.style['-webkit-transform'];
        var matrix = new CSSMatrix(transform).inverse();
        this.scene.canvas.style.transform = matrix;
        this.scene.canvas.style['-webkit-transform'] = matrix;
    },

    render: function () {
        if (!this.scene) {
            return;
        }
        this.scene.render();
    }

});

export function leafletLayer(options) {
    return new LeafletLayer(options);
}
