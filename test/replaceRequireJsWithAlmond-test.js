var vows = require('vows'),
    assert = require('assert'),
    AssetGraph = require('../lib'),
    fs = require('fs'),
    requirejs = fs.readFileSync(__dirname + '/replaceRequireJsWithAlmond/mixed/require.js', 'utf8'),
    almond = fs.readFileSync(__dirname + '/replaceRequireJsWithAlmond/mixed/almond.js', 'utf8');

vows.describe('transforms.replaceRequireJsWithAlmond').addBatch({
    'After loading a non-almond test case': {
        topic: function () {
            new AssetGraph({root: __dirname + '/replaceRequireJsWithAlmond/mixed/'})
                .registerRequireJsConfig({preventPopulationOfJavaScriptAssetsUntilConfigHasBeenFound: true})
                .loadAssets('require-pure.html')
                .populate({from: {type: 'Html'}, followRelations: {type: 'HtmlScript', to: {url: /^file:/}}})
                .assumeRequireJsConfigHasBeenFound()
                .populate()
                //.drawGraph('1-before.svg')
                .run(this.callback);
        },
        'the graph should contain 1 JavaScript asset': function (assetGraph) {
            assert.equal(assetGraph.findAssets({type: 'JavaScript'}).length, 1);
        },
        'the JavaScript asset text should be equal to require.js': function (assetGraph) {
            var asset = assetGraph.findAssets({type: 'JavaScript'}).pop(),
                text = asset && asset.text;

            assert.equal(text, requirejs);
        },
        'then running the replaceRequireJsWithAlmond transform': {
            topic: function (assetGraph) {
                assetGraph
                    .replaceRequireJsWithAlmond()
                    //.drawGraph('1-after.svg')
                    .run(this.callback);
            },
            'the graph should contain 1 JavaScript asset': function (assetGraph) {
                assert.equal(assetGraph.findAssets({type: 'JavaScript'}).length, 1);
            },
            'the JavaScript asset text should be equal to require.js': function (assetGraph) {
                var asset = assetGraph.findAssets({type: 'JavaScript'}).pop(),
                    text = asset && asset.text;

                assert.equal(text, requirejs);
            }
        }
    },
    'After loading an almond test case': {
        topic: function () {
            new AssetGraph({root: __dirname + '/replaceRequireJsWithAlmond/mixed/'})
                /*
                // Debugging
                .on('addAsset', function (asset) {
                    console.warn('add', asset.url);
                })
                .on('removeAsset', function (asset) {
                    console.warn('remove', asset.url);
                })
                */
                .registerRequireJsConfig({preventPopulationOfJavaScriptAssetsUntilConfigHasBeenFound: true})
                .loadAssets('require-almond.html')
                .populate({from: {type: 'Html'}, followRelations: {type: 'HtmlScript', to: {url: /^file:/}}})
                .assumeRequireJsConfigHasBeenFound()
                .populate()
                //.drawGraph('2-before.svg')
                .run(this.callback);
        },
        'the graph should contain 3 JavaScript assets': function (assetGraph) {
            assert.equal(assetGraph.findAssets({type: 'JavaScript'}).length, 3);
        },
        'the graph should contain 3 HtmlScript relations': function (assetGraph) {
            assert.equal(assetGraph.findRelations({type: 'HtmlScript'}).length, 3);
        },
        'the graph should contain 2 HtmlRequireJsAlmondReplacement relations': function (assetGraph) {
            assert.equal(assetGraph.findRelations({type: 'HtmlRequireJsAlmondReplacement'}).length, 2);
        },
        'the JavaScript asset text should be equal to require.js': function (assetGraph) {
            var relation = assetGraph.findRelations({type: 'HtmlScript'})[0],
                text = relation && relation.to.text;

            assert.equal(text, requirejs);
        },
        'then running the replaceRequireJsWithAlmond transform': {
            topic: function (assetGraph) {
                assetGraph
                    .replaceRequireJsWithAlmond()
                    //.drawGraph('2-after.svg')
                    .run(this.callback);
            },

            'the graph should contain 2 JavaScript assets': function (assetGraph) {
                assert.equal(assetGraph.findAssets({type: 'JavaScript'}).length, 2);
            },
            'the graph should contain 3 HtmlScript relations': function (assetGraph) {
                assert.equal(assetGraph.findRelations({type: 'HtmlScript'}).length, 3);
            },
            'the graph should contain 0 HtmlRequireJsAlmondReplacement relations': function (assetGraph) {
                assert.equal(assetGraph.findRelations({type: 'HtmlRequireJsAlmondReplacement'}).length, 0);
            },
            'the first JavaScript assets text should be equal to almond.js': function (assetGraph) {
                var asset = assetGraph.findAssets({url: /almond.js$/})[0],
                    text = asset && asset.text;

                assert.equal(text, almond);
            },
            'the second JavaScripts asset text should not have been replaced with almond': function (assetGraph) {
                var asset = assetGraph.findAssets({url: /app.js$/})[0],
                    text = asset && asset.text;

                assert.equal(text, 'alert(\'APP\');\n');
            }
        }
    },
    'After loading an almond test case that uses requirejs as script loader': {
        topic: function () {
            new AssetGraph({root: __dirname + '/replaceRequireJsWithAlmond/mixed/'})
                /*
                // Debugging
                .on('addAsset', function (asset) {
                    console.warn('add', asset.url);
                })
                .on('removeAsset', function (asset) {
                    console.warn('remove', asset.url);
                })
                */
                .registerRequireJsConfig({preventPopulationOfJavaScriptAssetsUntilConfigHasBeenFound: true})
                .loadAssets('require-almond-external.html')
                .populate({from: {type: 'Html'}, followRelations: {type: 'HtmlScript', to: {url: /^file:/}}})
                .assumeRequireJsConfigHasBeenFound()
                .populate({
                    followRelations: {
                        to: {
                            url: /^file:/
                        }
                    }
                })
                .run(this.callback);
        },
        'the graph should contain 4 JavaScript assets': function (assetGraph) {
            assert.equal(assetGraph.findAssets({type: 'JavaScript'}).length, 4);
        },
        'the graph should contain 2 HtmlScript relations': function (assetGraph) {
            assert.equal(assetGraph.findRelations({type: 'HtmlScript'}).length, 2);
        },
        'the graph should contain 1 HtmlRequireJsAlmondReplacement relation': function (assetGraph) {
            assert.equal(assetGraph.findRelations({type: 'HtmlRequireJsAlmondReplacement'}).length, 1);
        },
        'the JavaScript asset text should be equal to require.js': function (assetGraph) {
            var relation = assetGraph.findRelations({type: 'HtmlScript'})[0],
                text = relation && relation.to.text;

            assert.equal(text, requirejs);
        },
        'then running the replaceRequireJsWithAlmond transform': {
            topic: function (assetGraph) {
                assetGraph
                    .replaceRequireJsWithAlmond()
                    //.drawGraph('2-after.svg')
                    .run(this.callback);
            },

            'the graph should contain 3 JavaScript assets': function (assetGraph) {
                assert.equal(assetGraph.findAssets({type: 'JavaScript'}).length, 3);
            },
            'the graph should contain 2 HtmlScript relations': function (assetGraph) {
                assert.equal(assetGraph.findRelations({type: 'HtmlScript'}).length, 2);
            },
            'the graph should contain 0 HtmlRequireJsAlmondReplacement relations': function (assetGraph) {
                assert.equal(assetGraph.findRelations({type: 'HtmlRequireJsAlmondReplacement'}).length, 0);
            },
            'the first JavaScript assets text should be equal to require.js': function (assetGraph) {
                var relation = assetGraph.findRelations({type: 'HtmlScript'})[0],
                    text = relation && relation.to.text;

                assert.equal(text, requirejs);
            },
            'the graph should have emitted 1 warning from the replaceRequireJsWithAlmond transform': function (assetGraph) {
                assert.equal(assetGraph._vowsEmitedEvents.warn.filter(function (warn) {
                    return warn[0].transform === 'replaceRequireJsWithAlmond';
                }).length, 1);
            }
        }
    },
    'After loading a test where multiple Html assets use the same require.js and have a data-almond attribute': {
        topic: function () {
            new AssetGraph({root: __dirname + '/replaceRequireJsWithAlmond/multipleHtml/'})
                .registerRequireJsConfig({preventPopulationOfJavaScriptAssetsUntilConfigHasBeenFound: true})
                .loadAssets('*.html')
                .populate({from: {type: 'Html'}, followRelations: {type: 'HtmlScript', to: {url: /^file:/}}})
                .assumeRequireJsConfigHasBeenFound()
                .populate()
                .run(this.callback);
        },
        'the graph should contain 2 Html assets': function (assetGraph) {
            assert.equal(assetGraph.findAssets({type: 'Html'}).length, 2);
        },
        'the graph should contain 2 JavaScript assets': function (assetGraph) {
            assert.equal(assetGraph.findAssets({type: 'JavaScript'}).length, 2);
        },
        'the graph should contain 2 HtmlScript relations': function (assetGraph) {
            assert.equal(assetGraph.findRelations({type: 'HtmlScript'}).length, 2);
        },
        'the graph should contain 2 HtmlRequireJsAlmondReplacement relations': function (assetGraph) {
            assert.equal(assetGraph.findRelations({type: 'HtmlRequireJsAlmondReplacement'}).length, 2);
        },
        'then running the replaceRequireJsWithAlmond transform': {
            topic: function (assetGraph) {
                assetGraph
                    .replaceRequireJsWithAlmond()
                    .run(this.callback);
            },

            'the graph should contain 1 JavaScript asset': function (assetGraph) {
                assert.equal(assetGraph.findAssets({type: 'JavaScript'}).length, 1);
            },
            'the graph should contain 2 HtmlScript relations': function (assetGraph) {
                assert.equal(assetGraph.findRelations({type: 'HtmlScript'}).length, 2);
            },
            'the graph should contain 0 HtmlRequireJsAlmondReplacement relations': function (assetGraph) {
                assert.equal(assetGraph.findRelations({type: 'HtmlRequireJsAlmondReplacement'}).length, 0);
            }
        }
    }
})['export'](module);
