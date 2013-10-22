var vows = require('vows'),
    assert = require('assert'),
    AssetGraph = require('../lib/AssetGraph'),
    cssText = '';

vows.describe('transforms.splitCssIfIeLimitIsReached').addBatch({
    'After loading a simple Css test case': {
        topic: function () {
            new AssetGraph({root: __dirname + '/splitCssIfIeLimitReached/'})
                .loadAssets('index.html')
                .populate()
                .minifyAssets({ type: 'Css', isLoaded: true})
                .run(this.callback);
        },
        'the graph should contain 1 Css asset': function (assetGraph) {
            var cssAssets = assetGraph.findAssets({type: 'Css'});

            assert.equal(cssAssets.length, 1);

            cssText = cssAssets.map(function (cssAsset) {
                return cssAsset.text;
            }).join('');
        },
        'the Css asset should contain 4096 rules': function (assetGraph) {
            assert.equal(assetGraph.findAssets({ type: 'Css' })[0].parseTree.cssRules.length, 4096);
        },
        'then running the splitCssIfIeLimitIsReached transform': {
            topic: function (assetGraph) {
                assetGraph.__infos = [];

                assetGraph
                    .on('info', function (err) {
                        assetGraph.__infos.push(err);
                    })
                    .splitCssIfIeLimitIsReached()
                    .run(this.callback);
            },
            'the graph should have 1 emitted info': function (assetGraph) {
                assert.equal(assetGraph.__infos.length, 1);
            },
            'the graph should contain 2 Css asset': function (assetGraph) {
                assert.equal(assetGraph.findAssets({type: 'Css'}).length, 2);
            },
            'each Css asset should be smaller than the original': function (assetGraph) {
                assetGraph.findAssets({type: 'Css'}).forEach(function (cssAsset) {
                    assert(cssAsset.text.length < cssText.length);
                });
            },
            'the concatenated css text content should be unchanged from before': function (assetGraph) {
                assert.equal(assetGraph.findAssets({type: 'Css'}).map(function (cssAsset) {
                        return cssAsset.text;
                    }).join(''), cssText);
            }
        }
    },

    'After loading a real life huge Css test case': {
        topic: function () {
            new AssetGraph({root: __dirname + '/splitCssIfIeLimitReached/'})
                .loadAssets('falcon.html')
                .populate()
                .minifyAssets({ type: 'Css', isLoaded: true})
                .run(this.callback);
        },
        'the graph should contain 1 Css asset': function (assetGraph) {
            var cssAssets = assetGraph.findAssets({type: 'Css'});

            assert.equal(cssAssets.length, 1);

            cssText = cssAssets.map(function (cssAsset) {
                return cssAsset.text;
            }).join('');
        },
        'the Css asset should contain 6290 rules': function (assetGraph) {
            assert.equal(assetGraph.findAssets({ type: 'Css' })[0].parseTree.cssRules.length, 6290);
        },
        'then running the splitCssIfIeLimitIsReached transform': {
            topic: function (assetGraph) {
                assetGraph.__infos = [];

                assetGraph
                    .on('info', function (err) {
                        assetGraph.__infos.push(err);
                    })
                    .splitCssIfIeLimitIsReached()
                    .run(this.callback);
            },
            'the graph should have 1 emitted info': function (assetGraph) {
                assert.equal(assetGraph.__infos.length, 1);
            },
            'the graph should contain 3 Css asset': function (assetGraph) {
                assert.equal(assetGraph.findAssets({type: 'Css'}).length, 3);
            },
            'each Css asset should be smaller than the original': function (assetGraph) {
                assetGraph.findAssets({type: 'Css'}).forEach(function (cssAsset) {
                    assert(cssAsset.text.length < cssText.length);
                });
            },
            'the concatenated css text content should be unchanged from before': function (assetGraph) {
                assert.equal(assetGraph.findAssets({type: 'Css'}).map(function (cssAsset) {
                        return cssAsset.text;
                    }).join(''), cssText);
            }
        }
    }
})['export'](module);
